import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Buffer } from 'buffer';
import { catchError, Subject, throwError } from 'rxjs';
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

  private contacts: Contact[] = [];
  private ready: boolean = false;

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-Authorization': `${environment.apiToken}`,
      withCredentials: 'true'
    })
  };

  constructor(
    private http: HttpClient,
    private userService: UserService,
    private indexedDbService: IndexedDbService,
    private cryptoService: CryptoService,
    private snackBar: MatSnackBar,
    private networkService: NetworkService
  ) { }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  initContacts(contactSubject: Subject<void>) {
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
            let contact: Contact = {
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
                .then((valid: Boolean) => {
                  if (valid) {
                    contact.userMessageVerified = true;
                    if (contact.userEncryptedMessage) {
                      this.cryptoService.decrypt(this.userService.getUser().cryptoKeyPair.privateKey, contact.userEncryptedMessage!)
                        .then((message: string) => {
                          if (message !== '') {
                            contact.userMessage = JSON.parse(message);
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
                    let errorMessage: ShortMessage = {
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
                .then((valid: Boolean) => {
                  if (valid) {
                    contact.contactUserMessageVerified = true;
                    if (contact.contactUserEncryptedMessage) {
                      this.cryptoService.decrypt(this.userService.getUser().cryptoKeyPair.privateKey, contact.contactUserEncryptedMessage!)
                        .then((message: string) => {
                          if (message !== '') {
                            contact.contactUserMessage = JSON.parse(message);
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
                    let errorMessage: ShortMessage = {
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
            this.contacts.push(contact);
          })
          this.updateContactProfile();
          this.ready = true;
          contactSubject.next();
        },
        error: (err) => {
          if (err.status === 404) {
            this.contacts = [];
            this.ready = true;
          } else {
            this.ready = false;
          }
          contactSubject.next();
        },
        complete: () => { }
      });
  }

  public logout() {
    this.ready = false;
    this.contacts = [];
  }

  private updateContactProfile() {
    this.contacts.forEach(async (contact: Contact) => {
      let contactProfile = await this.indexedDbService.getContactProfile(contact.id);
      contact.name = undefined != contactProfile ? contactProfile.name : '';
      contact.base64Avatar = undefined != contactProfile ? contactProfile.base64Avatar : '';
    });
  }

  saveAditionalContactInfos() {
    this.contacts.forEach((contact: Contact) => {
      this.indexedDbService.setContactProfile(contact.id, { name: contact.name!, base64Avatar: contact.base64Avatar! });
    })
  }

  getContacts(): Contact[] {
    return this.contacts;
  }

  getSortedContacts(): Contact[] {
    return this.contacts.sort((a, b) => {
      if (a.name && b.name) {
        return a.name.localeCompare(b.name);
      } else if (a.name && !b.name) {
        return -1; // a has name, b does not
      } else if (!a.name && b.name) {
        return 1; // b has name, a does not
      } else {
        return 0; // both are undefined or empty
      }
    });
  }

  isReady(): boolean {
    return this.ready;
  }

  // We need a function from qrcode
  createContact(contact: Contact, socketioService: SocketioService, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/contact/create`;
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
    let body = {
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
            this.getContacts().unshift(contact);
            socketioService.receiveShortMessage(contact)
            this.saveAditionalContactInfos();
            this.snackBar.open(`Contact succesfully created.`, '', { duration: 1000 });
          }
        },
        error: (err) => { this.snackBar.open(err.message, 'OK'); },
        complete: () => { }
      });
  }

  updateContactName(contact: Contact, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/contact/update/name`;
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
    let body = {
      'contactId': contact.id,
      'name': contact.name
    };
    this.http.post<SimpleStatusResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: () => { },
        error: (err) => { },
        complete: () => { }
      });
  }

  updateContactMessage(envelope: Envelope, contact: Contact, shortMessage: ShortMessage, socketioService: SocketioService, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/contact/update/message`;
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
    let body = {
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
        error: (err) => { },
        complete: () => { }
      });
  }

  getByUserId(userId: string, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/contact/get/userId/${userId}`;
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

  getById(contactId: string, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/contact/get/${contactId}`
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

  deleteContact(contactToDelete: Contact, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/contact/delete/${contactToDelete.id}`;
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
            this.contacts.splice(this.contacts.map(e => e.id).indexOf(contactToDelete.id), 1);
            this.indexedDbService.deleteContactProfile(contactToDelete.id);
          }
        },
        error: (err) => {
        },
        complete: () => { }
      });
  }

  subscribe(contact: Contact, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/contact/subscribe/${contact.id}`;
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
          }
        },
        error: (err) => { },
        complete: () => { }
      });
  }

  unsubscribe(contact: Contact, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/contact/unsubscribe/${contact.id}`;
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
          }
        },
        error: (err) => {
        },
        complete: () => { }
      });
  }
}
