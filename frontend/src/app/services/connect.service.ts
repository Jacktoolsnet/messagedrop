import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
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
import { NetworkService } from './network.service';
import { SocketioService } from './socketio.service';
import { TranslationHelperService } from './translation-helper.service';

@Injectable({
  providedIn: 'root'
})
export class ConnectService {
  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      withCredentials: 'true'
    })
  };

  private readonly contactService = inject(ContactService);
  private readonly cryptoService = inject(CryptoService);
  private readonly http = inject(HttpClient);
  private readonly snackBar = inject(MatSnackBar);
  private readonly networkService = inject(NetworkService);
  private readonly i18n = inject(TranslationHelperService);

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  createConnect(connect: Connect) {
    const url = `${environment.apiUrl}/connect/create`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: this.i18n.t('common.connect.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.connect.creatingInfo'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });
    const body = {
      'userId': connect.userId,
      'hint': connect.hint,
      'signature': connect.signature,
      'encryptionPublicKey': connect.encryptionPublicKey,
      'signingPublicKey': connect.signingPublicKey
    };
    return this.http.post<CreateConnectResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getById(connectId: string, contact: Contact, socketioService: SocketioService, showAlways = false) {
    const url = `${environment.apiUrl}/connect/get/${connectId}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: this.i18n.t('common.connect.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.connect.loadingInfo'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });
    this.http.get<GetConnectResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: getConnectResponse => {
          if (getConnectResponse.status === 200) {
            const buffer = Buffer.from(JSON.parse(getConnectResponse.connect.signature));
            const signature = buffer.buffer.slice(
              buffer.byteOffset, buffer.byteOffset + buffer.byteLength
            );
            // Informations from connect record.
            contact.contactUserId = getConnectResponse.connect.userId;
            contact.hint = getConnectResponse.connect.hint;
            contact.contactUserEncryptionPublicKey = JSON.parse(getConnectResponse.connect.encryptionPublicKey);
            contact.contactUserSigningPublicKey = JSON.parse(getConnectResponse.connect.signingPublicKey);
            contact.contactSignature = signature;
            // For Development check equal. Change to not equal for production.
            if (contact.contactUserId !== contact.userId && contact.contactUserSigningPublicKey) {
              // Verify data
              this.cryptoService.verifySignature(contact.contactUserSigningPublicKey, contact.contactUserId, contact.contactSignature!)
                .then((valid: boolean) => {
                  if (valid) {
                    // Generate Id
                    this.contactService.createContact(contact, socketioService);
                    // Delete connect record
                    this.deleteConnect(getConnectResponse.connect);
                    this.snackBar.open(this.i18n.t('common.contact.created'), '', { duration: 1000 });
                  } else {
                    this.snackBar.open(this.i18n.t('common.connect.invalidData'), this.i18n.t('common.actions.ok'));
                  }
                });
            } else {
              // Delete connect record
              this.deleteConnect(getConnectResponse.connect);
              this.snackBar.open(this.i18n.t('common.connect.selfAddBlocked'), this.i18n.t('common.actions.ok'));
            }
          }
        },
        error: (error) => {
          console.error('Failed to load connect record', error);
          this.snackBar.open(this.i18n.t('common.connect.notFound'), this.i18n.t('common.actions.ok'));
        }
      });
  }

  deleteConnect(connect: Connect, showAlways = false) {
    const url = `${environment.apiUrl}/connect/delete/${connect.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: this.i18n.t('common.connect.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.connect.deletingInfo'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });
    this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status !== 200) {
            this.snackBar.open(this.i18n.t('common.connect.deleteFailed'), this.i18n.t('common.actions.ok'));
          }
        },
        error: (error) => {
          console.error('Failed to delete connect', error);
          this.snackBar.open(this.i18n.t('common.connect.deleteUnavailable'), this.i18n.t('common.actions.ok'));
        }
      });
  }
}
