import { CommonModule } from '@angular/common';
import { Component, Signal, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { Connect } from '../../interfaces/connect';
import { Contact } from '../../interfaces/contact';
import { Envelope } from '../../interfaces/envelope';
import { Location } from '../../interfaces/location';
import { Mode } from '../../interfaces/mode';
import { Multimedia } from '../../interfaces/multimedia';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { ShortMessage } from '../../interfaces/short-message';
import { ConnectService } from '../../services/connect.service';
import { ContactService } from '../../services/contact.service';
import { CryptoService } from '../../services/crypto.service';
import { OembedService } from '../../services/oembed.service';
import { SharedContentService } from '../../services/shared-content.service';
import { SocketioService } from '../../services/socketio.service';
import { StyleService } from '../../services/style.service';
import { UserService } from '../../services/user.service';
import { ConnectComponent } from '../contact/connect/connect.component';
import { ContactEditMessageComponent } from '../contact/contact-edit-message/contact-edit-message.component';
import { ContactProfileComponent } from '../contact/contact-profile/contact-profile.component';
import { DeleteContactComponent } from '../contact/delete-contact/delete-contact.component';
import { ContactMessageChatroomComponent } from '../contact-message-chatroom/contact-message-chatroom.component';
import { QrcodeComponent } from '../utils/qrcode/qrcode.component';
import { ScannerComponent } from '../utils/scanner/scanner.component';

interface ConnectDialogResult {
  connectId?: string;
}

interface ContactEditMessageResult {
  contact: Contact;
  shortMessage: ShortMessage;
  lastLocation?: Location;
}

@Component({
  selector: 'app-contactlist',
  imports: [
    MatCardModule,
    CommonModule,
    MatButtonModule,
    MatDialogContent,
    MatIcon,
    MatMenuModule,
    MatExpansionModule
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
  readonly dialogRef = inject(MatDialogRef<ContactlistComponent>);
  readonly contactsSignal: Signal<Contact[]> = this.contactService.sortedContactsSignal;

  private contactToDelete?: Contact;
  public mode: typeof Mode = Mode;
  public subscriptionError = false;

  openConnectDialog(): void {
    const contact: Contact = {
      id: "",
      userId: this.userService.getUser().id,
      contactUserId: '',
      name: '',
      subscribed: false,
      pinned: false,
      provided: false,
      userMessage: {
        message: '',
        style: '',
        multimedia: {
          type: MultimediaType.UNDEFINED,
          url: '',
          sourceUrl: '',
          attribution: '',
          title: '',
          description: '',
          contentId: ''
        }
      },
      contactUserMessage: {
        message: '',
        style: '',
        multimedia: {
          type: MultimediaType.UNDEFINED,
          url: '',
          sourceUrl: '',
          attribution: '',
          title: '',
          description: '',
          contentId: ''
        }
      },
      lastMessageFrom: '',
      userMessageVerified: false,
      contactUserMessageVerified: false
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
      userMessage: {
        message: '',
        style: '',
        multimedia: {
          type: MultimediaType.UNDEFINED,
          url: '',
          sourceUrl: '',
          attribution: '',
          title: '',
          description: '',
          contentId: ''
        }
      },
      contactUserMessage: {
        message: '',
        style: '',
        multimedia: {
          type: MultimediaType.UNDEFINED,
          url: '',
          sourceUrl: '',
          attribution: '',
          title: '',
          description: '',
          contentId: ''
        }
      },
      lastMessageFrom: '',
      userMessageVerified: false,
      contactUserMessageVerified: false
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
        this.contactService.deleteContact(this.contactToDelete);
      }
    });
  }

  public editContact(contact: Contact) {
    const dialogRef = this.matDialog.open(ContactProfileComponent, {
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
    const dialogRef = this.matDialog.open(ContactMessageChatroomComponent, {
      closeOnNavigation: true,
      hasBackdrop: true,
      data: contact,
      minWidth: 'min(600px, 95vw)',
      maxWidth: '95vw',
      width: 'min(900px, 95vw)',
      height: '95vh',
      maxHeight: '95vh',
      autoFocus: false
    });

    const instance = dialogRef.componentInstance;
    if (instance) {
      const subscription = instance.composeMessage.subscribe((selectedContact) => {
        this.openContactMessagDialog(selectedContact);
      });
      dialogRef.afterClosed().subscribe(() => subscription.unsubscribe());
    }
  }

  async openContactMessagDialog(contact: Contact): Promise<void> {
    const lastMultimediaContent = await this.sharedContentService.getSharedContent('lastMultimedia');
    let lastMultimedia: Multimedia | undefined = undefined;
    if (undefined != lastMultimediaContent) {
      lastMultimedia = await this.oembedService.getObjectFromUrl(lastMultimediaContent.url) as Multimedia;
    }
    const lastLocationContent = await this.sharedContentService.getSharedContent('lastLocation');
    let lastLocation: Location | undefined = undefined;
    if (undefined != lastLocationContent) {
      lastLocation = await this.oembedService.getObjectFromUrl(lastLocationContent.url) as Location;
    }
    const shortMessage: ShortMessage = {
      message: '',
      style: '',
      multimedia: undefined != lastMultimedia ? lastMultimedia : {
        type: MultimediaType.UNDEFINED,
        url: '',
        sourceUrl: '',
        attribution: '',
        title: '',
        description: '',
        contentId: ''
      }
    };
    const dialogRef = this.matDialog.open(ContactEditMessageComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_SHORT_MESSAGE, contact: contact, shortMessage: shortMessage, lastLocation: lastLocation },
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result?: ContactEditMessageResult) => {
      if (result?.shortMessage) {
        // Create the enveolope
        const envelope: Envelope = {
          contactId: result.contact.id,
          userId: result.contact.userId,
          contactUserId: result.contact.contactUserId,
          messageSignature: '',
          userEncryptedMessage: '',
          contactUserEncryptedMessage: ''
        };
        const contactEncryptionKey = result.contact.contactUserEncryptionPublicKey;
        if (!contactEncryptionKey) {
          this.snackBar.open('Contact does not provide an encryption key yet. Please retry later.', 'OK', {
            duration: 2500
          });
          return;
        }

        this.cryptoService.createSignature(this.userService.getUser().signingKeyPair.privateKey, this.userService.getUser().id)
          .then((signature: string) => {
            envelope.messageSignature = signature;
            this.cryptoService.encrypt(this.userService.getUser().cryptoKeyPair.publicKey, JSON.stringify(result.shortMessage))
              .then((encryptedMessage: string) => {
                envelope.userEncryptedMessage = encryptedMessage;
                this.cryptoService.encrypt(contactEncryptionKey, JSON.stringify(result.shortMessage))
                  .then((encryptedMessage: string) => {
                    envelope.contactUserEncryptedMessage = encryptedMessage;
                    // Envelope is ready
                    this.contactService.updateContactMessage(envelope, result.contact, result.shortMessage, this.socketioService)
                  });
              });
          });
        this.sharedContentService.deleteSharedContent('last');
        this.sharedContentService.deleteSharedContent('lastMultimedia');
        this.sharedContentService.deleteSharedContent('lastLocation');
      }
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
                        title: 'MessageDrop – Share Connect-ID',
                        text: connect.id
                      }).catch(() => {
                        this.snackBar.open('Sharing was canceled.', 'OK', { duration: 2000 });
                      });
                    } else {
                      navigator.clipboard.writeText(connect.id).then(() => {
                        this.snackBarRef = this.snackBar.open(
                          'The Connect-ID has been copied to your clipboard.',
                          'OK',
                          { duration: 2500 }
                        );
                      }).catch(() => {
                        this.snackBar.open('Copying failed. Please use QR-Code to connect.', 'OK', { duration: 2500 });
                      });
                    }
                  }
                },
                error: (err) => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); }
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
                error: (err) => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); }
              });
          });
      });
  }

}
