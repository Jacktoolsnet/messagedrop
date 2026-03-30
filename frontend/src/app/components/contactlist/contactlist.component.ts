import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Signal, effect, inject, signal } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { Connect } from '../../interfaces/connect';
import { Contact } from '../../interfaces/contact';
import { ContactMessage } from '../../interfaces/contact-message';
import { Mode } from '../../interfaces/mode';
import { ShortMessage } from '../../interfaces/short-message';
import { ConnectService } from '../../services/connect.service';
import { ContactMessageService } from '../../services/contact-message.service';
import { ContactService } from '../../services/contact.service';
import { CryptoService } from '../../services/crypto.service';
import { SocketioService } from '../../services/socketio.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { ContactChatroomComponent } from '../contact-chatroom/contact-chatroom.component';
import { ConnectComponent } from '../contact/connect/connect.component';
import { ContactSettingsComponent } from '../contact/contact-setting/contact-settings.component';
import { DeleteContactComponent } from '../contact/delete-contact/delete-contact.component';
import { TileListDialogComponent } from "../tile/tile-list-dialog/tile-list-dialog.component";
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { QrcodeComponent } from '../utils/qrcode/qrcode.component';
import { ScannerComponent } from '../utils/scanner/scanner.component';
import { ContactSortDialogComponent } from './contact-sort-dialog/contact-sort-dialog.component';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { DisplayMessageRef, DisplayMessageService } from '../../services/display-message.service';

interface ConnectDialogResult {
  connectId?: string;
}

interface ContactMessagePreview {
  messageId: string;
  createdAt: string;
  text: string;
  outgoing: boolean;
  status: ContactMessage['status'];
  payload: ShortMessage | null;
}

