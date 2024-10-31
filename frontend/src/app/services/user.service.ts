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

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private keyEncryptionDecryption!: CryptoKey;

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
  ) { }

  private handleError(error: HttpErrorResponse) {
    // Return an observable with a user-facing error message.
    return throwError(() => error);
  }

  loadUser(): User {
    let userFromLocalStorage: any = JSON.parse(localStorage.getItem('user') || '{}');
    let user!: User;
    if (JSON.stringify(userFromLocalStorage) === '{}') {
      user = {
        id: 'undefined',
        location: { latitude: 0, longitude: 0, plusCode: '' },
        local: navigator.language,
        language: navigator.language.split('-')[0],
        subscribed: false,
        defaultStyle: this.style.getRandomStyle(),
        encryptionKeyPair: undefined,
        signingKeyPair: undefined,
        name: 'Unnamed user',
        base64Avatar: ''
      }
    } else {
      user = {
        id: undefined != userFromLocalStorage.id ? userFromLocalStorage.id : 'undefined',
        location: undefined != userFromLocalStorage.location ? userFromLocalStorage.location : { latitude: 0, longitude: 0, zoom: 19, plusCode: '' },
        local: undefined != userFromLocalStorage.local ? userFromLocalStorage.local : navigator.language,
        language: undefined != userFromLocalStorage.language ? userFromLocalStorage.language : navigator.language.split('-')[0],
        subscribed: undefined != userFromLocalStorage.subscribed ? userFromLocalStorage.subscribed : false,
        defaultStyle: undefined != userFromLocalStorage.defaultStyle ? userFromLocalStorage.defaultStyle : this.style.getRandomStyle(),
        encryptionKeyPair: undefined != userFromLocalStorage.encryptionKeyPair ? userFromLocalStorage.encryptionKeyPair : undefined,
        signingKeyPair: undefined != userFromLocalStorage.signingKeyPair ? userFromLocalStorage.signingKeyPair : undefined,
        name: undefined != userFromLocalStorage.name ? userFromLocalStorage.name : 'Unnamed user',
        base64Avatar: undefined != userFromLocalStorage.base64Avatar ? userFromLocalStorage.base64Avatar : ''
      }
    }
    return user;
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

  restoreUser(userId: string, encryptionPublicKey?: JsonWebKey, signingPublicKey?: JsonWebKey) {
    let body = {
      userId,
      encryptionPublicKey: JSON.stringify(encryptionPublicKey),
      signingPublicKey: JSON.stringify(signingPublicKey)
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

  clearStorage(): undefined {
    localStorage.clear();
    return undefined;
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
    console.log('registerSubscription');
    this.swPush.requestSubscription({
      serverPublicKey: environment.vapid_public_key
    })
      .then(subscription => {
        let subscriptionJson = JSON.stringify(subscription);
        // Save subscription to user.
        console.log('registerSubscription save');
        this.subscribe(user, subscriptionJson)
          .subscribe({
            next: (simpleStatusResponse) => {
              console.log(simpleStatusResponse);
              if (simpleStatusResponse.status === 200) {
                user.subscribed = true;
                this.saveUser(user);
              }
            },
            error: (err) => {
              console.log(err);
              user.subscribed = false;
              this.saveUser(user);
            },
            complete: () => { }
          });
      })
      .catch(err => {
        console.log(err);
        user.subscribed = false;
        this.saveUser(user);
      });
  }

}
