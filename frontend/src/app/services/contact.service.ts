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
import { SocketioService } from './socketio.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})

export class ContactService {

  private contacts: Contact[] = [];
  private additionalContactInfos: { id: string, name: string, base64Avatar: string }[] = [];
  private ready: boolean = false;

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.apiToken}`
    })
  };

  constructor(
    private http: HttpClient,
    private userService: UserService,
    private cryptoService: CryptoService,
    private snackBar: MatSnackBar
  ) { }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  initContacts(contactSubject: Subject<void>) {
    this.getByUserId(this.userService.getUser().id)
      .subscribe({
        next: (getContactsResponse: GetContactsResponse) => {
          this.loadAdditionalContactInfos();
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
              name: this.findAditionalContactInfo(rawContact.id).name,
              base64Avatar: this.findAditionalContactInfo(rawContact.id).base64Avatar,
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

  loadAdditionalContactInfos() {
    this.additionalContactInfos = JSON.parse(localStorage.getItem('contacts') || '[]');
  }

  findAditionalContactInfo(contactId: string): { id: string, name: string, base64Avatar: string } {
    const additionalContactInfo = this.additionalContactInfos.find((additionalContactInfo) => additionalContactInfo.id === contactId);
    return undefined != additionalContactInfo ? additionalContactInfo : { id: contactId, name: '', base64Avatar: '' };
  }

  saveAditionalContactInfos() {
    this.additionalContactInfos = [];
    this.contacts.forEach((contact: Contact) => {
      this.additionalContactInfos.push({ id: contact.id, name: contact.name!, base64Avatar: contact.base64Avatar! });
    })
    localStorage.setItem('contacts', JSON.stringify(this.additionalContactInfos))
  }

  getContacts(): Contact[] {
    return this.contacts;
  }

  isReady(): boolean {
    return this.ready;
  }

  // We need a function from qrcode
  createContact(contact: Contact, socketioService: SocketioService) {
    let body = {
      'userId': contact.userId,
      'contactUserId': contact.contactUserId,
      'contactUserSigningPublicKey': JSON.stringify(contact.contactUserSigningPublicKey),
      'contactUserEncryptionPublicKey': JSON.stringify(contact.contactUserEncryptionPublicKey),
      'hint': contact.hint
    };
    this.http.post<CreateContactResponse>(`${environment.apiUrl}/contact/create`, body, this.httpOptions)
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

  updateContactMessage(envelope: Envelope, contact: Contact, shortMessage: ShortMessage, socketioService: SocketioService) {
    let body = {
      'contactId': envelope.contactId,
      'userId': envelope.userId,
      'contactUserId': envelope.contactUserId,
      'userEncryptedMessage': envelope.userEncryptedMessage,
      'contactUserEncryptedMessage': envelope.contactUserEncryptedMessage,
      'messageSignature': envelope.messageSignature
    };
    this.http.post<boolean>(`${environment.apiUrl}/contact/update/message`, body, this.httpOptions)
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

  getByUserId(userId: string) {
    return this.http.get<GetContactsResponse>(`${environment.apiUrl}/contact/get/userId/${userId}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getById(contactId: string) {
    return this.http.get<GetContactResponse>(`${environment.apiUrl}/contact/get/${contactId}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteContact(contactToDelete: Contact) {
    this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/contact/delete/${contactToDelete.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            this.contacts.splice(this.contacts.map(e => e.id).indexOf(contactToDelete.id), 1);
          }
        },
        error: (err) => {
        },
        complete: () => { }
      });
  }

  subscribe(contact: Contact) {
    this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/contact/subscribe/${contact.id}`, this.httpOptions)
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

  unsubscribe(contact: Contact) {
    this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/contact/unsubscribe/${contact.id}`, this.httpOptions)
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
