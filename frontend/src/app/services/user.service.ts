import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { CreateUserResponse } from '../interfaces/create-user-response';
import { catchError, throwError } from 'rxjs';
import { User } from '../interfaces/user';
import { GetUserResponse } from '../interfaces/get-user-response';
import { GetMessageResponse } from '../interfaces/get-message-response';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { SwPush } from '@angular/service-worker';
import { StyleService } from './style.service';
import { CryptoService } from './crypto.service';
import { Keypair } from '../interfaces/keypair';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private user: User = {
    id: '',
    location: {
      latitude: 0,
      longitude: 0,
      plusCode: ''
    },
    local: '',
    language: '',
    subscription: '',
    defaultStyle: '',
    encryptionKeyPair: {
      publicKey: {},
      privateKey: {}
    },
    signingKeyPair: {
      publicKey: {},
      privateKey: {}
    },
    name: '',
    base64Avatar: ''
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
    private style: StyleService,
    private cryptoService: CryptoService
  ) {
    this.loadUserFromLocalStorage();
    this.initUser();
  }

  private handleError(error: HttpErrorResponse) {
    // Return an observable with a user-facing error message.
    return throwError(() => error);
  }

  loadUserFromLocalStorage() {
    let userFromLocalStorage: any = JSON.parse(localStorage.getItem('user') || '{}');
    if (JSON.stringify(userFromLocalStorage) === '{}') {
      this.user = {
        id: '',
        location: { latitude: 0, longitude: 0, plusCode: '' },
        local: navigator.language,
        language: navigator.language,
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
        language: navigator.language,
        subscription: undefined != userFromLocalStorage.subscription ? userFromLocalStorage.subscription : '',
        defaultStyle: undefined != userFromLocalStorage.defaultStyle ? userFromLocalStorage.defaultStyle : this.style.getRandomStyle(),
        encryptionKeyPair: undefined != userFromLocalStorage.encryptionKeyPair ? userFromLocalStorage.encryptionKeyPair : {},
        signingKeyPair: undefined != userFromLocalStorage.signingKeyPair ? userFromLocalStorage.signingKeyPair : {},
        name: undefined != userFromLocalStorage.name ? userFromLocalStorage.name : 'Unnamed user',
        base64Avatar: undefined != userFromLocalStorage.base64Avatar ? userFromLocalStorage.base64Avatar : ''
      }
    }
  }

  initUser() {
    if (this.user.id === '') {
      this.cryptoService.createEncryptionKey()
        .then((encryptionKeyPair: Keypair) => {
          this.user!.encryptionKeyPair = encryptionKeyPair;
          this.cryptoService.createSigningKey()
            .then((signingKeyPair: Keypair) => {
              this.user!.signingKeyPair = signingKeyPair;
              this.createUser(this.user!.encryptionKeyPair?.publicKey, this.user!.signingKeyPair?.publicKey)
                .subscribe(createUserResponse => {
                  this.user!.id = createUserResponse.userId;
                  this.saveUser(this.user!);
                  this.ready = true;
                });
            });
        });
    } else {
      // Check if the user exist. It could be that the database was deleted.  
      this.checkUserById(this.user)
        .subscribe({
          next: (data) => {
          },
          error: (err) => {
            // Create the user when it does not exist in the database.
            if (err.status === 404) {
              this.restoreUser(this.user!.id, this.user!.encryptionKeyPair?.publicKey, this.user!.signingKeyPair?.publicKey, this.user!.subscription)
                .subscribe(createUserResponse => {
                  this.ready = true;
                });
            }
          },
          complete: () => {
            this.ready = true;
          }
        });
    }
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

  createUser(encryptionPublicKey?: JsonWebKey, signingPublicKey?: JsonWebKey) {
    let body = {
      encryptionPublicKey: JSON.stringify(encryptionPublicKey),
      signingPublicKey: JSON.stringify(signingPublicKey)
    };
    return this.http.post<CreateUserResponse>(`${environment.apiUrl}/user/create`, body, this.httpOptions)
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

  checkUserById(user: User) {
    return this.http.get<GetUserResponse>(`${environment.apiUrl}/user/get/${user.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getUserMessages(user: User) {
    return this.http.get<GetMessageResponse>(`${environment.apiUrl}/message/get/userId/${user.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteUser(user: User) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/user/delete/${user.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  clearStorage() {
    localStorage.clear();
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
    }
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

}
