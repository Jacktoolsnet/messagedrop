import { HttpClient, HttpHeaders } from '@angular/common/http';
import { effect, inject, Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Buffer } from 'buffer';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ProfileConfirmRequestComponent } from '../components/user/profile-confirm-request/profile-confirm-request.component';
import {
  ContactProfileExchangeAckResponse,
  ContactProfileExchangeInboxEntry,
  ContactProfileExchangeInboxResponse,
  ContactProfileExchangeRequestResponse,
  ContactProfileExchangeRespondResponse,
  ContactProfileExchangeResponseEntry,
  ContactProfileExchangeResponsesResponse,
  SharedContactProfilePayload
} from '../interfaces/contact-profile-exchange';
import { Contact } from '../interfaces/contact';
import { CryptoData } from '../interfaces/crypto-data';
import { AvatarStorageService } from './avatar-storage.service';
import { ContactService } from './contact.service';
import { CryptoService } from './crypto.service';
import { DisplayMessageService } from './display-message.service';
import { SocketioService } from './socketio.service';
import { TranslationHelperService } from './translation-helper.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class ContactProfileExchangeService {
  private readonly http = inject(HttpClient);
  private readonly dialog = inject(MatDialog);
  private readonly avatarStorage = inject(AvatarStorageService);
  private readonly contactService = inject(ContactService);
  private readonly cryptoService = inject(CryptoService);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly socketioService = inject(SocketioService);
  private readonly i18n = inject(TranslationHelperService);
  private readonly userService = inject(UserService);

  private readonly httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json'
    }),
    withCredentials: true
  };

  private syncInFlight = false;
  private syncQueued = false;
  private readonly activeInboxRequestIds = new Set<string>();
  private readonly warnedInvalidResponseIds = new Set<string>();

  constructor() {
    effect(() => {
      this.userService.userSet();
      const contactsVersion = this.contactService.contactsSet();
      const joined = this.socketioService.joinedUserRoom();
      this.socketioService.contactProfileExchangeUpdateToken();

      if (!this.userService.isReady() || !this.userService.hasJwt()) {
        this.resetRuntimeState();
        return;
      }

      if (!joined || contactsVersion === 0) {
        return;
      }

      void this.queueSync();
    });
  }

  async requestProfile(contact: Contact): Promise<void> {
    if (!contact?.id || !this.userService.hasJwt()) {
      return;
    }

    try {
      const response = await firstValueFrom(
        this.http.post<ContactProfileExchangeRequestResponse>(
          `${environment.apiUrl}/contactProfile/request`,
          { contactId: contact.id },
          this.httpOptions
        )
      );

      this.snackBar.open(this.i18n.t('common.contact.profile.requestSent'), '', {
        duration: 1500,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });

      if (response.exchangeStatus !== 'pending') {
        void this.queueSync();
      }
    } catch {
      this.snackBar.open(
        this.i18n.t('common.contact.profile.requestFailed'),
        this.i18n.t('common.actions.ok'),
        {
          panelClass: ['snack-warning'],
          horizontalPosition: 'center',
          verticalPosition: 'top'
        }
      );
    }
  }

  private resetRuntimeState(): void {
    this.syncInFlight = false;
    this.syncQueued = false;
    this.activeInboxRequestIds.clear();
    this.warnedInvalidResponseIds.clear();
  }

  private async queueSync(): Promise<void> {
    if (!this.userService.hasJwt() || !this.socketioService.joinedUserRoom()) {
      return;
    }
    if (this.syncInFlight) {
      this.syncQueued = true;
      return;
    }
    await this.syncAll();
  }

  private async syncAll(): Promise<void> {
    this.syncInFlight = true;
    try {
      await this.processResponses();
      await this.processInboxRequests();
    } finally {
      this.syncInFlight = false;
      if (this.syncQueued) {
        this.syncQueued = false;
        queueMicrotask(() => {
          void this.queueSync();
        });
      }
    }
  }

  private async processResponses(): Promise<void> {
    let approvedApplied = 0;
    let declinedCount = 0;
    let invalidCount = 0;
    const ackIds: string[] = [];

    try {
      const response = await firstValueFrom(
        this.http.get<ContactProfileExchangeResponsesResponse>(
          `${environment.apiUrl}/contactProfile/responses`,
          this.httpOptions
        )
      );

      for (const row of response.rows ?? []) {
        if (row.status === 'declined') {
          declinedCount += 1;
          ackIds.push(row.id);
          continue;
        }

        const applyResult = await this.applyApprovedResponse(row);
        if (applyResult === 'applied') {
          approvedApplied += 1;
          ackIds.push(row.id);
          this.warnedInvalidResponseIds.delete(row.id);
          continue;
        }

        if (applyResult === 'missing_contact') {
          ackIds.push(row.id);
          this.warnedInvalidResponseIds.delete(row.id);
          continue;
        }

        if (!this.warnedInvalidResponseIds.has(row.id)) {
          this.warnedInvalidResponseIds.add(row.id);
          invalidCount += 1;
        }
      }

      if (ackIds.length > 0) {
        await firstValueFrom(
          this.http.post<ContactProfileExchangeAckResponse>(
            `${environment.apiUrl}/contactProfile/ack`,
            { exchangeIds: ackIds },
            this.httpOptions
          )
        );
      }
    } catch {
      return;
    }

    if (approvedApplied > 0) {
      this.snackBar.open(this.i18n.t('common.contact.profile.received'), '', {
        duration: 2500,
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: ['snack-success']
      });
      return;
    }

    if (declinedCount > 0) {
      this.snackBar.open(this.i18n.t('common.contact.profileRequestDeclined'), '', {
        duration: 2500,
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: ['snack-warning']
      });
      return;
    }

    if (invalidCount > 0) {
      this.snackBar.open(this.i18n.t('common.contact.profile.receivedInvalid'), '', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: ['snack-warning']
      });
    }
  }

  private async processInboxRequests(): Promise<void> {
    let inbox: ContactProfileExchangeInboxResponse;
    try {
      inbox = await firstValueFrom(
        this.http.get<ContactProfileExchangeInboxResponse>(
          `${environment.apiUrl}/contactProfile/inbox`,
          this.httpOptions
        )
      );
    } catch {
      return;
    }

    for (const request of inbox.rows ?? []) {
      if (this.activeInboxRequestIds.has(request.id)) {
        continue;
      }

      this.activeInboxRequestIds.add(request.id);
      try {
        const approved = await this.promptForRequestApproval(request);
        await this.sendRequestResponse(request, approved);
      } finally {
        this.activeInboxRequestIds.delete(request.id);
      }
    }
  }

  private async promptForRequestApproval(request: ContactProfileExchangeInboxEntry): Promise<boolean> {
    const dialogRef = this.dialog.open(ProfileConfirmRequestComponent, {
      data: {
        requesterUserId: request.requesterUserId
      },
      closeOnNavigation: true,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    const result = await firstValueFrom(dialogRef.afterClosed());
    return result === true;
  }

  private async sendRequestResponse(request: ContactProfileExchangeInboxEntry, approved: boolean): Promise<void> {
    try {
      let body: {
        exchangeId: string;
        approved: boolean;
        encryptedProfilePayload?: string;
        responseSignature?: string;
      } = {
        exchangeId: request.id,
        approved
      };

      if (approved) {
        const requesterEncryptionKey = this.parseJsonWebKey(request.requesterEncryptionPublicKey);
        if (!requesterEncryptionKey) {
          throw new Error('missing_requester_encryption_key');
        }

        const profilePayload = await this.buildSharedProfilePayload();
        const profilePayloadJson = JSON.stringify(profilePayload);
        body = {
          exchangeId: request.id,
          approved: true,
          encryptedProfilePayload: await this.cryptoService.encrypt(requesterEncryptionKey, profilePayloadJson),
          responseSignature: await this.cryptoService.createSignature(
            this.userService.getUser().signingKeyPair.privateKey,
            profilePayloadJson
          )
        };
      }

      await firstValueFrom(
        this.http.post<ContactProfileExchangeRespondResponse>(
          `${environment.apiUrl}/contactProfile/respond`,
          body,
          this.httpOptions
        )
      );
    } catch {
      this.snackBar.open(
        this.i18n.t('common.contact.profile.responseFailed'),
        this.i18n.t('common.actions.ok'),
        {
          panelClass: ['snack-warning'],
          horizontalPosition: 'center',
          verticalPosition: 'top'
        }
      );
    }
  }

  private async buildSharedProfilePayload(): Promise<SharedContactProfilePayload> {
    const profile = this.userService.getProfile();
    const avatarBase64 = await this.resolveCurrentProfileAvatarBase64();
    return {
      name: profile.name ?? '',
      base64Avatar: avatarBase64,
      avatarAttribution: profile.avatarAttribution
    };
  }

  private async resolveCurrentProfileAvatarBase64(): Promise<string> {
    const profile = this.userService.getProfile();
    if (profile.avatarFileId && this.avatarStorage.isSupported()) {
      const stored = await this.avatarStorage.getImageBase64(profile.avatarFileId);
      if (stored) {
        return stored;
      }
    }
    const fallback = profile.base64Avatar ?? '';
    return fallback.startsWith('data:') ? fallback : '';
  }

  private async applyApprovedResponse(
    response: ContactProfileExchangeResponseEntry
  ): Promise<'applied' | 'missing_contact' | 'invalid'> {
    const contact = this.contactService.sortedContactsSignal().find((entry) => entry.id === response.requesterContactId);
    if (!contact) {
      return 'missing_contact';
    }
    if (!response.encryptedProfilePayload || !response.responseSignature || !contact.contactUserSigningPublicKey) {
      return 'invalid';
    }

    let decryptedPayload: string;
    try {
      decryptedPayload = await this.cryptoService.decrypt(
        this.userService.getUser().cryptoKeyPair.privateKey,
        JSON.parse(response.encryptedProfilePayload) as CryptoData
      );
    } catch {
      return 'invalid';
    }

    if (!decryptedPayload) {
      return 'invalid';
    }

    let profilePayload: SharedContactProfilePayload;
    try {
      profilePayload = JSON.parse(decryptedPayload) as SharedContactProfilePayload;
    } catch {
      return 'invalid';
    }

    const signature = this.signatureToArrayBuffer(response.responseSignature);
    if (!signature) {
      return 'invalid';
    }

    let verified = false;
    try {
      verified = await this.cryptoService.verifySignature(
        contact.contactUserSigningPublicKey,
        decryptedPayload,
        signature
      );
    } catch {
      return 'invalid';
    }

    if (!verified) {
      return 'invalid';
    }

    await this.applyProfileToContact(contact, profilePayload);
    return 'applied';
  }

  private async applyProfileToContact(contact: Contact, payload: SharedContactProfilePayload): Promise<void> {
    const previousAvatarFileId = contact.avatarFileId;
    const hasIncomingAvatar = !!payload.base64Avatar;

    contact.name = payload.name?.trim() || this.i18n.t('common.contact.notSet');

    if (hasIncomingAvatar && this.avatarStorage.isSupported()) {
      const saved = await this.avatarStorage.saveImageFromBase64('avatar', payload.base64Avatar, previousAvatarFileId);
      if (saved) {
        contact.avatarFileId = saved.id;
        contact.base64Avatar = saved.url;
        contact.avatarAttribution = payload.avatarAttribution;
      } else {
        if (previousAvatarFileId) {
          await this.avatarStorage.deleteImage(previousAvatarFileId);
        }
        contact.avatarFileId = undefined;
        contact.avatarOriginalFileId = undefined;
        contact.base64Avatar = '';
        contact.avatarAttribution = undefined;
      }
    } else {
      if (previousAvatarFileId && this.avatarStorage.isSupported()) {
        await this.avatarStorage.deleteImage(previousAvatarFileId);
      }
      contact.avatarFileId = undefined;
      contact.avatarOriginalFileId = undefined;
      contact.base64Avatar = '';
      contact.avatarAttribution = undefined;
    }

    await this.contactService.saveAditionalContactInfos();
    this.contactService.refreshContact(contact.id);
  }

  private parseJsonWebKey(raw: string): JsonWebKey | null {
    try {
      return JSON.parse(raw) as JsonWebKey;
    } catch {
      return null;
    }
  }

  private signatureToArrayBuffer(raw: string): ArrayBuffer | null {
    try {
      const buffer = Buffer.from(JSON.parse(raw));
      return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );
    } catch {
      return null;
    }
  }
}
