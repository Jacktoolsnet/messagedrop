import { Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MatDialog, MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContainer, MatDialogContent, MatDialogTitle } from '@angular/material/dialog';
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
import { ContactService } from '../../services/contact.service';
import { ContactProfileComponent } from '../contact/profile/profile.component';
import { DeleteContactComponent } from '../contact/delete-contact/delete-contact.component';
import { UserService } from '../../services/user.service';
import { ContactMessageComponent } from '../contact/message/message.component';
import { ShortMessage } from '../../interfaces/short-message';
import { SocketioService } from '../../services/socketio.service';
import { ScannerComponent } from '../utils/scanner/scanner.component';

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
    public dialogRef: MatDialogRef<PlacelistComponent>,
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
      lastMessageFrom: ''
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
    if (!contact.subscribed && this.user.subscribed) {
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
        this.contactService.updateContactMessage(data?.contact, data?.shortMessage, this.socketioService)
      }
    });
  }

}
