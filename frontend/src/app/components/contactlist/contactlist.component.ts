import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit, Signal } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
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
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { ShowmessageComponent } from '../showmessage/showmessage.component';
import { QrcodeComponent } from '../utils/qrcode/qrcode.component';
import { ScannerComponent } from '../utils/scanner/scanner.component';

@Component({
  selector: 'app-contactlist',
  imports: [
    ShowmessageComponent,
    ShowmultimediaComponent,
    MatBadgeModule,
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
export class ContactlistComponent implements OnInit {
  private snackBarRef: any;
  public contactsSignal: Signal<Contact[]>;

  private contactToDelete!: Contact
  public mode: typeof Mode = Mode;
  public subscriptionError: boolean = false;

  constructor(
    public userService: UserService,
    public socketioService: SocketioService,
    private connectService: ConnectService,
    public contactService: ContactService,
    private cryptoService: CryptoService,
    private oembedService: OembedService,
    private sharedContentService: SharedContentService,
    public dialogRef: MatDialogRef<any>,
    public contactMessageDialog: MatDialog,
    public connectDialog: MatDialog,
    public scannerDialog: MatDialog,
    public qrDialog: MatDialog,
    public dialog: MatDialog,
    private style: StyleService,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: {}
  ) {
    this.contactsSignal = this.contactService.sortedContactsSignal;
  }

  ngOnInit(): void {
  }

  openConnectDialog(): void {
    let contact: Contact = {
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
    const dialogRef = this.connectDialog.open(ConnectComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_CONNECT, connectId: "" },
      minWidth: '20vw',
      maxWidth: '90vw',
      height: 'auto',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (data?.connectId !== '') {
        this.connectService.getById(data.connectId, contact, this.socketioService);
      }
    });
  }

  openScannerDialog(): void {
    let contact: Contact = {
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
    const dialogRef = this.scannerDialog.open(ScannerComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_CONNECT, connectId: "" },
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (data?.connectId && data?.connectId !== '') {
        this.connectService.getById(data.connectId, contact, this.socketioService);
      }
    });
  }

  public deleteContact(contact: Contact) {
    this.contactToDelete = contact;
    const dialogRef = this.dialog.open(DeleteContactComponent, {
      closeOnNavigation: true,
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && undefined != this.contactToDelete) {
        this.contactService.deleteContact(this.contactToDelete);
      }
    });
  }

  public editContact(contact: Contact) {
    const dialogRef = this.dialog.open(ContactProfileComponent, {
      data: { contact: contact },
      closeOnNavigation: true,
      maxHeight: '90vh',
      maxWidth: '90vw',
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
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

  async openContactMessagDialog(contact: Contact): Promise<void> {
    const lastMultimediaContent = await this.sharedContentService.getSharedContent('lastMultimedia');
    let lastMultimedia: Multimedia | undefined = undefined;
    if (undefined != lastMultimediaContent) {
      lastMultimedia = await this.oembedService.getObjectFromUrl(lastMultimediaContent!.url) as Multimedia;
    }
    const lastLocationContent = await this.sharedContentService.getSharedContent('lastLocation');
    let lastLocation: Location | undefined = undefined;
    if (undefined != lastLocationContent) {
      lastLocation = await this.oembedService.getObjectFromUrl(lastLocationContent!.url) as Location;
      if (undefined != lastLocation) {
      }
    }
    let shortMessage: ShortMessage = {
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
    const dialogRef = this.contactMessageDialog.open(ContactEditMessageComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_SHORT_MESSAGE, contact: contact, shortMessage: shortMessage, lastLocation: lastLocation },
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.shortMessage) {
        // Create the enveolope
        let envelope: Envelope = {
          contactId: data?.contact.id,
          userId: data?.contact.userId,
          contactUserId: data?.contact.contactUserId,
          messageSignature: '',
          userEncryptedMessage: '',
          contactUserEncryptedMessage: ''
        };
        this.cryptoService.createSignature(this.userService.getUser().signingKeyPair.privateKey, this.userService.getUser().id)
          .then((signature: string) => {
            envelope.messageSignature = signature;
            this.cryptoService.encrypt(this.userService.getUser().cryptoKeyPair.publicKey, JSON.stringify(data?.shortMessage))
              .then((encryptedMessage: string) => {
                envelope.userEncryptedMessage = encryptedMessage;
                this.cryptoService.encrypt(data?.contact.contactUserEncryptionPublicKey, JSON.stringify(data?.shortMessage))
                  .then((encryptedMessage: string) => {
                    envelope.contactUserEncryptedMessage = encryptedMessage;
                    // Envelope is ready
                    this.contactService.updateContactMessage(envelope, data?.contact, data?.shortMessage, this.socketioService)
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
    this.cryptoService.createSignature(this.userService.getUser().signingKeyPair.privateKey, this.userService.getUser().id)
      .then((signature: string) => {
        this.cryptoService.encrypt(this.userService.getUser().cryptoKeyPair.publicKey, 'No hint')
          .then((encryptedHint: string) => {
            let connect: Connect = {
              id: '',
              userId: this.userService.getUser().id,
              hint: encryptedHint,
              signature: signature,
              encryptionPublicKey: JSON.stringify(this.userService.getUser().cryptoKeyPair?.publicKey!),
              signingPublicKey: JSON.stringify(this.userService.getUser().signingKeyPair?.publicKey!)
            };
            this.connectService.createConnect(connect)
              .subscribe({
                next: createConnectResponse => {
                  if (createConnectResponse.status === 200) {
                    connect.id = createConnectResponse.connectId;;

                    if (navigator.share) {
                      navigator.share({
                        title: 'MessageDrop – Share Connect-ID',
                        text: connect.id
                      })
                        .then(() => { })
                        .catch((err) => { });
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
                error: (err) => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); },
                complete: () => { }
              });
          });
      });
  }

  public openQrDialog() {
    this.cryptoService.createSignature(this.userService.getUser().signingKeyPair.privateKey, this.userService.getUser().id)
      .then((signature: string) => {
        this.cryptoService.encrypt(this.userService.getUser().cryptoKeyPair.publicKey, 'No hint')
          .then((encryptedHint: string) => {
            let connect: Connect = {
              id: '',
              userId: this.userService.getUser().id,
              hint: encryptedHint,
              signature: signature,
              encryptionPublicKey: JSON.stringify(this.userService.getUser().cryptoKeyPair?.publicKey!),
              signingPublicKey: JSON.stringify(this.userService.getUser().signingKeyPair?.publicKey!)
            };
            this.connectService.createConnect(connect)
              .subscribe({
                next: createConnectResponse => {
                  if (createConnectResponse.status === 200) {
                    connect.id = createConnectResponse.connectId;
                    const dialogRef = this.dialog.open(QrcodeComponent, {
                      closeOnNavigation: true,
                      hasBackdrop: true,
                      data: { qrData: createConnectResponse.connectId }
                    });

                    dialogRef.afterOpened().subscribe({});

                    dialogRef.afterClosed().subscribe({});
                  }
                },
                error: (err) => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); },
                complete: () => { }
              });
          });
      });
  }

  hasContent(message?: ShortMessage): boolean {
    return !!message && (message.message?.trim() !== '' || message.multimedia?.type !== 'undefined');
  }

}
