import { Injectable } from '@angular/core';
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
    private contactService: ContactService,
    private cryptoService: CryptoService
  ) {
    this.socket = new Socket(this.ioConfig);
    this.socket.on("connect", () => {
      this.ready = this.socket.ioSocket.connected;
    });
    this.socket.on("disconnect", () => {
      this.ready = false;
    });
  }

  initSocket() {
    this.initUserSocketEvents();
    this.initContacts();
  }

  async initContacts() {
    this.contactService.getContacts().forEach((contact: Contact) => {
      this.receiveShortMessage(contact);
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
      // console.log(err.message);
      // some additional description, for example the status code of the initial HTTP response
      // console.log(err.description);
      // some additional context, for example the XMLHttpRequest object
      // console.log(err.context);
    });
    // User room.
    this.socket.emit('user:joinUserRoom', this.userService.getUser().id);
    this.socket.on(`${this.userService.getUser().id}`, (payload: { status: number, type: String, content: any }) => {
      switch (payload.type) {
        case 'joined':
          this.joinedUserRoom = true;
          /*this.snackBar.open(`Joined user room.`, "", {
            panelClass: ['snack-info'],
            horizontalPosition: 'center',
            verticalPosition: 'top',
            duration: 1000
          })*/;
          // Request to provide profile information.
          this.requestProfileForContact();
          break;
      }
    });
  }

  public requestProfileForContact() {
    this.socket.on(`requestProfileForContact:${this.userService.getUser().id}`, (payload: { status: number, contact: Contact }) => {
      this.cryptoService.decrypt(this.userService.getUser().encryptionKeyPair.privateKey, JSON.parse(payload.contact.hint!))
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
    });
  }

  public receiveProfileForContactEvent(contact: Contact) {
    this.socket.on(`receiveProfileForContact:${contact.id}`, (payload: { status: number, contact: Contact }) => {
      if (payload.status == 200) {
        contact.name = payload.contact.name;
        contact.base64Avatar = payload.contact.base64Avatar;
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

  public sendShortMessageToContact(envelope: Envelope) {
    this.socket.emit('contact:newShortMessage', envelope);
  }

  public receiveShortMessage(contact: Contact) {
    this.socket.on(`receiveShorMessage:${contact.contactUserId}`, (payload: { status: number, envelope: Envelope }) => {
      if (payload.status == 200) {
        let messageSignatureBuffer = undefined;
        let messageSignature = undefined;
        messageSignatureBuffer = Buffer.from(JSON.parse(payload.envelope.messageSignature))
        messageSignature = messageSignatureBuffer.buffer.slice(
          messageSignatureBuffer.byteOffset, messageSignatureBuffer.byteOffset + messageSignatureBuffer.byteLength
        )
        this.cryptoService.verifySignature(contact.contactUserSigningPublicKey!, payload.envelope.userId, messageSignature)
          .then((valid: Boolean) => {
            if (valid) {
              contact.contactUserMessageVerified = true;
              if (payload.envelope.contactUserEncryptedMessage) {
                this.cryptoService.decrypt(this.userService.getUser().encryptionKeyPair.privateKey, JSON.parse(payload.envelope.contactUserEncryptedMessage))
                  .then((message: string) => {
                    if (message !== '') {
                      contact.contactUserMessage = JSON.parse(message);
                      // contact.contactUserMessageStyle = payload.envelope.messageStyle;
                      contact.lastMessageFrom = 'contactUser';
                    } else {
                      let errorMessage: ShortMessage = {
                        message: 'Message cannot be decrypted!',
                        multimedia: {
                          type: MultimediaType.UNDEFINED,
                          attribution: '',
                          title: '',
                          description: '',
                          url: '',
                          sourceUrl: '',
                          videoId: ''
                        },
                        style: ''
                      }
                      contact.contactUserMessage = errorMessage;
                      // contact.contactUserMessageStyle = payload.envelope.messageStyle;
                      contact.lastMessageFrom = 'contactUser';
                    }
                  });
              }
            } else {
              contact.contactUserMessageVerified = false;
              let errorMessage: ShortMessage = {
                message: 'ignature could not be verified!',
                multimedia: {
                  type: MultimediaType.UNDEFINED,
                  attribution: '',
                  title: '',
                  description: '',
                  url: '',
                  sourceUrl: '',
                  videoId: ''
                },
                style: ''
              }
              contact.contactUserMessage = errorMessage;
              // contact.contactUserMessageStyle = payload.envelope.messageStyle;
              contact.lastMessageFrom = 'contactUser';
            }
          });
      }
    });
  }

}
