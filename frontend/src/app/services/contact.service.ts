import { Injectable } from '@angular/core';
import { Contact } from '../interfaces/contact';
import { HttpHeaders, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { throwError, catchError } from 'rxjs';
import { environment } from '../../environments/environment';
import { CreateConnectResponse } from '../interfaces/create-connect-response';
import { GetConnectResponse } from '../interfaces/get-connect-response';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';

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
    /* let body = {
      'userId': connect.userId,
      'signature': connect.signature,
      'encryptionPublicKey': connect.encryptionPublicKey,
      'signingPublicKey': connect.signingPublicKey
    };
    return this.http.post<CreateConnectResponse>(`${environment.apiUrl}/connect/create`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );*/
  }

  getById(contactId: string) {
    /*return this.http.get<GetConnectResponse>(`${environment.apiUrl}/connect/get/${connectId}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );*/
  }

  deleteContact(contact: Contact) {
    /*return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/connect/delete/${connect.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );*/
  }
}
