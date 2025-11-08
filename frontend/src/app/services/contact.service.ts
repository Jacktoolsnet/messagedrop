import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { computed, Injectable, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Buffer } from 'buffer';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Contact } from '../interfaces/contact';
import { CreateContactResponse } from '../interfaces/create-contact-response';
import { Envelope } from '../interfaces/envelope';
import { GetContactResponse } from '../interfaces/get-contact-response';
import { GetContactsResponse } from '../interfaces/get-contacts-response';
import { MultimediaType } from '../interfaces/multimedia-type';
import { RawContact } from '../interfaces/raw-contact';
import { ShortMessage } from '../interfaces/short-message';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { CryptoService } from './crypto.service';
import { IndexedDbService } from './indexed-db.service';
import { NetworkService } from './network.service';
import { SocketioService } from './socketio.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})

export class ContactService {

  private _contacts = signal<Contact[]>([]);
  private _contactsSet = signal(0);
  readonly contactsSet = this._contactsSet.asReadonly();
  private ready = false;

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-Authorization': `${environment.apiToken}`,
      withCredentials: 'true'
    })
  };

  private readonly http = inject(HttpClient);
  private readonly userService = inject(UserService);
  private readonly indexedDbService = inject(IndexedDbService);
  private readonly cryptoService = inject(CryptoService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly networkService = inject(NetworkService);

  get contactsSignal() { return this._contacts.asReadonly(); }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  initContacts() {
    this.getByUserId(this.userService.getUser().id)
      .subscribe({
        next: (getContactsResponse: GetContactsResponse) => {
          getContactsResponse.rows.forEach((rawContact: RawContact) => {
            let userSignatureBuffer = undefined
            let userSignature = undefined
            if (rawContact.userSignature) {
              userSignatureBuffer = Buffer.from(JSON.parse(rawContact.userSignature))
              userSignature = userSignatureBuffer.buffer.slice(
                userSignatureBuffer.byteOffset, userSignatureBuffer.byteOffset + userSignatureBuffer.byteLength
              )
            }
            let contactUserSignatureBuffer = undefined;
            let contactUserSignature = undefined;
            if (rawContact.contactUserSignature) {
              contactUserSignatureBuffer = Buffer.from(JSON.parse(rawContact.contactUserSignature))
              contactUserSignature = contactUserSignatureBuffer.buffer.slice(
                contactUserSignatureBuffer.byteOffset, contactUserSignatureBuffer.byteOffset + contactUserSignatureBuffer.byteLength
              )
            }
            const contact: Contact = {
              id: rawContact.id,
              userId: rawContact.userId,
              userEncryptedMessage: 'undefined' !== rawContact.userEncryptedMessage ? JSON.parse(rawContact.userEncryptedMessage) : undefined,
              userSignature: userSignature,
              contactUserId: rawContact.contactUserId,
              contactUserSigningPublicKey: 'undefined' !== rawContact.contactUserSigningPublicKey ? JSON.parse(rawContact.contactUserSigningPublicKey) : undefined,
              contactUserEncryptionPublicKey: 'undefined' !== rawContact.contactUserEncryptionPublicKey ? JSON.parse(rawContact.contactUserEncryptionPublicKey) : undefined,
              contactUserEncryptedMessage: 'undefined' !== rawContact.contactUserEncryptedMessage ? JSON.parse(rawContact.contactUserEncryptedMessage) : undefined,
              contactUserSignature: contactUserSignature,
              subscribed: rawContact.subscribed,
              pinned: false,
              hint: rawContact.hint,
              name: '',
              base64Avatar: '',
              lastMessageFrom: rawContact.lastMessageFrom,
              userMessage: {
                message: '',
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
              },
              contactUserMessage: {
                message: '',
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
              },
              provided: false,
              userMessageVerified: false,
              contactUserMessageVerified: false
            };
            if (contact.userSignature) {
              this.cryptoService.verifySignature(this.userService.getUser().signingKeyPair.publicKey, contact.userId, contact.userSignature!)
                .then((valid: boolean) => {
                  if (valid) {
                    contact.userMessageVerified = true;
                    if (contact.userEncryptedMessage) {
                      this.cryptoService.decrypt(this.userService.getUser().cryptoKeyPair.privateKey, contact.userEncryptedMessage!)
                        .then((message: string) => {
                          if (message !== '') {
                            contact.userMessage = JSON.parse(message);
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
                            }
                            contact.userMessage = errorMessage;
                          }
                        });
                    }
                  } else {
                    contact.userMessageVerified = false;
                    const errorMessage: ShortMessage = {
                      message: 'Signature could not be verified!',
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
                    }
                    contact.contactUserMessage = errorMessage;
                  }
                });
            }
            if (contact.contactUserSignature) {
              this.cryptoService.verifySignature(contact.contactUserSigningPublicKey!, contact.contactUserId, contact.contactUserSignature!)
                .then((valid: boolean) => {
                  if (valid) {
                    contact.contactUserMessageVerified = true;
                    if (contact.contactUserEncryptedMessage) {
                      this.cryptoService.decrypt(this.userService.getUser().cryptoKeyPair.privateKey, contact.contactUserEncryptedMessage!)
                        .then((message: string) => {
                          if (message !== '') {
                            contact.contactUserMessage = JSON.parse(message);
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
                            }
                            contact.contactUserMessage = errorMessage;
                          }
                        });
                    }
                  } else {
                    contact.contactUserMessageVerified = false;
                    const errorMessage: ShortMessage = {
                      message: 'Signature could not be verified!',
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
                    }
                    contact.contactUserMessage = errorMessage;
                  }
                });
            }
            this._contacts.update(contacts => [...contacts, contact]);
          })
          this.updateContactProfile();
          this.ready = true;
          this._contactsSet.update(trigger => trigger + 1);
        },
        error: (err) => {
          if (err.status === 404) {
            this._contacts.set([]);
            this.ready = true;
          } else {
            this.ready = false;
          }
          this._contactsSet.update(trigger => trigger + 1);
        }
      });
  }

  public logout() {
    this.ready = false;
    this._contacts.set([]);
  }

  private async updateContactProfile() {
    await Promise.all(this._contacts().map(async contact => {
      const profile = await this.indexedDbService.getContactProfile(contact.id);
      contact.name = profile?.name || '';
      contact.base64Avatar = profile?.base64Avatar || '';
      contact.pinned = profile?.pinned || false;
    }));
    this._contacts.set(this._contacts());
  }

  async saveAditionalContactInfos() {
    await Promise.all(this._contacts().map(contact => {
      this.indexedDbService.setContactProfile(contact.id, {
        name: contact.name ? contact.name : '',
        base64Avatar: contact.base64Avatar ? contact.base64Avatar : '',
        pinned: contact.pinned
      });
    }));
  }

  isReady(): boolean {
    return this.ready;
  }

  readonly sortedContactsSignal = computed(() =>
    this._contacts().slice().sort((a, b) => {
      if (a.pinned !== b.pinned) {
        return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
      }
      const nameA = a.name?.trim().toLowerCase() || 'unnamed';
      const nameB = b.name?.trim().toLowerCase() || 'unnamed';
      return nameA.localeCompare(nameB);
    })
  );

  setContacts(contacts: Contact[]) {
    this._contacts.set(contacts);
  }

  // We need a function from qrcode
  createContact(contact: Contact, socketioService: SocketioService, showAlways = false) {
    const url = `${environment.apiUrl}/contact/create`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Contact service',
      image: '',
      icon: '',
      message: `Creating contact`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    const body = {
      'userId': contact.userId,
      'contactUserId': contact.contactUserId,
      'contactUserSigningPublicKey': JSON.stringify(contact.contactUserSigningPublicKey),
      'contactUserEncryptionPublicKey': JSON.stringify(contact.contactUserEncryptionPublicKey),
      'hint': contact.hint
    };
    this.http.post<CreateContactResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: createContactResponse => {
          if (createContactResponse.status === 200) {
            contact.id = createContactResponse.contactId;
            socketioService.receiveShortMessage(contact)
            this.saveAditionalContactInfos();
            this.snackBar.open(`Contact succesfully created.`, '', { duration: 1000 });
            this._contacts.update(contacts => [...contacts, contact]);
          }
        },
        error: (err) => { this.snackBar.open(err.message, 'OK'); }
      });
  }

  updateContactName(contact: Contact, showAlways = false) {
    const url = `${environment.apiUrl}/contact/update/name`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Contact service',
      image: '',
      icon: '',
      message: `Updating contact name`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    const body = {
      'contactId': contact.id,
      'name': contact.name
    };
    this.http.post<SimpleStatusResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (response) => {
          if (response.status !== 200) {
            this.snackBar.open('Failed to update contact name.', 'OK');
          }
        },
        error: (err) => {
          const message = err?.message ?? 'Failed to update contact name.';
          this.snackBar.open(message, 'OK');
        }
      });
  }

  updateContactMessage(envelope: Envelope, contact: Contact, shortMessage: ShortMessage, socketioService: SocketioService, showAlways = false) {
    const url = `${environment.apiUrl}/contact/update/message`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Contact service',
      image: '',
      icon: '',
      message: `Sending message`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    const body = {
      'contactId': envelope.contactId,
      'userId': envelope.userId,
      'contactUserId': envelope.contactUserId,
      'userEncryptedMessage': envelope.userEncryptedMessage,
      'contactUserEncryptedMessage': envelope.contactUserEncryptedMessage,
      'messageSignature': envelope.messageSignature
    };
    this.http.post<boolean>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: () => {
          contact.userMessage = shortMessage;
          contact.userEncryptedMessage = JSON.parse(envelope.userEncryptedMessage);
          contact.lastMessageFrom = 'user';
          socketioService.sendShortMessageToContact(envelope);
        },
        error: (err) => {
          const message = err?.message ?? 'Failed to send message.';
          this.snackBar.open(message, 'OK');
        }
      });
  }

  getByUserId(userId: string, showAlways = false) {
    const url = `${environment.apiUrl}/contact/get/userId/${userId}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Contact service',
      image: '',
      icon: '',
      message: `Loading contacts`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    return this.http.get<GetContactsResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getById(contactId: string, showAlways = false) {
    const url = `${environment.apiUrl}/contact/get/${contactId}`
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Contact service',
      image: '',
      icon: '',
      message: `Loading contact`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    return this.http.get<GetContactResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteContact(contactToDelete: Contact, showAlways = false) {
    const url = `${environment.apiUrl}/contact/delete/${contactToDelete.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Contact service',
      image: '',
      icon: '',
      message: `Deleting from contact`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            this._contacts.update(contacts =>
              contacts.filter(c => c.id !== contactToDelete.id)
            );
            this.indexedDbService.deleteContactProfile(contactToDelete.id);
          }
        },
        error: (err) => {
          const message = err?.message ?? 'Failed to delete contact.';
          this.snackBar.open(message, 'OK');
        }
      });
  }

  subscribe(contact: Contact, showAlways = false) {
    const url = `${environment.apiUrl}/contact/subscribe/${contact.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Contact service',
      image: '',
      icon: '',
      message: `Subscribing to contact`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            contact.subscribed = true;
            this._contacts.set(this._contacts());
          }
        },
        error: (err) => {
          const message = err?.message ?? 'Failed to subscribe.';
          this.snackBar.open(message, 'OK');
        }
      });
  }

  unsubscribe(contact: Contact, showAlways = false) {
    const url = `${environment.apiUrl}/contact/unsubscribe/${contact.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Contact service',
      image: '',
      icon: '',
      message: `Unsubscribing from contact`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            contact.subscribed = false;
            this._contacts.set(this._contacts());
          }
        },
        error: (err) => {
          const message = err?.message ?? 'Failed to unsubscribe.';
          this.snackBar.open(message, 'OK');
        }
      });
  }
}
