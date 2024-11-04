import { Injectable } from '@angular/core';
import { Contact } from '../interfaces/contact';
import { HttpHeaders, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { throwError, catchError } from 'rxjs';
import { environment } from '../../environments/environment';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { GetContactResponse } from '../interfaces/get-contact-response';
import { GetContactsResponse } from '../interfaces/get-contacts-response';
import { CreateContactResponse } from '../interfaces/create-contact-response';
import { ShortMessage } from '../interfaces/short-message';
import { UserService } from './user.service';
import { SocketioService } from './socketio.service';
import { MatSnackBar } from '@angular/material/snack-bar';

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
    private snackBar: MatSnackBar
  ) {
    this.initContacts();
  }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  async initContacts() {
    while (!this.userService.isReady) {
      await new Promise(f => setTimeout(f, 500));
    }
    this.getByUserId(this.userService.getUser().id)
      .subscribe({
        next: (getContactsResponse: GetContactsResponse) => {
          this.contacts = [...getContactsResponse.rows];
          this.ready = true;
        },
        error: (err) => {
          if (err.status === 404) {
            this.contacts = [];
            this.ready = true;
          } else {
            this.ready = false;
          }
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

  updateContactMessage(contact: Contact, shortMessage: ShortMessage, socketioService: SocketioService) {
    let body = {
      'contactId': contact.id,
      'userId': contact.userId,
      'contactUserId': contact.contactUserId,
      'message': shortMessage.message,
      'style': shortMessage.style
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
