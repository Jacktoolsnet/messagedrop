import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MatDialog, MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContainer, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Animation } from '../../interfaces/animation';
import { Contact } from '../../interfaces/contact';
import { Mode } from '../../interfaces/mode';
import { User } from '../../interfaces/user';
import { StyleService } from '../../services/style.service';
import { PlacelistComponent } from '../placelist/placelist.component';
import { CommonModule } from '@angular/common';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { ConnectComponent } from '../contact/connect/connect.component';
import { ConnectService } from '../../services/connect.service';
import { Buffer } from 'buffer';
import { CryptoService } from '../../services/crypto.service';
import { ContactService } from '../../services/contact.service';
import { ContactProfileComponent } from '../contact/profile/profile.component';
import { DeleteContactComponent } from '../contact/delete-contact/delete-contact.component';
import { UserService } from '../../services/user.service';
import { MessageComponent } from '../message/message.component';
import { ContactMessageComponent } from '../contact/message/message.component';
import { ShortMessage } from '../../interfaces/short-message';
import { SocketioService } from '../../services/socketio.service';

@Component({
  selector: 'app-contactlist',
  standalone: true,
  imports: [
    MatBadgeModule,
    MatCardModule,
    MatDialogContainer,
    CommonModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogClose,
    MatDialogTitle,
    MatDialogContent,
    MatIcon,
    MatMenuModule,
  ],
  templateUrl: './contactlist.component.html',
  styleUrl: './contactlist.component.css'
})
export class ContactlistComponent implements OnInit {
  public contacts!: Contact[];
  private contactToDelete!: Contact
  public user!: User;
  public animation!: Animation;
  public mode: typeof Mode = Mode;
  private snackBarRef: any;
  public subscriptionError: boolean = false;

  constructor(
    private userService: UserService,
    private socketioService: SocketioService,
    private connectService: ConnectService,
    private contactService: ContactService,
    private cryptoService: CryptoService,
    public dialogRef: MatDialogRef<PlacelistComponent>,
    public contactMessageDialog: MatDialog,
    public connectDialog: MatDialog,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private style: StyleService,
    @Inject(MAT_DIALOG_DATA) public data: { user: User, contacts: Contact[] }
  ) {
    this.user = data.user;
    this.contacts = data.contacts;
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
      lastMessageFrom: ''
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
        this.connectService.getById(data.connectId)
          .subscribe({
            next: getConnectResponse => {
              if (getConnectResponse.status === 200) {
                let buffer = Buffer.from(JSON.parse(getConnectResponse.connect.signature))
                var signature = buffer.buffer.slice(
                  buffer.byteOffset, buffer.byteOffset + buffer.byteLength
                )
                // Informations from connect record.
                data.contact.contactUserId = getConnectResponse.connect.userId;
                data.contact.hint = getConnectResponse.connect.hint;
                data.contact.encryptionPublicKey = JSON.parse(getConnectResponse.connect.encryptionPublicKey);
                data.contact.signingPublicKey = JSON.parse(getConnectResponse.connect.signingPublicKey);
                data.contact.signature = signature;
                // For Development check equal. Change to not equal for production.
                if (data.contact.contactUserId != data.contact.userId) {
                  // Verify data
                  this.cryptoService.verifySignature(data.contact.signingPublicKey, data.contact.contactUserId, data.contact.signature)
                    .then((valid: Boolean) => {
                      if (valid) {
                        this.snackBarRef = this.snackBar.open(`Connect data is valid.`, 'OK');
                        // Generate Id
                        this.contactService.createContact(data.contact)
                          .subscribe({
                            next: createContactResponse => {
                              if (createContactResponse.status === 200) {
                                data.contact.id = createContactResponse.contactId;
                                this.contacts.unshift(data.contact);
                                this.contactService.updateContactProfile(data.contact)
                                  .subscribe({
                                    next: simpleStatusResponse => { },
                                    error: (err) => { },
                                    complete: () => { }
                                  });
                                this.snackBarRef = this.snackBar.open(`Contact succesfully created.`, '', { duration: 1000 });
                              }
                            },
                            error: (err) => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); },
                            complete: () => { }
                          });
                        // Delete connect record
                        this.connectService.deleteConnect(getConnectResponse.connect)
                          .subscribe({
                            next: (simpleStatusResponse) => {
                              if (simpleStatusResponse.status === 200) { }
                            },
                            error: (err) => {
                            },
                            complete: () => { }
                          });
                        this.snackBarRef = this.snackBar.open(`Contact succesfully created.`, '', { duration: 1000 });
                      } else {
                        this.snackBarRef = this.snackBar.open(`Connect data is invalid.`, 'OK');
                      }
                    });
                } else {
                  // Delete connect record
                  this.connectService.deleteConnect(getConnectResponse.connect)
                    .subscribe({
                      next: (simpleStatusResponse) => {
                        if (simpleStatusResponse.status === 200) { }
                      },
                      error: (err) => {
                      },
                      complete: () => { }
                    });
                  this.snackBarRef = this.snackBar.open(`It is not possible to add my user to the contact list`, 'OK');
                }
              }
            },
            error: (err) => { this.snackBarRef = this.snackBar.open(`Connect id not found.`, 'OK'); },
            complete: () => { }
          });
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
        this.contactService.deleteContact(this.contactToDelete)
          .subscribe({
            next: (simpleStatusResponse) => {
              if (simpleStatusResponse.status === 200) { }
            },
            error: (err) => {
            },
            complete: () => { }
          });
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
        this.contactService.updateContactProfile(contact)
          .subscribe({
            next: simpleStatusResponse => { },
            error: (err) => { },
            complete: () => { }
          });
      }
    });
  }

  public goBack() {
    this.dialogRef.close();
  }

  public subscribe(contact: Contact) {
    this.userService.registerSubscription(this.user);
    if (!contact.subscribed && this.user.subscribed) {
      // subscribe to place
      this.contactService.subscribe(contact)
        .subscribe({
          next: (simpleStatusResponse) => {
            if (simpleStatusResponse.status === 200) {
              contact.subscribed = true;
            }
          },
          error: (err) => { },
          complete: () => { }
        });
    } else {
      // Unsubscribe from place.
      this.contactService.unsubscribe(contact)
        .subscribe({
          next: (simpleStatusResponse) => {
            if (simpleStatusResponse.status === 200) {
              contact.subscribed = false;
            }
          },
          error: (err) => {
          },
          complete: () => { }
        });
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
        console.log('send short message');
        this.contactService.updateContactMessage(data?.contact, data?.shortMessage)
          .subscribe({
            next: simpleStatusResponse => {
              data.contact.userMessage = data.shortMessage.message;
              data.contact.userMessageStyle = data.shortMessage.style;
              data.contact.lastMessageFrom = 'user';
              this.socketioService.sendShortMessageToContact(data.contact);
            },
            error: (err) => { },
            complete: () => { }
          });
      }
    });
  }

}
