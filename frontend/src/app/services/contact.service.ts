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
              userEncryptedMessage: rawContact.userEncryptedMessage,
              userMessageStyle: rawContact.userMessageStyle,
              userSignature: userSignature,
              contactUserId: rawContact.contactUserId,
              contactUserSigningPublicKey: JSON.parse(rawContact.contactUserSigningPublicKey),
              contactUserEncryptionPublicKey: JSON.parse(rawContact.contactUserEncryptionPublicKey),
              contactUserEncryptedMessage: rawContact.contactUserEncryptedMessage,
              contactUserMessageStyle: rawContact.contactUserMessageStyle,
              contactUserSignature: contactUserSignature,
              subscribed: rawContact.subscribed,
              hint: rawContact.hint,
              name: rawContact.name,
              base64Avatar: rawContact.base64Avatar,
              lastMessageFrom: rawContact.lastMessageFrom,
              userMessage: '',
              contactUserMessage: '',
              provided: false,
              userMessageVerified: false,
              contactUserMessageVerified: false
            };
            // continue with encrpytion and Verification
            if (contact.userSignature) {
              this.cryptoService.verifySignature(this.userService.getUser().signingKeyPair.publicKey, contact.userId, contact.userSignature!)
                .then((valid: Boolean) => {
                  if (valid) {
                    contact.userMessageVerified = true;
                  } else {
                    contact.userMessageVerified = false;
                  }
                });
            }
            if (null != contact.userEncryptedMessage) {
              contact.userMessage = contact.userMessage + ' Not decrypted yet!';
            }
            if (contact.contactUserSignature) {
              this.cryptoService.verifySignature(contact.contactUserSigningPublicKey!, contact.contactUserId, contact.contactUserSignature!)
                .then((valid: Boolean) => {
                  if (valid) {
                    contact.contactUserMessageVerified = true;
                  } else {
                    contact.contactUserMessageVerified = false;
                  }
                });
            }
            if (null != contact.contactUserEncryptedMessage) {
              contact.contactUserMessage = contact.contactUserMessage + ' Not decrypted yet!'
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

  getContacts(): Contact[] {
    return this.contacts;
  }

  isReady(): boolean {
    return this.ready;
  }

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
            socketioService.receiveShorMessage(contact)
            this.updateContactProfile(contact);
            this.snackBar.open(`Contact succesfully created.`, '', { duration: 1000 });
          }
        },
        error: (err) => { this.snackBar.open(err.message, 'OK'); },
        complete: () => { }
      });
  }

  updateContactProfile(contact: Contact) {
    let body = {
      'contactId': contact.id,
      'name': contact.name,
      'base64Avatar': contact.base64Avatar
    };
    this.http.post<SimpleStatusResponse>(`${environment.apiUrl}/contact/update/profile`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: simpleStatusResponse => { },
        error: (err) => { },
        complete: () => { }
      });
  }

  updateContactMessage(envelope: Envelope, contact: Contact, shortMessage: ShortMessage, socketioService: SocketioService) {
    let body = {
      'contactId': envelope.contactId,
      'userId': envelope.userId,
      'contactUserId': envelope.contactUserId,
      'encryptedMessage': envelope.encryptedMessage,
      'messageSignature': envelope.messageSignature,
      'messageStyle': envelope.messageStyle
    };
    this.http.post<boolean>(`${environment.apiUrl}/contact/update/message`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: simpleStatusResponse => {
          contact.userMessage = shortMessage.message;
          contact.userMessageStyle = shortMessage.style;
          contact.lastMessageFrom = 'user';
          socketioService.sendShortMessageToContact(contact);
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
            this.getContacts().splice(this.getContacts().findIndex(contact => contact.id !== contactToDelete.id), 1);
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