@Component({
  selector: 'app-contactlist',
  imports: [
    DialogHeaderComponent,
    MatCardModule,
    CommonModule,
    MatBadgeModule,
    MatButtonModule,
    MatDialogContent,
    MatDialogActions,
    MatIcon,
    MatMenuModule,
    TranslocoPipe
  ],
  templateUrl: './contactlist.component.html',
  styleUrl: './contactlist.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactlistComponent {
  private snackBarRef?: DisplayMessageRef;
  public readonly userService = inject(UserService);
  public readonly socketioService = inject(SocketioService);
  public readonly contactService = inject(ContactService);
  private readonly connectService = inject(ConnectService);
  private readonly cryptoService = inject(CryptoService);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly matDialog = inject(MatDialog);
  private readonly contactMessageService = inject(ContactMessageService);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  readonly dialogRef = inject(MatDialogRef<ContactlistComponent>);
  readonly contactsSignal: Signal<Contact[]> = this.contactService.sortedContactsSignal;
  readonly unreadCounts = signal<Record<string, number>>({});
  readonly latestMessagePreviews = signal<Record<string, ContactMessagePreview[]>>({});
  private readonly unreadLoaded = new Set<string>();
  private readonly previewRequestKeys = new Map<string, string>();

  private contactToDelete?: Contact;
  public mode: typeof Mode = Mode;
  public subscriptionError = false;

  constructor() {
    effect(() => {
      const count = this.contactsSignal().length;
      const width = count > 1 ? 'min(900px, 95vw)' : 'min(520px, 95vw)';
      this.dialogRef.updateSize(width);
    });

    effect(() => {
      this.contactService.contactsSet();
      if (!this.userService.hasJwt()) {
        this.unreadLoaded.clear();
        this.unreadCounts.set({});
        return;
      }
      const contacts = this.contactsSignal();
      contacts.forEach(contact => {
        if (this.unreadLoaded.has(contact.id)) {
          return;
        }
        this.contactMessageService.unreadCount(contact.id).subscribe({
          next: (res) => {
            this.unreadCounts.update((map: Record<string, number>) => ({ ...map, [contact.id]: res.unread ?? 0 }));
            contact.unreadCount = res.unread ?? 0;
            this.unreadLoaded.add(contact.id);
          }
        });
      });
    });

    effect(() => {
      const update = this.contactMessageService.unreadCountUpdate();
      if (!this.userService.hasJwt()) {
        return;
      }
      if (update) {
        this.unreadCounts.update((map: Record<string, number>) => ({ ...map, [update.contactId]: update.unread }));
        const contact = this.contactsSignal().find((c) => c.id === update.contactId);
        if (contact) {
          contact.unreadCount = update.unread;
        }
        this.contactMessageService.unreadCountUpdate.set(null);
      }
    });

    effect(() => {
      this.userService.userSet();
      const contacts = this.contactsSignal();
      const hasJwt = this.userService.hasJwt();
      const activeContactIds = new Set(contacts.map((contact) => contact.id));

      for (const contactId of Array.from(this.previewRequestKeys.keys())) {
        if (!activeContactIds.has(contactId)) {
          this.previewRequestKeys.delete(contactId);
        }
      }

      this.latestMessagePreviews.update((current) => {
        const nextEntries = Object.entries(current).filter(([contactId]) => activeContactIds.has(contactId));
        return nextEntries.length === Object.keys(current).length ? current : Object.fromEntries(nextEntries);
      });

      if (!hasJwt) {
        this.previewRequestKeys.clear();
        this.latestMessagePreviews.set({});
        return;
      }

      contacts.forEach((contact) => {
        const requestKey = `${contact.id}:${contact.lastMessageAt ?? ''}`;
        if (this.previewRequestKeys.get(contact.id) === requestKey) {
          return;
        }

        this.previewRequestKeys.set(contact.id, requestKey);
        void this.loadLatestMessagePreview(contact, requestKey);
      });
    });

    effect(() => {
      const incoming = this.contactMessageService.liveMessages();
      if (!incoming) {
        return;
      }

      const contact = this.contactsSignal().find((entry) => entry.id === incoming.contactId);
      if (!contact) {
        return;
      }

      void this.applyIncomingLatestMessagePreview(contact, incoming);
    });
  }

  getUnreadBadge(contactId: string): string {
    const count = this.unreadCounts()[contactId] ?? 0;
    if (!count) {
      return '';
    }
    return count > 99 ? '99+' : `${count}`;
  }

  getContactHeaderBackgroundImage(contact: Contact): string {
    return contact.chatBackgroundImage ? `url(${contact.chatBackgroundImage})` : 'none';
  }

  getContactHeaderBackgroundOpacity(contact: Contact): number {
    const transparency = contact.chatBackgroundTransparency ?? 40;
    const clamped = Math.min(Math.max(transparency, 0), 100);
    return 1 - clamped / 100;
  }

  getLatestMessagePreviews(contact: Contact): ContactMessagePreview[] {
    return this.latestMessagePreviews()[contact.id] ?? [];
  }

  hasUnsplashBadge(contact: Contact): boolean {
    return contact.avatarAttribution?.source === 'unsplash'
      || contact.chatBackgroundAttribution?.source === 'unsplash';
  }

  isPreviewFromToday(createdAt: string): boolean {
    const createdDate = new Date(createdAt);
    if (Number.isNaN(createdDate.getTime())) {
      return true;
    }

    const now = new Date();
    return createdDate.getFullYear() === now.getFullYear()
      && createdDate.getMonth() === now.getMonth()
      && createdDate.getDate() === now.getDate();
  }

  openConnectDialog(): void {
    if (!this.userService.hasJwt()) {
      return;
    }
    const contact: Contact = {
      id: "",
      userId: this.userService.getUser().id,
      contactUserId: '',
      name: '',
      subscribed: false,
      pinned: false,
      provided: false,
      lastMessageFrom: '',
      lastMessageAt: null
    };
    const dialogRef = this.matDialog.open(ConnectComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_CONNECT, connectId: "" },
      minWidth: '60vw',
      maxWidth: '90vw',
      height: 'auto',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result?: ConnectDialogResult) => {
      if (result?.connectId) {
        this.connectService.getById(result.connectId, contact, this.socketioService);
      }
    });
  }

  openScannerDialog(): void {
    if (!this.userService.hasJwt()) {
      return;
    }
    const contact: Contact = {
      id: "",
      userId: this.userService.getUser().id,
      contactUserId: '',
      name: '',
      subscribed: false,
      pinned: false,
      provided: false,
      lastMessageFrom: '',
      lastMessageAt: null
    };
    const dialogRef = this.matDialog.open(ScannerComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_CONNECT, connectId: "" },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result?: ConnectDialogResult) => {
      if (result?.connectId) {
        this.connectService.getById(result.connectId, contact, this.socketioService);
      }
    });
  }

  public deleteContact(contact: Contact) {
    if (!this.userService.hasJwt()) {
      return;
    }
    this.contactToDelete = contact;
    const dialogRef = this.matDialog.open(DeleteContactComponent, {
      closeOnNavigation: true,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe((result?: boolean) => {
      if (result && this.contactToDelete) {
        const targetId = this.contactToDelete.id;
        this.contactService.deleteContact(targetId).subscribe({
          next: () => {
            const remaining = this.contactsSignal().filter(c => c.id !== targetId);
            this.contactService.setContacts(remaining);
            this.snackBar.open(
              this.translation.t('common.contact.delete.success'),
              this.translation.t('common.actions.ok'),
              { duration: 1500 }
            );
          },
          error: (err) => {
            const message = err?.message ?? this.translation.t('common.contact.delete.failed');
            this.snackBar.open(message, this.translation.t('common.actions.ok'));
          }
        });
        this.contactToDelete = undefined;
      }
    });
  }

  public editContact(contact: Contact) {
    const dialogRef = this.matDialog.open(ContactSettingsComponent, {
      data: { contact: contact },
      closeOnNavigation: true,
      maxHeight: '90vh',
      maxWidth: '90vw',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe(() => {
      this.contactService.updateContactName(contact);
      this.contactService.saveAditionalContactInfos();
    });
  }

  openTileList(contact: Contact): void {
    this.matDialog.open(TileListDialogComponent, {
      data: { contact },
      minWidth: 'min(500px, 95vw)',
      maxWidth: '95vw',
      width: 'min(900px, 95vw)',
      maxHeight: '95vh',
      height: 'auto',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }

  tileListAriaLabel(contact: Contact): string {
    const name = contact.name || this.translation.t('common.contact.list.nameFallback');
    return this.translation.t('common.tileList.openAria', { name });
  }

  public goBack() {
    this.dialogRef.close();
  }

  public subscribe(contact: Contact) {
    if (!this.userService.hasJwt()) {
      return;
    }
    if (Notification.permission !== "granted") {
      this.userService.registerSubscription(this.userService.getUser());
    }
    if (!contact.subscribed && Notification.permission === "granted") {
      // subscribe to place
      this.contactService.subscribe(contact);
    } else {
      // Unsubscribe from place.
      this.contactService.unsubscribe(contact);
    }
  }

  openSortDialog(): void {
    if (!this.userService.hasJwt()) {
      return;
    }
    const dialogRef = this.matDialog.open(ContactSortDialogComponent, {
      data: { contacts: this.contactsSignal() },
      minWidth: 'min(520px, 95vw)',
      maxWidth: '95vw',
      width: 'min(680px, 95vw)',
      maxHeight: '90vh',
      height: 'auto',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result?: { orderedIds?: string[] }) => {
      if (result?.orderedIds?.length) {
        this.contactService.updateContactOrder(result.orderedIds);
      }
    });
  }

  openContactChatroom(contact: Contact, focusMessageId?: string): void {
    if (!this.userService.hasJwt()) {
      return;
    }
    const dialogRef = this.matDialog.open(ContactChatroomComponent, {
      closeOnNavigation: true,
      data: {
        contactId: contact.id,
        focusMessageId
      },
      minWidth: 'min(600px, 95vw)',
      maxWidth: '95vw',
      width: 'max(600px, 95vw)',
      maxHeight: '95vh',
      height: 'auto',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe(() => {
      if (!this.userService.hasJwt()) {
        return;
      }
      // Nach dem Schließen neu laden, damit Badge/Unread stimmen (MarkRead passiert im Chatroom)
      this.contactMessageService.unreadCount(contact.id).subscribe({
        next: (res) => {
          this.unreadCounts.update((map: Record<string, number>) => ({ ...map, [contact.id]: res.unread ?? 0 }));
          contact.unreadCount = res.unread ?? 0;
        }
      });
      this.reloadLatestMessagePreview(contact);
    });
  }

  public shareConnectId(): void {
    if (!this.userService.hasJwt()) {
      return;
    }
    const user = this.userService.getUser();
    const encryptionPublicKey = user.cryptoKeyPair?.publicKey ? JSON.stringify(user.cryptoKeyPair.publicKey) : '';
    const signingPublicKey = user.signingKeyPair?.publicKey ? JSON.stringify(user.signingKeyPair.publicKey) : '';
    this.cryptoService.createSignature(user.signingKeyPair.privateKey, user.id)
      .then((signature: string) => {
        this.cryptoService.encrypt(user.cryptoKeyPair.publicKey, 'No hint')
          .then((encryptedHint: string) => {
            const connect: Connect = {
              id: '',
              userId: user.id,
              hint: encryptedHint,
              signature,
              encryptionPublicKey,
              signingPublicKey
            };
            this.connectService.createConnect(connect)
              .subscribe({
                next: createConnectResponse => {
                  if (createConnectResponse.status === 200) {
                    connect.id = createConnectResponse.connectId;

                    if (navigator.share) {
                      navigator.share({
                        title: this.translation.t('common.contact.connect.shareTitle'),
                        text: connect.id
                      }).catch(() => {
                        this.snackBar.open(
                          this.translation.t('common.contact.connect.shareCanceled'),
                          this.translation.t('common.actions.ok'),
                          { duration: 2000 }
                        );
                      });
                    } else {
                      navigator.clipboard.writeText(connect.id).then(() => {
                        this.snackBarRef = this.snackBar.open(
                          this.translation.t('common.contact.connect.copied'),
                          this.translation.t('common.actions.ok'),
                          { duration: 2500 }
                        );
                      }).catch(() => {
                        this.snackBar.open(
                          this.translation.t('common.contact.connect.copyFailed'),
                          this.translation.t('common.actions.ok'),
                          { duration: 2500 }
                        );
                      });
                    }
                  }
                },
                error: (err) => {
                  this.snackBarRef = this.snackBar.open(
                    err.message,
                    this.translation.t('common.actions.ok')
                  );
                }
              });
          });
      });
  }

  public openQrDialog() {
    if (!this.userService.hasJwt()) {
      return;
    }
    const user = this.userService.getUser();
    const encryptionPublicKey = user.cryptoKeyPair?.publicKey ? JSON.stringify(user.cryptoKeyPair.publicKey) : '';
    const signingPublicKey = user.signingKeyPair?.publicKey ? JSON.stringify(user.signingKeyPair.publicKey) : '';
    this.cryptoService.createSignature(user.signingKeyPair.privateKey, user.id)
      .then((signature: string) => {
        this.cryptoService.encrypt(user.cryptoKeyPair.publicKey, 'No hint')
          .then((encryptedHint: string) => {
            const connect: Connect = {
              id: '',
              userId: user.id,
              hint: encryptedHint,
              signature,
              encryptionPublicKey,
              signingPublicKey
            };
            this.connectService.createConnect(connect)
              .subscribe({
                next: createConnectResponse => {
                  if (createConnectResponse.status === 200) {
                    connect.id = createConnectResponse.connectId;
                    this.matDialog.open(QrcodeComponent, {
                      closeOnNavigation: true,
                      hasBackdrop: true,
                      backdropClass: 'dialog-backdrop',
                      disableClose: false,
                      data: { qrData: createConnectResponse.connectId }
                    });
                  }
                },
                error: (err) => {
                  this.snackBarRef = this.snackBar.open(
                    err.message,
                    this.translation.t('common.actions.ok')
                  );
                }
              });
          });
      });
  }

  private reloadLatestMessagePreview(contact: Contact): void {
    if (!this.userService.hasJwt()) {
      this.setLatestMessagePreviews(contact.id, []);
      this.previewRequestKeys.delete(contact.id);
      return;
    }

    const requestKey = `${contact.id}:${contact.lastMessageAt ?? ''}`;
    this.previewRequestKeys.delete(contact.id);
    this.previewRequestKeys.set(contact.id, requestKey);
    void this.loadLatestMessagePreview(contact, requestKey);
  }

  private async loadLatestMessagePreview(contact: Contact, requestKey: string): Promise<void> {
    try {
      const response = await firstValueFrom(this.contactMessageService.list(contact.id, { limit: 2 }));
      if (this.previewRequestKeys.get(contact.id) !== requestKey) {
        return;
      }

      const latestMessages = (response.rows ?? [])
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 2);

      if (latestMessages.length === 0) {
        this.setLatestMessagePreviews(contact.id, []);
        return;
      }

      const previews: ContactMessagePreview[] = [];
      for (const latestMessage of latestMessages) {
        const payload = await this.resolvePreviewPayload(contact, latestMessage);
        if (this.previewRequestKeys.get(contact.id) !== requestKey) {
          return;
        }
        previews.push(this.buildLatestMessagePreview(latestMessage, payload));
      }

      this.setLatestMessagePreviews(contact.id, previews);
    } catch {
      if (this.previewRequestKeys.get(contact.id) === requestKey) {
        this.setLatestMessagePreviews(contact.id, []);
      }
    }
  }

  private async applyIncomingLatestMessagePreview(contact: Contact, message: ContactMessage): Promise<void> {
    const payload = await this.resolvePreviewPayload(contact, message);
    this.previewRequestKeys.set(contact.id, `${contact.id}:${message.createdAt}`);
    const nextPreview = this.buildLatestMessagePreview(message, payload);
    this.latestMessagePreviews.update((current) => {
      const existing = current[contact.id] ?? [];
      const merged = [...existing.filter((entry) => entry.messageId !== nextPreview.messageId), nextPreview]
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 2);
      return { ...current, [contact.id]: merged };
    });
  }

  private async resolvePreviewPayload(contact: Contact, message: ContactMessage): Promise<ShortMessage | null> {
    if (message.message?.trim()) {
      const decrypted = await this.contactMessageService.decryptAndVerify(contact, message);
      if (decrypted) {
        return decrypted;
      }
    }

    return await this.contactMessageService.getLocalPayload(message.messageId);
  }

  private buildLatestMessagePreview(message: ContactMessage, payload: ShortMessage | null): ContactMessagePreview {
    return {
      messageId: message.messageId,
      createdAt: message.createdAt,
      text: this.resolvePreviewText(message, payload),
      outgoing: message.direction === 'user',
      status: message.status,
      payload
    };
  }

  private resolvePreviewText(message: ContactMessage, payload: ShortMessage | null): string {
    if (message.status === 'deleted') {
      return this.translation.t('common.contact.list.previewDeleted');
    }
    if (!payload) {
      return this.translation.t('common.contact.chatroom.messageUnreadable');
    }

    const translatedText = payload.translatedMessage?.trim();
    if (translatedText) {
      return this.normalizePreviewText(translatedText);
    }

    const plainText = payload.message?.trim();
    if (plainText) {
      return this.normalizePreviewText(plainText);
    }

    if (payload.audio) {
      return this.translation.t('common.contact.list.previewAudio');
    }

    if (payload.experience) {
      return this.normalizePreviewText(
        payload.experience.title?.trim()
        || payload.experience.productCode?.trim()
        || this.translation.t('common.contact.list.previewExperience')
      );
    }

    if (payload.location) {
      return this.normalizePreviewText(
        payload.location.plusCode?.trim()
        || this.translation.t('common.contact.list.previewLocation')
      );
    }

    const multimediaTitle = payload.multimedia?.title?.trim() || payload.multimedia?.description?.trim();
    if (multimediaTitle) {
      return this.normalizePreviewText(multimediaTitle);
    }

    if (payload.multimedia?.type && payload.multimedia.type !== 'undefined') {
      return this.translation.t('common.contact.list.previewMedia');
    }

    return this.translation.t('common.contact.chatroom.messageUnreadable');
  }

  private normalizePreviewText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private setLatestMessagePreviews(contactId: string, previews: ContactMessagePreview[]): void {
    this.latestMessagePreviews.update((current) => ({ ...current, [contactId]: previews }));
  }
}
