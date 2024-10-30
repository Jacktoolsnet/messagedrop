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

  updateContactProfile(contact: Contact) {
    let body = {
      'contactId': contact.id,
      'name': contact.name,
      'base64Avatar': contact.base64Avatar
    };
    return this.http.post<SimpleStatusResponse>(`${environment.apiUrl}/contact/update/profile`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  updateContactMessage(contact: Contact, shortMessage: ShortMessage) {
    let body = {
      'contactId': contact.id,
      'userId': contact.userId,
      'contactUserId': contact.contactUserId,
      'message': shortMessage.message,
      'style': shortMessage.style
    };
    return this.http.post<SimpleStatusResponse>(`${environment.apiUrl}/contact/update/message`, body, this.httpOptions)
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
