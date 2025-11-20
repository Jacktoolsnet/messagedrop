import { ApplicationRef, Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Buffer } from 'buffer';
import { Socket, SocketIoConfig } from 'ngx-socket-io';
import { environment } from '../../environments/environment';
import { ProfileConfirmRequestComponent } from '../components/user/profile-confirm-request/profile-confirm-request.component';
import { Contact } from '../interfaces/contact';
import { Envelope } from '../interfaces/envelope';
import { MultimediaType } from '../interfaces/multimedia-type';
import { ShortMessage } from '../interfaces/short-message';
import { ContactService } from './contact.service';
import { CryptoService } from './crypto.service';
import { UserService } from './user.service';

interface UserRoomPayload {
  status: number;
  type: string;
  content?: unknown;
}

interface ProfileRequestPayload {
  status: number;
  contact: Contact;
}

@Injectable({
  providedIn: 'root',
})

export class SocketioService {
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly userService = inject(UserService);
  private readonly contactService = inject(ContactService);
  private readonly cryptoService = inject(CryptoService);
  private readonly appRef = inject(ApplicationRef);

  private socket: Socket;
  private readonly ioConfig: SocketIoConfig = {
    url: `${environment.socketIoUrl}`,
    options: {
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      transports: ['websocket'],
      withCredentials: true
    }
  };
  private ready = false;
  private joinedUserRoom = false;

  constructor() {
    this.socket = new Socket(this.ioConfig, this.appRef);
    this.registerConnectionHandlers();
  }

  private registerConnectionHandlers(): void {
    this.socket.on("connect", () => {
      this.ready = this.socket.ioSocket.connected;
      /*this.snackBar.open('connect', '', {
        panelClass: ['snack-info'],
        horizontalPosition: 'center',
        verticalPosition: 'top',
        duration: 1000
      });*/
    });

    this.socket.on("connect_error", (error: Error) => {
      console.error('Socket connection error', error);
      /*this.snackBar.open(err.message, "", {
        panelClass: ['snack-warning'],
        horizontalPosition: 'center',
        verticalPosition: 'top',
        duration: 1000
      });*/
    });

    this.socket.on("disconnect", () => {
      this.ready = this.socket.ioSocket.connected;
      /*this.snackBar.open('disconnect', '', {
        panelClass: ['snack-warning'],
        horizontalPosition: 'center',
        verticalPosition: 'top',
        duration: 1000
      });*/
    });

    this.socket.on('reconnect_attempt', (attempt) => {
      this.ready = this.socket.ioSocket.connected;
      console.info(`Socket reconnect attempt #${attempt}`);
      /*this.snackBar.open(`Reconnection attempt #${attempt}`, '', {
        panelClass: ['snack-info'],
        horizontalPosition: 'center',
        verticalPosition: 'top',
        duration: 1000
      });*/
    });

    this.socket.on('reconnect', () => {
      this.ready = this.socket.ioSocket.connected;
      /*this.snackBar.open('Reconnected successfully!', '', {
        panelClass: ['snack-info'],
        horizontalPosition: 'center',
        verticalPosition: 'top',
        duration: 1000
      });*/
    });

    this.socket.on('reconnect_failed', () => {
      this.ready = this.socket.ioSocket.connected;
      /*this.snackBar.open('Reconnection failed', '', {
        panelClass: ['snack-warning'],
        horizontalPosition: 'center',
        verticalPosition: 'top',
        duration: 1000
      });*/
    });
  }

  initSocket() {
    this.initUserSocketEvents();
    this.initContacts();
  }

