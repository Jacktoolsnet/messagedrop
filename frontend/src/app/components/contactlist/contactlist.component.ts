import { CommonModule } from '@angular/common';
import { Component, Signal, effect, inject, signal } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { Connect } from '../../interfaces/connect';
import { Contact } from '../../interfaces/contact';
import { Mode } from '../../interfaces/mode';
import { ConnectService } from '../../services/connect.service';
import { ContactMessageService } from '../../services/contact-message.service';
import { ContactService } from '../../services/contact.service';
import { CryptoService } from '../../services/crypto.service';
import { OembedService } from '../../services/oembed.service';
import { SharedContentService } from '../../services/shared-content.service';
import { SocketioService } from '../../services/socketio.service';
import { StyleService } from '../../services/style.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { ContactChatroomComponent } from '../contact-chatroom/contact-chatroom.component';
import { ConnectComponent } from '../contact/connect/connect.component';
import { ContactSettingsComponent } from '../contact/contact-setting/contact-settings.component';
import { DeleteContactComponent } from '../contact/delete-contact/delete-contact.component';
import { TileListDialogComponent } from "../tile/tile-list-dialog/tile-list-dialog.component";
import { QrcodeComponent } from '../utils/qrcode/qrcode.component';
import { ScannerComponent } from '../utils/scanner/scanner.component';

interface ConnectDialogResult {
  connectId?: string;
}

@Component({
  selector: 'app-contactlist',
  imports: [
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
  styleUrl: './contactlist.component.css'
})
export class ContactlistComponent {
  private snackBarRef?: MatSnackBarRef<SimpleSnackBar>;
  public readonly userService = inject(UserService);
  public readonly socketioService = inject(SocketioService);
  public readonly contactService = inject(ContactService);
  private readonly connectService = inject(ConnectService);
  private readonly cryptoService = inject(CryptoService);
  private readonly oembedService = inject(OembedService);
  private readonly sharedContentService = inject(SharedContentService);
  private readonly style = inject(StyleService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly matDialog = inject(MatDialog);
  private readonly contactMessageService = inject(ContactMessageService);
  private readonly translation = inject(TranslationHelperService);
  readonly dialogRef = inject(MatDialogRef<ContactlistComponent>);
  readonly contactsSignal: Signal<Contact[]> = this.contactService.sortedContactsSignal;
  readonly unreadCounts = signal<Record<string, number>>({});
  private readonly unreadLoaded = new Set<string>();

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
      if (update) {
        this.unreadCounts.update((map: Record<string, number>) => ({ ...map, [update.contactId]: update.unread }));
        const contact = this.contactsSignal().find((c) => c.id === update.contactId);
        if (contact) {
          contact.unreadCount = update.unread;
        }
        this.contactMessageService.unreadCountUpdate.set(null);
      }
    });
  }

  getUnreadBadge(contactId: string): string {
    const count = this.unreadCounts()[contactId] ?? 0;
    if (!count) {
      return '';
    }
    return count > 99 ? '99+' : `${count}`;
  }

  openConnectDialog(): void {
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
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result?: ConnectDialogResult) => {
      if (result?.connectId) {
        this.connectService.getById(result.connectId, contact, this.socketioService);
      }
    });
  }

  openScannerDialog(): void {
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
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result?: ConnectDialogResult) => {
      if (result?.connectId) {
        this.connectService.getById(result.connectId, contact, this.socketioService);
      }
    });
  }

  public deleteContact(contact: Contact) {
    this.contactToDelete = contact;
    const dialogRef = this.matDialog.open(DeleteContactComponent, {
      closeOnNavigation: true,
      hasBackdrop: true
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
      hasBackdrop: true
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
      maxHeight: '90vh',
      height: 'auto',
      hasBackdrop: true,
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

  public pinContact(contact: Contact) {
    contact.pinned = true;
    this.contactService.saveAditionalContactInfos();
    const updatedContacts = this.contactService.contactsSignal().map(c =>
      c.id === contact.id ? { ...c, pinned: true } : c
    );
    this.contactService.setContacts(updatedContacts);
  }

  public unpinContact(contact: Contact) {
    contact.pinned = false;
    this.contactService.saveAditionalContactInfos();
    const updatedContacts = this.contactService.contactsSignal().map(c =>
      c.id === contact.id ? { ...c, pinned: false } : c
    );
    this.contactService.setContacts(updatedContacts);
  }

  openContactChatroom(contact: Contact): void {
    const dialogRef = this.matDialog.open(ContactChatroomComponent, {
      closeOnNavigation: true,
      data: contact.id,
      minWidth: 'min(600px, 95vw)',
      maxWidth: '95vw',
      width: 'max(600px, 95vw)',
      maxHeight: '95vh',
      height: 'auto',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe(() => {
      // Nach dem Schließen neu laden, damit Badge/Unread stimmen (MarkRead passiert im Chatroom)
      this.contactMessageService.unreadCount(contact.id).subscribe({
        next: (res) => {
          this.unreadCounts.update((map: Record<string, number>) => ({ ...map, [contact.id]: res.unread ?? 0 }));
          contact.unreadCount = res.unread ?? 0;
        }
      });
    });
  }

  public shareConnectId(): void {
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

}
