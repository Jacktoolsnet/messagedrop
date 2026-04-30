import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Buffer } from 'buffer';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Connect } from '../interfaces/connect';
import { Contact } from '../interfaces/contact';
import { CreateConnectResponse } from '../interfaces/create-connect-response';
import { ConsumeConnectResponse } from '../interfaces/consume-connect-response';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { ContactService } from './contact.service';
import { CryptoService } from './crypto.service';
import { NetworkService } from './network.service';
import { SocketioService } from './socketio.service';
import { TranslationHelperService } from './translation-helper.service';
import { DisplayMessageService } from './display-message.service';
import { UserService } from './user.service';

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
  private readonly snackBar = inject(DisplayMessageService);
  private readonly networkService = inject(NetworkService);
  private readonly i18n = inject(TranslationHelperService);
  private readonly userService = inject(UserService);

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

  getById(
    connectId: string,
    contact: Contact,
    socketioService: SocketioService,
    showAlways = false,
    onContactCreated?: (contact: Contact) => void
  ) {
    const url = `${environment.apiUrl}/connect/consume/${connectId}`;
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

    this.buildOwnConnectPayload()
      .then((ownConnect) => {
        const body = {
          userId: ownConnect.userId,
          hint: ownConnect.hint,
          signature: ownConnect.signature,
          encryptionPublicKey: ownConnect.encryptionPublicKey,
          signingPublicKey: ownConnect.signingPublicKey
        };

        this.http.post<ConsumeConnectResponse>(url, body, this.httpOptions)
          .pipe(catchError(this.handleError))
          .subscribe({
            next: consumeConnectResponse => {
              if (consumeConnectResponse.status === 200) {
                this.createLocalContactFromConnectResponse(consumeConnectResponse, contact, socketioService, onContactCreated);
              }
            },
            error: (error) => {
              console.error('Failed to consume connect record', error);
              const messageKey = error?.status === 404
                ? 'common.connect.consumedOrExpired'
                : error?.status === 400
                  ? 'common.connect.invalidData'
                  : 'common.connect.notFound';
              this.snackBar.open(this.i18n.t(messageKey), this.i18n.t('common.actions.ok'));
            }
          });
      })
      .catch((error) => {
        console.error('Failed to build own connect payload', error);
        this.snackBar.open(this.i18n.t('common.connect.invalidData'), this.i18n.t('common.actions.ok'));
      });
  }

  private async buildOwnConnectPayload(): Promise<Connect> {
    const user = this.userService.getUser();
    const encryptionPublicKey = user.cryptoKeyPair?.publicKey ? JSON.stringify(user.cryptoKeyPair.publicKey) : '';
    const signingPublicKey = user.signingKeyPair?.publicKey ? JSON.stringify(user.signingKeyPair.publicKey) : '';
    const signature = await this.cryptoService.createSignature(user.signingKeyPair.privateKey, user.id);
    const hint = await this.cryptoService.encrypt(user.cryptoKeyPair.publicKey, 'No hint');

    return {
      id: '',
      userId: user.id,
      hint,
      signature,
      encryptionPublicKey,
      signingPublicKey
    };
  }

  private createLocalContactFromConnectResponse(
    consumeConnectResponse: ConsumeConnectResponse,
    contact: Contact,
    socketioService: SocketioService,
    onContactCreated?: (contact: Contact) => void
  ): void {
    const buffer = Buffer.from(JSON.parse(consumeConnectResponse.connect.signature));
    const signature = buffer.buffer.slice(
      buffer.byteOffset, buffer.byteOffset + buffer.byteLength
    );

    contact.id = consumeConnectResponse.contactId;
    contact.contactUserId = consumeConnectResponse.connect.userId;
    contact.hint = consumeConnectResponse.connect.hint;
    contact.contactUserEncryptionPublicKey = JSON.parse(consumeConnectResponse.connect.encryptionPublicKey);
    contact.contactUserSigningPublicKey = JSON.parse(consumeConnectResponse.connect.signingPublicKey);
    contact.contactSignature = signature;

    if (contact.contactUserId !== contact.userId && contact.contactUserSigningPublicKey) {
      this.cryptoService.verifySignature(contact.contactUserSigningPublicKey, contact.contactUserId, contact.contactSignature!)
        .then((valid: boolean) => {
          if (valid) {
            this.contactService.addOrUpdateContact(contact);
            socketioService.sendContactsUpdated(contact);
            onContactCreated?.(contact);
            this.snackBar.open(this.i18n.t('common.contact.created'), '', { duration: 1000 });
          } else {
            this.snackBar.open(this.i18n.t('common.connect.invalidData'), this.i18n.t('common.actions.ok'));
          }
        });
    } else {
      this.snackBar.open(this.i18n.t('common.connect.selfAddBlocked'), this.i18n.t('common.actions.ok'));
    }
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
