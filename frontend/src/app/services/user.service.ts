import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { SwPush } from '@angular/service-worker';
import { catchError, Observable, Subject, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ConfirmUserResponse } from '../interfaces/confirm-user-response';
import { CreateUserResponse } from '../interfaces/create-user-response';
import { CryptedUser } from '../interfaces/crypted-user';
import { GetMessageResponse } from '../interfaces/get-message-response';
import { GetPinHashResponse } from '../interfaces/get-pin-hash-response';
import { GetUserResponse } from '../interfaces/get-user-response';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { User } from '../interfaces/user';
import { CryptoService } from './crypto.service';
import { IndexDbService } from './index-db.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private user: User = {
    id: '',
    pinHash: '',
    location: {
      latitude: 0,
      longitude: 0,
      plusCode: ''
    },
    local: '',
    language: '',
    subscription: '',
    defaultStyle: '',
    cryptoKeyPair: {
      publicKey: {},
      privateKey: {}
    },
    signingKeyPair: {
      publicKey: {},
      privateKey: {}
    },
    name: '',
    base64Avatar: '',
    serverCryptoPublicKey: '',
    serverSigningPublicKey: ''
  };

  private ready: boolean = false;

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.apiToken}`
    })
  };

  constructor(
    private http: HttpClient,
    private swPush: SwPush,
    private indexDbService: IndexDbService,
    private cryptoService: CryptoService
  ) { }

  private handleError(error: HttpErrorResponse) {
    // Return an observable with a user-facing error message.
    return throwError(() => error);
  }

  getPinHash(pin: string): Observable<GetPinHashResponse> {
    let body = { pin: pin };
    return this.http.post<GetPinHashResponse>(`${environment.apiUrl}/user/hashpin`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  loadUserFromLocalStorage() {
    /*let userFromLocalStorage: any = JSON.parse(localStorage.getItem('user') || '{}');
    if (JSON.stringify(userFromLocalStorage) === '{}') {
      this.user = {
        id: '',
        location: { latitude: 0, longitude: 0, plusCode: '' },
        local: navigator.language,
        language: this.getLanguageForLocation(navigator.language),
        subscription: '',
        defaultStyle: this.style.getRandomStyle(),
        encryptionKeyPair: {
          publicKey: {},
          privateKey: {}
        },
        signingKeyPair: {
          publicKey: {},
          privateKey: {}
        },
        name: 'Unnamed user',
        base64Avatar: ''
      }
    } else {
      this.user = {
        id: undefined != userFromLocalStorage.id ? userFromLocalStorage.id : '',
        location: undefined != userFromLocalStorage.location ? userFromLocalStorage.location : { latitude: 0, longitude: 0, zoom: 19, plusCode: '' },
        local: navigator.language,
        language: this.getLanguageForLocation(navigator.language),
        subscription: undefined != userFromLocalStorage.subscription ? userFromLocalStorage.subscription : '',
        defaultStyle: undefined != userFromLocalStorage.defaultStyle ? userFromLocalStorage.defaultStyle : this.style.getRandomStyle(),
        encryptionKeyPair: undefined != userFromLocalStorage.encryptionKeyPair ? userFromLocalStorage.encryptionKeyPair : {},
        signingKeyPair: undefined != userFromLocalStorage.signingKeyPair ? userFromLocalStorage.signingKeyPair : {},
        name: undefined != userFromLocalStorage.name ? userFromLocalStorage.name : 'Unnamed user',
        base64Avatar: undefined != userFromLocalStorage.base64Avatar ? userFromLocalStorage.base64Avatar : ''
      }
    }*/
  }

  async initUser(userSubject: Subject<void>, createUserResponse: CreateUserResponse) {
    this.user.id = createUserResponse.userId;
    this.user.serverCryptoPublicKey = createUserResponse.cryptoPublicKey;
    this.user.serverSigningPublicKey = createUserResponse.signingPublicKey;
    this.user.cryptoKeyPair = await this.cryptoService.createEncryptionKey();
    this.user.signingKeyPair = await this.cryptoService.createSigningKey();
    const cryptedUser: CryptedUser = {
      id: this.user.id,
      cryptedUser: await this.cryptoService.encrypt(JSON.parse(this.user.serverCryptoPublicKey), JSON.stringify(this.user))
    };
    this.indexDbService.setUser(cryptedUser)
      .then(() => {
        this.ready = true;
        userSubject.next();
      });
  }

  isReady(): boolean {
    return this.ready;
  }

  getUser(): User {
    return this.user;
  }

  saveUser(user: User) {
    localStorage.setItem('user', JSON.stringify(user))
  }

  createUser(): Observable<CreateUserResponse> {
    let body = {};
    return this.http.post<CreateUserResponse>(`${environment.apiUrl}/user/create`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  confirmUser(pinHash: string, cryptedUser: CryptedUser): Observable<ConfirmUserResponse> {
    let body = {
      pinHash: pinHash,
      cryptedUser: cryptedUser,
    };
    return this.http.post<ConfirmUserResponse>(`${environment.apiUrl}/user/confirm`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  restoreUser(userId: string, encryptionPublicKey: JsonWebKey, signingPublicKey: JsonWebKey, subscription: string) {
    let body = {
      userId,
      encryptionPublicKey: JSON.stringify(encryptionPublicKey),
      signingPublicKey: JSON.stringify(signingPublicKey),
      subscription: subscription
    };
    return this.http.post<CreateUserResponse>(`${environment.apiUrl}/user/create`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getUserById(userId: string): Observable<GetUserResponse> {
    return this.http.get<GetUserResponse>(`${environment.apiUrl}/user/get/${userId}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getUserMessages(user: User): Observable<GetMessageResponse> {
    return this.http.get<GetMessageResponse>(`${environment.apiUrl}/message/get/userId/${user.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteUser(user: User): Observable<SimpleStatusResponse> {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/user/delete/${user.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  clearStorage() {
    /*localStorage.clear();
    this.user = {
      id: '',
      location: { latitude: 0, longitude: 0, plusCode: '' },
      local: navigator.language,
      language: navigator.language.split('-')[0],
      subscription: '',
      defaultStyle: this.style.getRandomStyle(),
      encryptionKeyPair: {
        publicKey: {},
        privateKey: {}
      },
      signingKeyPair: {
        publicKey: {},
        privateKey: {}
      },
      name: 'Unnamed user',
      base64Avatar: ''
    }*/
  }

  subscribe(user: User, subscription: string) {
    let body = {
      'userId': user.id,
      'subscription': subscription,
    };
    return this.http.post<SimpleStatusResponse>(`${environment.apiUrl}/user/subscribe`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  unsubscribe(user: User) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/user/unsubscribe/${user.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  registerSubscription(user: User) {
    this.swPush.requestSubscription({
      serverPublicKey: environment.vapid_public_key
    })
      .then(subscription => {
        let subscriptionJson = JSON.stringify(subscription);
        // Save subscription to user.
        this.subscribe(user, subscriptionJson)
          .subscribe({
            next: (simpleStatusResponse) => {
              if (simpleStatusResponse.status === 200) {
                user.subscription = JSON.stringify(subscription);
                this.saveUser(user);
              }
            },
            error: (err) => {
              user.subscription = '';
              this.saveUser(user);
            },
            complete: () => { }
          });
      })
      .catch(err => {
        user.subscription = '';
        this.saveUser(user);
      });
  }

  getLanguageForLocation(location: string): string {
    let language: string = '';
    let switchLocation: string = location.split('-').length === 2 ? location.split('-')[1].toUpperCase() : location.split('-')[0].toUpperCase();
    switch (switchLocation) {
      case 'AR':
        language = 'AR';
        break;
      case 'BG':
        language = 'BG';
        break;
      case 'CS':
        language = 'CS';
        break;
      case 'DE':
        language = 'DE';
        break;
      case 'EL':
        language = 'EL';
        break;
      case 'GB':
        language = location.toUpperCase();
        break;
      case 'US':
        language = location.toUpperCase();
        break;
      case 'ES':
        language = 'ES';
        break;
      case 'ET':
        language = 'ET';
        break;
      case 'FI':
        language = 'FI';
        break;
      case 'FR':
        language = 'FR';
        break;
      case 'HU':
        language = 'HU';
        break;
      case 'ID':
        language = 'ID';
        break;
      case 'IT':
        language = 'IT';
        break;
      case 'JA':
        language = 'JA';
        break;
      case 'KO':
        language = 'KO';
        break;
      case 'LT':
        language = 'LT';
        break;
      case 'LV':
        language = 'LV';
        break;
      case 'NB':
        language = 'NB';
        break;
      case 'NL':
        language = 'NL';
        break;
      case 'PL':
        language = 'PL';
        break;
      case 'BR':
        language = 'PT-BR';
        break;
      case 'PT':
        language = 'PT-PT';
        break;
      case 'RO':
        language = 'RO';
        break;
      case 'RU':
        language = 'RU';
        break;
      case 'SK':
        language = 'SK';
        break;
      case 'SL':
        language = 'SL';
        break;
      case 'SV':
        language = 'SV';
        break;
      case 'TR':
        language = 'TR';
        break;
      case 'UK':
        language = 'UK';
        break;
      case 'ZH':
        language = 'ZH';
        break;
      case 'HANS':
        language = 'HANS';
        break;
      case 'HANT':
        language = 'HANT';
        break;
      default:
        language = "EN-US";
        break;
    }
    return language;
  }

}
