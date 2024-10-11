import { Injectable } from '@angular/core';
import { Contact } from '../interfaces/contact';
import { HttpHeaders, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { throwError, catchError } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreateConnectResponse } from '../interfaces/create-connect-response';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { GetContactResponse } from '../interfaces/get-contact-response';

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
    };
    return this.http.post<CreateConnectResponse>(`${environment.apiUrl}/place/create`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getByUserId(userId: string) {
    return this.http.get<GetContactResponse>(`${environment.apiUrl}/place/get/userId/${userId}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getById(contactId: string) {
    return this.http.get<GetContactResponse>(`${environment.apiUrl}/place/get/${contactId}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteContact(contact: Contact) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/place/delete/${contact.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  subscribe(contact: Contact) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/place/subscribe/${contact.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  unsubscribe(contact: Contact) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/place/unsubscribe/${contact.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }
}