  async initContacts(): Promise<void> {
    this.contactService.contactsSignal().forEach((contact: Contact) => {
      this.receiveContactMessage(contact);
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

  public initUserSocketEvents(): void {
    // User room.
    this.socket.emit('user:joinUserRoom', this.userService.getUser().id);
    this.socket.on(`${this.userService.getUser().id}`, (payload: UserRoomPayload) => {
      switch (payload.type) {
        case 'joined':
          this.joinedUserRoom = true;
          /*this.snackBar.open(`Joined user room.`, "", {
            panelClass: ['snack-info'],
            horizontalPosition: 'center',
            verticalPosition: 'top',
            duration: 1000
          });*/
          // Request to provide profile information.
          this.requestProfileForContact();
          break;
      }
    });
  }

  public requestProfileForContact(): void {
    const eventName = `requestProfileForContact:${this.userService.getUser().id}`;
    this.socket.off(eventName);
    this.socket.on(eventName, (payload: ProfileRequestPayload) => {
      this.cryptoService.decrypt(this.userService.getUser().cryptoKeyPair.privateKey, JSON.parse(payload.contact.hint!))
        .then((hint: string) => {
          if (hint !== '') {
            payload.contact.hint = hint;
          } else {
            payload.contact.hint = 'Hint cannot be decrypted!';
          }
          const dialogRef = this.dialog.open(ProfileConfirmRequestComponent, {
            data: { contact: payload.contact },
            closeOnNavigation: true,
            hasBackdrop: true
          });

          dialogRef.afterClosed().subscribe(result => {
            if (result) {
              payload.contact.name = this.userService.getProfile().name;
              payload.contact.base64Avatar = this.userService.getProfile().base64Avatar;
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
    });
  }

  public receiveProfileForContactEvent(contact: Contact): void {
    this.socket.on(`receiveProfileForContact:${contact.id}`, (payload: { status: number, contact: Contact }) => {
      if (payload.status == 200) {
        contact.name = payload.contact.name !== '' ? payload.contact.name : "Not set";
        contact.base64Avatar = payload.contact.base64Avatar !== '' ? payload.contact.base64Avatar : undefined;
        this.contactService.saveAditionalContactInfos();
      } else {
        this.snackBar.open("The contact declined the profile information request.", "Ok", {
          panelClass: ['snack-warning'],
          horizontalPosition: 'center',
          verticalPosition: 'top',
        });
      }
    });
  }

  public sendContactMessage(envelope: Envelope) {
    this.socket.emit('contact:newContactMessage', envelope);
  }

  public receiveContactMessage(contact: Contact) {
    const eventName = `receiveContactMessage:${contact.userId}`;
    this.socket.off(eventName);
    this.socket.on(eventName, (payload: { status: number, envelope: Envelope }) => {
      if (payload.status == 200) {
        let messageSignatureBuffer = undefined;
        let messageSignature = undefined;
        messageSignatureBuffer = Buffer.from(JSON.parse(payload.envelope.messageSignature))
        messageSignature = messageSignatureBuffer.buffer.slice(
          messageSignatureBuffer.byteOffset, messageSignatureBuffer.byteOffset + messageSignatureBuffer.byteLength
        )
        this.cryptoService.verifySignature(contact.contactUserSigningPublicKey!, payload.envelope.userId, messageSignature)
          .then((valid: boolean) => {
            if (valid) {
              (contact as unknown as { contactUserMessageVerified?: boolean }).contactUserMessageVerified = true;
              if (payload.envelope.contactUserEncryptedMessage) {
                this.cryptoService.decrypt(this.userService.getUser().cryptoKeyPair.privateKey, JSON.parse(payload.envelope.contactUserEncryptedMessage))
                  .then((message: string) => {
                    if (message !== '') {
                      (contact as unknown as { contactUserMessage?: ShortMessage }).contactUserMessage = JSON.parse(message);
                      // contact.contactUserMessageStyle = payload.envelope.messageStyle;
                      contact.lastMessageFrom = 'contactUser';
                    } else {
                      const errorMessage: ShortMessage = {
                        message: 'Message cannot be decrypted!',
                        multimedia: {
                          type: MultimediaType.UNDEFINED,
                          attribution: '',
                          title: '',
                          description: '',
                          url: '',
                          sourceUrl: '',
                          contentId: ''
                        },
                        style: ''
                      };
                      (contact as unknown as { contactUserMessage?: ShortMessage }).contactUserMessage = errorMessage;
                      // contact.contactUserMessageStyle = payload.envelope.messageStyle;
                      contact.lastMessageFrom = 'contactUser';
                    }
                    this.contactService.refreshContact(contact.id);
                  });
              }
            } else {
              (contact as unknown as { contactUserMessageVerified?: boolean }).contactUserMessageVerified = false;
              const errorMessage: ShortMessage = {
                message: 'ignature could not be verified!',
                multimedia: {
                  type: MultimediaType.UNDEFINED,
                  attribution: '',
                  title: '',
                  description: '',
                  url: '',
                  sourceUrl: '',
                  contentId: ''
                },
                style: ''
              };
              (contact as unknown as { contactUserMessage?: ShortMessage }).contactUserMessage = errorMessage;
              // contact.contactUserMessageStyle = payload.envelope.messageStyle;
              contact.lastMessageFrom = 'contactUser';
              this.contactService.refreshContact(contact.id);
            }
          });
      }
    });
  }

  public sendUpdatedContactMessage(envelope: Envelope) {
    this.socket.emit('contact:updateContactMessage', envelope);
  }

  public sendDeletedContactMessage(payload: { contactId: string; userId: string; contactUserId: string; messageId: string }) {
    this.socket.emit('contact:deleteContactMessage', payload);
  }

}
