import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Contact } from '../interfaces/contact';
import { CreateContactResponse } from '../interfaces/create-contact-response';
import { GetContactsResponse } from '../interfaces/get-contacts-response';
import { RawContact } from '../interfaces/raw-contact';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { TileSetting, normalizeTileSettings } from '../interfaces/tile-settings';
import { AvatarStorageService } from './avatar-storage.service';
import { IndexedDbService } from './indexed-db.service';
import { NetworkService } from './network.service';
import { SocketioService } from './socketio.service';
import { TranslationHelperService } from './translation-helper.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private _contacts = signal<Contact[]>([]);
  private _contactsSet = signal(0);
  readonly contactsSet = this._contactsSet.asReadonly();
  private _contactReset = signal<{ scope: 'all' | 'contactUser'; contactUserId?: string; token: number } | null>(null);
  readonly contactReset = this._contactReset.asReadonly();
  private ready = false;

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      withCredentials: 'true'
    })
  };

  private readonly http = inject(HttpClient);
  private readonly userService = inject(UserService);
  private readonly indexedDbService = inject(IndexedDbService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly networkService = inject(NetworkService);
  private readonly avatarStorage = inject(AvatarStorageService);
  private readonly i18n = inject(TranslationHelperService);

  get contactsSignal() { return this._contacts.asReadonly(); }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  initContacts(force = false) {
    if (this.ready && !force) {
      return;
    }
    const userId = this.userService.getUser().id;
    if (!this.userService.isReady() || !userId) {
      this.ready = false;
      return;
    }
    this.getByUserId(userId)
      .subscribe({
        next: async (getContactsResponse: GetContactsResponse) => {
          const contacts = (getContactsResponse.rows || []).map(raw => this.mapRawContact(raw));
          await this.storeContactAvatarsFromServer(contacts);
          this._contacts.set(contacts);
          await this.updateContactProfile();
          this.persistContacts(false);
          this.ready = true;
          this._contactsSet.update(trigger => trigger + 1);
        },
        error: (err) => {
          if (err.status === 404) {
            this._contacts.set([]);
            this.ready = true;
          } else {
            this.ready = false;
          }
          this._contactsSet.update(trigger => trigger + 1);
        }
      });
  }

  public logout() {
    this.ready = false;
    this._contacts.set([]);
  }

  private mapRawContact(raw: RawContact): Contact {
    return {
      id: raw.id,
      userId: raw.userId,
      contactUserId: raw.contactUserId,
      contactUserSigningPublicKey: raw.contactUserSigningPublicKey ? JSON.parse(raw.contactUserSigningPublicKey) : undefined,
      contactUserEncryptionPublicKey: raw.contactUserEncryptionPublicKey ? JSON.parse(raw.contactUserEncryptionPublicKey) : undefined,
      subscribed: raw.subscribed,
      pinned: false,
      hint: raw.hint ?? '',
      name: this.sanitizeContactName(raw.name),
      base64Avatar: raw.base64Avatar ?? '',
      provided: raw.provided ?? false,
      lastMessageFrom: raw.lastMessageFrom ?? '',
      lastMessageAt: raw.lastMessageAt ?? null
    };
  }

  private async storeContactAvatarsFromServer(contacts: Contact[]): Promise<void> {
    if (!this.avatarStorage.isSupported()) {
      return;
    }
    await Promise.all(contacts.map(async (contact) => {
      if (!contact.base64Avatar) {
        return;
      }
      const saved = await this.avatarStorage.saveImageFromBase64('avatar', contact.base64Avatar, contact.avatarFileId);
      if (saved) {
        contact.avatarFileId = saved.id;
        contact.base64Avatar = saved.url;
      } else {
        contact.base64Avatar = '';
      }
    }));
  }

  private sanitizeContactName(name?: string | null): string {
    if (!name) {
      return '';
    }

    const trimmed = name.trim();
    if (!trimmed) {
      return '';
    }

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && 'iv' in parsed && 'encryptedData' in parsed && 'encryptedKey' in parsed) {
        return '';
      }
    } catch {
      // Non-JSON names are valid and should be preserved.
    }

    return name;
  }

  private async updateContactProfile() {
    await Promise.all(this._contacts().map(async contact => {
      const profile = await this.indexedDbService.getContactProfile(contact.id);
      contact.name = this.sanitizeContactName(profile?.name ?? contact.name);
      contact.avatarFileId = profile?.avatarFileId ?? contact.avatarFileId;
      contact.avatarAttribution = profile?.avatarAttribution ?? contact.avatarAttribution;
      contact.chatBackgroundFileId = profile?.chatBackgroundFileId ?? contact.chatBackgroundFileId;
      contact.chatBackgroundAttribution = profile?.chatBackgroundAttribution ?? contact.chatBackgroundAttribution;
      contact.base64Avatar = contact.avatarFileId
        ? (await this.avatarStorage.getImageUrl(contact.avatarFileId)) || ''
        : '';
      contact.chatBackgroundImage = contact.chatBackgroundFileId
        ? (await this.avatarStorage.getImageUrl(contact.chatBackgroundFileId)) || ''
        : '';
      contact.chatBackgroundTransparency = profile?.chatBackgroundTransparency ?? contact.chatBackgroundTransparency;
      contact.pinned = profile?.pinned || false;
      const tileSettings = await this.indexedDbService.getTileSettings(contact.id);
      contact.tileSettings = tileSettings ?? contact.tileSettings ?? [];
    }));
    this._contacts.set(this._contacts());
  }

  async saveAditionalContactInfos() {
    const contacts = this._contacts();
    await Promise.all(contacts.map(contact => {
      this.indexedDbService.setContactProfile(contact.id, {
        name: contact.name ? contact.name : '',
        base64Avatar: '',
        avatarFileId: contact.avatarFileId,
        avatarAttribution: contact.avatarAttribution,
        chatBackgroundImage: '',
        chatBackgroundFileId: contact.chatBackgroundFileId,
        chatBackgroundAttribution: contact.chatBackgroundAttribution,
        chatBackgroundTransparency: contact.chatBackgroundTransparency ?? 40,
        pinned: contact.pinned
      });
    }));
    this._contacts.set(contacts.slice());
  }

  private persistContacts(markDirty = true): void {
    if (!this.userService.isReady() || !this.userService.getUser().id) {
      return;
    }
    this.indexedDbService.replaceContacts(this._contacts(), markDirty).catch((storeErr) => {
      console.error('Failed to cache contacts', storeErr);
    });
  }

  async saveContactTileSettings(contact: Contact, tileSettings?: TileSetting[]): Promise<void> {
    const normalized = normalizeTileSettings(tileSettings ?? contact.tileSettings ?? [], {
      includeDefaults: false,
      includeSystem: false
    });

    this._contacts.update((contacts) =>
      contacts.map(c =>
        c.id === contact.id
          ? { ...c, tileSettings: normalized.map(t => ({ ...t })) }
          : c
      )
    );

    await this.indexedDbService.setTileSettings(contact.id, normalized);
  }

  isReady(): boolean {
    return this.ready;
  }

  readonly sortedContactsSignal = computed(() =>
    this._contacts().slice().sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      }
      const nameA = a.name?.trim().toLowerCase() || 'unnamed';
      const nameB = b.name?.trim().toLowerCase() || 'unnamed';
      return nameA.localeCompare(nameB);
    })
  );

  setContacts(contacts: Contact[]) {
    this._contacts.set(contacts);
    this.persistContacts();
  }

  emitContactResetAll(): void {
    this._contactReset.set({ scope: 'all', token: Date.now() });
  }

  emitContactResetForContactUser(contactUserId: string): void {
    if (!contactUserId) {
      return;
    }
    this._contactReset.set({ scope: 'contactUser', contactUserId, token: Date.now() });
  }

  refreshContact(contactId: string) {
    this._contacts.update((contacts) =>
      contacts.map(contact => contact.id === contactId ? { ...contact } : contact)
    );
  }

  updateContactKeysByContactUserId(contactUserId: string, signingPublicKey: JsonWebKey, cryptoPublicKey: JsonWebKey) {
    if (!contactUserId) {
      return;
    }
    let changed = false;
    this._contacts.update((contacts) =>
      contacts.map((contact) => {
        if (contact.contactUserId !== contactUserId) {
          return contact;
        }
        changed = true;
        return {
          ...contact,
          contactUserSigningPublicKey: signingPublicKey,
          contactUserEncryptionPublicKey: cryptoPublicKey
        };
      })
    );
    if (changed) {
      this.persistContacts();
      this.emitContactResetForContactUser(contactUserId);
    }
  }

  createContact(contact: Contact, socketioService: SocketioService, showAlways = false) {
    const url = `${environment.apiUrl}/contact/create`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: this.i18n.t('common.contact.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.contact.creating'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });
    const body = {
      'userId': contact.userId,
      'contactUserId': contact.contactUserId,
      'contactUserSigningPublicKey': JSON.stringify(contact.contactUserSigningPublicKey),
      'contactUserEncryptionPublicKey': JSON.stringify(contact.contactUserEncryptionPublicKey),
      'hint': contact.hint
    };
    this.http.post<CreateContactResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: createContactResponse => {
          if (createContactResponse.status === 200) {
            contact.id = createContactResponse.contactId;
            this._contacts.update(contacts => [...contacts, contact]);
            this.persistContacts();
            this.saveAditionalContactInfos();
            this.snackBar.open(this.i18n.t('common.contact.created'), '', { duration: 1000 });
          }
        },
        error: (err) => { this.snackBar.open(err.message, this.i18n.t('common.actions.ok')); }
      });
  }

  updateContactName(contact: Contact, showAlways = false) {
    const url = `${environment.apiUrl}/contact/update/name`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: this.i18n.t('common.contact.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.contact.updatingName'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });
    const body = {
      'contactId': contact.id,
      'name': contact.name
    };
    this.http.post<SimpleStatusResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (response) => {
          if (response.status !== 200) {
            this.snackBar.open(this.i18n.t('common.contact.updateNameFailed'), this.i18n.t('common.actions.ok'));
            return;
          }
          this.persistContacts();
        },
        error: (err) => {
          const message = err?.message ?? this.i18n.t('common.contact.updateNameFailed');
          this.snackBar.open(message, this.i18n.t('common.actions.ok'));
        }
      });
  }

  getById(contactId: string, showAlways = false) {
    const url = `${environment.apiUrl}/contact/get/${contactId}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: this.i18n.t('common.contact.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.contact.loading'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });
    return this.http.get(url, this.httpOptions).pipe(
      catchError(this.handleError)
    );
  }

  getByUserId(userId: string) {
    const url = `${environment.apiUrl}/contact/get/userId/${userId}`;
    return this.http.get<GetContactsResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  public deleteContact(contactId: string) {
    const url = `${environment.apiUrl}/contact/delete/${contactId}`;
    return this.http.get<boolean>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  public subscribe(contact: Contact) {
    contact.subscribed = true;
    const url = `${environment.apiUrl}/contact/subscribe/${contact.id}`;
    this.http.get<boolean>(url, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: () => {
          contact.subscribed = true;
          this.persistContacts();
        },
        error: (err) => { this.snackBar.open(err.message, this.i18n.t('common.actions.ok')); }
      });
  }

  public unsubscribe(contact: Contact) {
    contact.subscribed = false;
    const url = `${environment.apiUrl}/contact/unsubscribe/${contact.id}`;
    this.http.get<boolean>(url, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: () => {
          contact.subscribed = false;
          this.persistContacts();
        },
        error: (err) => { this.snackBar.open(err.message, this.i18n.t('common.actions.ok')); }
      });
  }
}
