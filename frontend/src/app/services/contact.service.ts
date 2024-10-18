import { Injectable } from '@angular/core';
import { Contact } from '../interfaces/contact';
import { HttpHeaders, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { throwError, catchError } from 'rxjs';
import { environment } from '../../environments/environment';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { GetContactResponse } from '../interfaces/get-contact-response';
import { GetContactsResponse } from '../interfaces/get-contacts-response';
import { CreateContactResponse } from '../interfaces/create-contact-response';

@Injectable({
  providedIn: 'root'
})
export class ContactService {

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type':  'application/json',
      Authorization: `Bearer ${environment.apiToken}`
    })
  };

  constructor(private http: HttpClient) { }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  loadContact(contactId: string): Contact|undefined {
    let contactFromLocalStorage: any = JSON.parse(localStorage.getItem(contactId) || '{}');
    let contact!: Contact;
    if (JSON.stringify(contactFromLocalStorage) === '{}') {
      return undefined;
    } else {
      contact = {
        id : undefined != contactFromLocalStorage.id ? contactFromLocalStorage.id : 'undefined',
        userId: undefined != contactFromLocalStorage.userId ? contactFromLocalStorage.userId : 'undefined',
        hint: undefined != contactFromLocalStorage.hint ? contactFromLocalStorage.hinte : 'undefined',
        contactUserId: undefined != contactFromLocalStorage.contactUserId ? contactFromLocalStorage.contactUserId : 'undefined',
        name : undefined != contactFromLocalStorage.name ? contactFromLocalStorage.name : 'Unnamed user',
        base64Avatar : undefined != contactFromLocalStorage.base64Avatar ? contactFromLocalStorage.base64Avatar : '',
        subscribed : undefined != contactFromLocalStorage.subscribed ? contactFromLocalStorage.subscribed : false,
        provided: undefined != contactFromLocalStorage.provided ? contactFromLocalStorage.provided : false,
      }
    }
    return contact;
  }

  saveContact(contact: Contact) {
    localStorage.setItem(contact.id, JSON.stringify(contact))
  }

  removeContact(contact: Contact) {
    localStorage.removeItem(contact.id)
  }

  createContact(contact: Contact) {
    let body = {
      'userId': contact.userId,
      'contactUserId': contact.contactUserId,
      'hint': contact.hint
    };
    return this.http.post<CreateContactResponse>(`${environment.apiUrl}/contact/create`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
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

  deleteContact(contact: Contact) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/contact/delete/${contact.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  subscribe(contact: Contact) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/contact/subscribe/${contact.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  unsubscribe(contact: Contact) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/contact/unsubscribe/${contact.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }
}
