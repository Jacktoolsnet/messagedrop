import { environment } from '../../environments/environment';
import { Injectable } from '@angular/core';
import { SocketIoConfig, Socket } from 'ngx-socket-io';
import { Contact } from '../interfaces/contact';
import { ContactService } from './contact.service';
import { User } from '../interfaces/user';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root',
})

export class SocketioService {
  private socket: Socket;
  private ioConfig: SocketIoConfig = { url: `${environment.apiUrl}`, options: { transports: ['websocket'] } };
  private connected: boolean = false;
  private user!: User;

  constructor(
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
          console.log(payload);
          console.log(this.user);
          // Request to provide profile information.
          this.requestProfileForContact();
          break;
      }
    });    
  }

  public requestProfileForContact() {
    console.log('requestProfileForContact init')
    this.socket.on(`requestProfileForContact:${this.user.id}`, (payload: { status: number, contact: Contact }) => {
      console.log('requestProfileForContact event')
      payload.contact.name = this.user.name;
      payload.contact.base64Avatar = this.user.base64Avatar
      this.socket.emit('contact:provideUserProfile', payload.contact);
      //this.socket.emit('contact:sendUserProfile', undefined);
    });
  }

  public receiveProfileForContactEvent(contact: Contact) {
    console.log('receiveProfileForContactEvent init')
    this.socket.on(`receiveProfileForContact:${contact.id}`, (payload: { status: number, contact: Contact }) => {
      console.log("receiveProfileForContactEvent event")
      if (payload.status == 200) {
        contact.name = payload.contact.name;
        contact.base64Avatar = payload.contact.base64Avatar;
        // this.contactService.saveContact(contact);
      } else {
        this.snackBar.open("The contact does not want to provide his profile information.", "Ok", {
          panelClass: ['snack-warning'],
          horizontalPosition: 'center',
          verticalPosition: 'top',
        });
      }
    });
  }

}
