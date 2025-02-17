import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Animation } from '../../interfaces/animation';
import { Contact } from '../../interfaces/contact';
import { Envelope } from '../../interfaces/envelope';
import { Mode } from '../../interfaces/mode';
import { ShortMessage } from '../../interfaces/short-message';
import { User } from '../../interfaces/user';
import { ConnectService } from '../../services/connect.service';
import { ContactService } from '../../services/contact.service';
import { CryptoService } from '../../services/crypto.service';
import { SocketioService } from '../../services/socketio.service';
import { StyleService } from '../../services/style.service';
import { UserService } from '../../services/user.service';
import { ConnectComponent } from '../contact/connect/connect.component';
import { DeleteContactComponent } from '../contact/delete-contact/delete-contact.component';
import { ContactMessageComponent } from '../contact/message/message.component';
import { ContactProfileComponent } from '../contact/profile/profile.component';
import { ScannerComponent } from '../utils/scanner/scanner.component';

@Component({
  selector: 'app-contactlist',
  imports: [
    MatBadgeModule,
    MatCardModule,
    CommonModule,
    MatButtonModule,
    MatDialogContent,
    MatIcon,
    MatMenuModule,
  ],
  templateUrl: './contactlist.component.html',
  styleUrl: './contactlist.component.css'
})
export class ContactlistComponent implements OnInit {
  private contactToDelete!: Contact
  public user!: User;
  public animation!: Animation;
  public mode: typeof Mode = Mode;
  public subscriptionError: boolean = false;

  constructor(
    private userService: UserService,
    public socketioService: SocketioService,
    private connectService: ConnectService,
    public contactService: ContactService,
    private cryptoService: CryptoService,
    public dialogRef: MatDialogRef<any>,
    public contactMessageDialog: MatDialog,
    public connectDialog: MatDialog,
    public scannerDialog: MatDialog,
    public dialog: MatDialog,
    private style: StyleService,
    @Inject(MAT_DIALOG_DATA) public data: { user: User, contacts: Contact[] }
  ) {
    this.user = data.user;
  }

  ngOnInit(): void {
    this.animation = this.style.getRandomColorAnimation();
  }

  openConnectDialog(): void {
    let contact: Contact = {
      id: "",
      userId: this.user.id,
      contactUserId: '',
      name: '',
      subscribed: false,
      provided: false,
      userMessage: '',
      userMessageStyle: '',
      contactUserMessage: '',
      contactUserMessageStyle: '',
      lastMessageFrom: '',
      userMessageVerified: false,
      contactUserMessageVerified: false
    };
    const dialogRef = this.connectDialog.open(ConnectComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_CONNECT, contact: contact, connectId: "" },
      width: '90vw',
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: 'auto',
      height: 'auto',
      maxHeight: '90vh',
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.contact) {
        this.connectService.getById(data.connectId, data.contact, this.socketioService);
      }
    });
  }

  openScannerDialog(): void {
    let contact: Contact = {
      id: "",
      userId: this.user.id,
      contactUserId: '',
      hint: 'QR-Code',
      name: '',
      subscribed: false,
      provided: false,
      userMessage: '',
      userMessageStyle: '',
      contactUserMessage: '',
      contactUserMessageStyle: '',
      lastMessageFrom: '',
      userMessageVerified: false,
      contactUserMessageVerified: false
    };

    const dialogRef = this.scannerDialog.open(ScannerComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_CONNECT, contact: contact, connectId: "" },
      width: '90vw',
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: 'auto',
      height: 'auto',
      maxHeight: '90vh',
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.contact) {
        this.contactService.createContact(data?.contact, this.socketioService);
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
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe(result => {
      if (true) {
        this.contactService.updateContactProfile(contact);
      }
    });
  }

  public goBack() {
    this.dialogRef.close();
  }

  public subscribe(contact: Contact) {
    if (Notification.permission !== "granted") {
      this.userService.registerSubscription(this.user);
    }
    if (!contact.subscribed && Notification.permission === "granted") {
      // subscribe to place
      this.contactService.subscribe(contact);
    } else {
      // Unsubscribe from place.
      this.contactService.unsubscribe(contact);
    }
  }

  public openContactMessagDialog(contact: Contact): void {
    let shortMessage: ShortMessage = {
      message: '',
      style: ''
    };
    const dialogRef = this.contactMessageDialog.open(ContactMessageComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_SHORT_MESSAGE, user: this.user, contact: contact, shortMessage: shortMessage },
      width: '90vw',
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: '90vh',
      height: '90vh',
      maxHeight: '90vh',
      hasBackdrop: true
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
          contactUserEncryptedMessage: '',
          messageStyle: data?.shortMessage.style
        };
        this.cryptoService.createSignature(this.userService.getUser().signingKeyPair.privateKey, this.userService.getUser().id)
          .then((signature: string) => {
            envelope.messageSignature = signature;
            this.cryptoService.encrypt(this.userService.getUser().encryptionKeyPair.publicKey, data?.shortMessage.message)
              .then((encryptedMessage: string) => {
                envelope.userEncryptedMessage = encryptedMessage;
                this.cryptoService.encrypt(data?.contact.contactUserEncryptionPublicKey, data?.shortMessage.message)
                  .then((encryptedMessage: string) => {
                    envelope.contactUserEncryptedMessage = encryptedMessage;
                    // Envelope is ready
                    this.contactService.updateContactMessage(envelope, data?.contact, data?.shortMessage, this.socketioService)
                  });
              });
          });
      }
    });
  }

}
