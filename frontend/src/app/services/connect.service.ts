import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Buffer } from 'buffer';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Connect } from '../interfaces/connect';
import { Contact } from '../interfaces/contact';
import { CreateConnectResponse } from '../interfaces/create-connect-response';
import { GetConnectResponse } from '../interfaces/get-connect-response';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { ContactService } from './contact.service';
import { CryptoService } from './crypto.service';
import { SocketioService } from './socketio.service';

@Injectable({
  providedIn: 'root'
})
export class ConnectService {
  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.apiToken}`
    })
  };

  constructor(
    private contactService: ContactService,
    private cryptoService: CryptoService,
    private http: HttpClient,
    private snackBar: MatSnackBar
  ) { }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  createConnect(connect: Connect) {
    let body = {
      'userId': connect.userId,
      'hint': connect.hint,
      'signature': connect.signature,
      'encryptionPublicKey': connect.encryptionPublicKey,
      'signingPublicKey': connect.signingPublicKey
    };
    return this.http.post<CreateConnectResponse>(`${environment.apiUrl}/connect/create`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getById(connectId: string, contact: Contact, socketioService: SocketioService) {
    this.http.get<GetConnectResponse>(`${environment.apiUrl}/connect/get/${connectId}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: getConnectResponse => {
          if (getConnectResponse.status === 200) {
            let buffer = Buffer.from(JSON.parse(getConnectResponse.connect.signature))
            var signature = buffer.buffer.slice(
              buffer.byteOffset, buffer.byteOffset + buffer.byteLength
            )
            // Informations from connect record.
            contact.contactUserId = getConnectResponse.connect.userId;
            contact.hint = getConnectResponse.connect.hint;
            contact.encryptionPublicKey = JSON.parse(getConnectResponse.connect.encryptionPublicKey);
            contact.signingPublicKey = JSON.parse(getConnectResponse.connect.signingPublicKey);
            contact.contactSignature = signature;
            // For Development check equal. Change to not equal for production.
            if (contact.contactUserId != contact.userId && contact.signingPublicKey) {
              // Verify data
              this.cryptoService.verifySignature(contact.signingPublicKey, contact.contactUserId, contact.contactSignature!)
                .then((valid: Boolean) => {
                  if (valid) {
                    this.snackBar.open(`Connect data is valid.`, 'OK');
                    // Generate Id
                    this.contactService.createContact(contact, socketioService);
                    // Delete connect record
                    this.deleteConnect(getConnectResponse.connect);
                    this.snackBar.open(`Contact succesfully created.`, '', { duration: 1000 });
                  } else {
                    this.snackBar.open(`Connect data is invalid.`, 'OK');
                  }
                });
            } else {
              // Delete connect record
              this.deleteConnect(getConnectResponse.connect);
              this.snackBar.open(`It is not possible to add my user to the contact list`, 'OK');
            }
          }
        },
        error: (err) => { this.snackBar.open(`Connect id not found.`, 'OK'); },
        complete: () => { }
      });
  }

  deleteConnect(connect: Connect) {
    this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/connect/delete/${connect.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) { }
        },
        error: (err) => {
        },
        complete: () => { }
      });
  }
}
