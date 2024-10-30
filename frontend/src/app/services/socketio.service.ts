import { environment } from '../../environments/environment';
import { Injectable } from '@angular/core';
import { SocketIoConfig, Socket } from 'ngx-socket-io';
import { Contact } from '../interfaces/contact';
import { ContactService } from './contact.service';
import { User } from '../interfaces/user';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { ProfileConfirmRequestComponent } from '../components/user/profile-confirm-request/profile-confirm-request.component';

@Injectable({
  providedIn: 'root',
})

export class SocketioService {
  private socket: Socket;
  private ioConfig: SocketIoConfig = { url: `${environment.apiUrl}`, options: { transports: ['websocket'] } };
  private connected: boolean = false;
  private joinedUserRoom: boolean = false;
  private user!: User;

  constructor(
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private contactService: ContactService
  ) {
    this.socket = new Socket(this.ioConfig);
    this.socket.on("connect", () => {
      this.connected = this.socket.ioSocket.connected;
    });
    this.socket.on("disconnect", () => {
      this.connected = false;
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

  public isConnected(): boolean {
    return this.connected;
  }

  public hasJoinedUserRoom(): boolean {
    return this.joinedUserRoom;
  }

  public initSocketEvents(user: User) {
    this.user = user;
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
    this.socket.emit('user:joinUserRoom', user.id);
    this.socket.on(`${user.id}`, (payload: { status: number, type: String, content: any }) => {
      switch (payload.type) {
        case 'joined':
          this.joinedUserRoom = true;
          console.log(payload);
          this.snackBar.open(`Joined user room. (${payload.status})`, "", {
            panelClass: ['snack-info'],
            horizontalPosition: 'center',
            verticalPosition: 'top',
            duration: 2000
          });
          // Request to provide profile information.
          this.requestProfileForContact();
          break;
      }
    });
  }

  public requestProfileForContact() {
    // console.log('requestProfileForContact init')
    this.socket.on(`requestProfileForContact:${this.user.id}`, (payload: { status: number, contact: Contact }) => {
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
          payload.contact.name = this.user.name;
          payload.contact.base64Avatar = this.user.base64Avatar;
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
        this.contactService.updateContactProfile(contact)
          .subscribe({
            next: simpleStatusResponse => { },
            error: (err) => { },
            complete: () => { }
          });
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

  public receiveShorMessage(contact: Contact){
    // console.log('receiveShorMessage init')
    this.socket.on(`receiveShorMessage:${contact.contactUserId}`, (payload: { status: number, contact: Contact }) => {
      // console.log("receiveShorMessage event")
      if (payload.status == 200) {
        contact.contactUserMessage = payload.contact.userMessage;
        contact.contactUserMessageStyle = payload.contact.userMessageStyle;
      }
    });
  }

}
