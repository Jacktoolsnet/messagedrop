import { environment } from '../../environments/environment';
import { Injectable } from '@angular/core';
import { SocketIoConfig, Socket } from 'ngx-socket-io';
import { Contact } from '../interfaces/contact';
import { ContactService } from './contact.service';
import { User } from '../interfaces/user';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ProfileConfirmRequestComponent } from '../components/user/profile-confirm-request/profile-confirm-request.component';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root',
})

export class SocketioService {
  private socket: Socket;
  private ioConfig: SocketIoConfig = { url: `${environment.apiUrl}`, options: { transports: ['websocket'] } };
  private ready: boolean = false;
  private joinedUserRoom: boolean = false;

  constructor(
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private userService: UserService,
    private contactService: ContactService
  ) {
    this.socket = new Socket(this.ioConfig);
    this.socket.on("connect", () => {
      this.ready = this.socket.ioSocket.connected;
    });
    this.socket.on("disconnect", () => {
      this.ready = false;
    });
    this.initUser()
    this.initContacts();
  }

  async initUser() {
    while (!this.userService.isReady()) {
      await new Promise(f => setTimeout(f, 500));
    }
    this.initUserSocketEvents();
  }

  async initContacts() {
    while (!this.contactService.isReady()) {
      await new Promise(f => setTimeout(f, 500));
    }
    this.contactService.getContacts().forEach((contact: Contact) => {
      this.receiveShorMessage(contact);
    });
  }

  public getSocket(): Socket {
    return this.socket
  }

  public connect() {
    this.socket.connect();
  }

  public disconnect() {
    this.socket.disconnect();
  }

  public isReady(): boolean {
    return this.ready;
  }

  public hasJoinedUserRoom(): boolean {
    return this.joinedUserRoom;
  }

  public initUserSocketEvents() {
    // Error handling
    this.socket.on("connect_error", (err: any) => {
      // the reason of the error, for example "xhr poll error"
      console.log(err.message);

      // some additional description, for example the status code of the initial HTTP response
      console.log(err.description);

      // some additional context, for example the XMLHttpRequest object
      console.log(err.context);
    });
    // User room.
    this.socket.emit('user:joinUserRoom', this.userService.getUser().id);
    this.socket.on(`${this.userService.getUser().id}`, (payload: { status: number, type: String, content: any }) => {
      switch (payload.type) {
        case 'joined':
          this.joinedUserRoom = true;
          console.log(payload);
          /**this.snackBar.open(`Joined user room. (${payload.status})`, "", {
            panelClass: ['snack-info'],
            horizontalPosition: 'center',
            verticalPosition: 'top',
            duration: 2000
          });**/
          // Request to provide profile information.
          this.requestProfileForContact();
          break;
      }
    });
  }

  public requestProfileForContact() {
    // console.log('requestProfileForContact init')
    this.socket.on(`requestProfileForContact:${this.userService.getUser().id}`, (payload: { status: number, contact: Contact }) => {
      // console.log('requestProfileForContact event')
      const dialogRef = this.dialog.open(ProfileConfirmRequestComponent, {
        data: { contact: payload.contact },
        closeOnNavigation: true,
        hasBackdrop: true
      });

      dialogRef.afterOpened().subscribe(e => {
      });

      dialogRef.afterClosed().subscribe(result => {
        if (result) {
          payload.contact.name = this.userService.getUser().name;
          payload.contact.base64Avatar = this.userService.getUser().base64Avatar;
          payload.contact.provided = true;
          this.socket.emit('contact:provideUserProfile', payload.contact);
        } else {
          payload.contact.name = '';
          payload.contact.base64Avatar = '';
          payload.contact.provided = false;
          this.socket.emit('contact:provideUserProfile', payload.contact);
        }
      });
    });
  }

  public receiveProfileForContactEvent(contact: Contact) {
    // console.log('receiveProfileForContactEvent init')
    this.socket.on(`receiveProfileForContact:${contact.id}`, (payload: { status: number, contact: Contact }) => {
      // console.log("receiveProfileForContactEvent event")
      if (payload.status == 200) {
        contact.name = payload.contact.name;
        contact.base64Avatar = payload.contact.base64Avatar;
        this.contactService.updateContactProfile(contact);
      } else {
        this.snackBar.open("The contact declined the profile information request.", "Ok", {
          panelClass: ['snack-warning'],
          horizontalPosition: 'center',
          verticalPosition: 'top',
        });
      }
    });
  }

  public sendShortMessageToContact(contact: Contact) {
    // console.log('sendShortMessageToContact')
    this.socket.emit('contact:newShortMessage', contact);
  }

  public receiveShorMessage(contact: Contact) {
    // console.log('receiveShorMessage init')
    this.socket.on(`receiveShorMessage:${contact.contactUserId}`, (payload: { status: number, contact: Contact }) => {
      // console.log("receiveShorMessage event")
      if (payload.status == 200) {
        contact.contactUserMessage = payload.contact.userMessage;
        contact.contactUserMessageStyle = payload.contact.userMessageStyle;
        contact.lastMessageFrom = 'contactUser';
      }
    });
  }

}
