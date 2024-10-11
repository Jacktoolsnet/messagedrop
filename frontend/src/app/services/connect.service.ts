import { HttpHeaders, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { catchError, throwError } from 'rxjs';
import { Connect } from '../interfaces/connect';
import { CreateConnectResponse } from '../interfaces/create-connect-response';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { GetConnectResponse } from '../interfaces/get-connect-response';

@Injectable({
  providedIn: 'root'
})
export class ConnectService {
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

  createConnect(connect: Connect) {    
    let body = {
      'userId': connect.userId,
      'signature': connect.signature,
      'encryptionPublicKey': connect.encryptionPublicKey,
      'signingPublicKey': connect.signingPublicKey
    };
    return this.http.post<CreateConnectResponse>(`${environment.apiUrl}/connect/create`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getById(connectId: string) {
    return this.http.get<GetConnectResponse>(`${environment.apiUrl}/connect/get/${connectId}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteConnect(connect: Connect) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/connect/delete/${connect.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }
}
