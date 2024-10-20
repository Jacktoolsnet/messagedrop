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
    let contactsFromLocalStorage: Contact[] = JSON.parse(localStorage.getItem('contacts') || '[]');
    let contact!: Contact;
    if (JSON.stringify(contactsFromLocalStorage.length) === '0') {
      return undefined;
    } else {
      contactsFromLocalStorage.forEach((element: Contact) => {
        if (element.id === contactId) {
          contact = {
            id : undefined != element.id ? element.id : 'undefined',
            userId: undefined != element.userId ? element.userId : 'undefined',
            hint: undefined != element.hint ? element.hint : 'undefined',
            contactUserId: undefined != element.contactUserId ? element.contactUserId : 'undefined',
            name : undefined != element.name ? element.name : 'Unnamed user',
            base64Avatar : undefined != element.base64Avatar ? element.base64Avatar : '',
            subscribed : undefined != element.subscribed ? element.subscribed : false,
            provided: undefined != element.provided ? element.provided : false,
          }
        }
      });      
    }
    return contact;
  }

  saveContact(contact: Contact) {
    let contactsFromLocalStorage: Contact[] = JSON.parse(localStorage.getItem('contacts') || '[]');
    if (JSON.stringify(contactsFromLocalStorage.length) === '0') {
      // New Item
      contactsFromLocalStorage.push(contact);
    } else {
      // Update item.
      let updateContact: Contact = contactsFromLocalStorage[contactsFromLocalStorage.findIndex(element => element.id === contact.id)];
      updateContact.id = contact.id;
      updateContact.userId = contact.userId;
      updateContact.hint = contact.hint;
      updateContact.contactUserId = contact.contactUserId;
      updateContact.name = contact.name;
      updateContact.base64Avatar = contact.base64Avatar;
      updateContact.subscribed = contact.subscribed;
      updateContact.provided = contact.provided;

    }
    localStorage.setItem('contacts', JSON.stringify(contactsFromLocalStorage))
  }

  removeContact(contact: Contact) {
    let contactsFromLocalStorage: Contact[] = JSON.parse(localStorage.getItem('contacts') || '[]');
    if (JSON.stringify(contactsFromLocalStorage.length) !== '0') {
      contactsFromLocalStorage.splice(contactsFromLocalStorage.findIndex(element => element.id === contact.id), 1)
    }
    localStorage.setItem('contacts', JSON.stringify(contactsFromLocalStorage))
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
