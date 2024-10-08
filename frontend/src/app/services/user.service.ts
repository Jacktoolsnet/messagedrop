import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { CreateUserResponse } from '../interfaces/create-user-response';
import { catchError, throwError } from 'rxjs';
import { User } from '../interfaces/user';
import { Keypair } from '../interfaces/keypair';
import { GetUserResponse } from '../interfaces/get-user-response';
import { MessageService } from './message.service';
import { GetMessageResponse } from '../interfaces/get-message-response';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { Buffer } from 'buffer';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  private keyEncryptionDecryption!: CryptoKey;

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type':  'application/json',
      Authorization: `Bearer ${environment.apiToken}`
    })
  };

  constructor(private http: HttpClient, private messageService: MessageService) { }

  private handleError(error: HttpErrorResponse) {
    // Return an observable with a user-facing error message.
    return throwError(() => error);
  }

  loadUser(): User {
    let userFromLocalStorage: any = JSON.parse(localStorage.getItem('user') || '{}');
    let user!: User;
    if (JSON.stringify(userFromLocalStorage) === '{}') {
      user = {
        id : 'undefined',
        location : { latitude: 0, longitude: 0, plusCode: ''},
        local: navigator.language,
        language: navigator.language.split('-')[0],
        encryptionKeyPair: undefined,
        signingKeyPair: undefined,
        name : 'Unnamed user',
        base64Avatar: ''
      }
    } else {
      user = {
        id : undefined != userFromLocalStorage.id ? userFromLocalStorage.id : 'undefined',
        location : undefined != userFromLocalStorage.location ? userFromLocalStorage.location : { latitude: 0, longitude: 0, zoom: 19, plusCode: ''},
        local: undefined != userFromLocalStorage.local ? userFromLocalStorage.local : navigator.language,
        language: undefined != userFromLocalStorage.language ? userFromLocalStorage.language : navigator.language.split('-')[0],
        encryptionKeyPair : undefined != userFromLocalStorage.encryptionKeyPair ? userFromLocalStorage.encryptionKeyPair : undefined,
        signingKeyPair : undefined != userFromLocalStorage.signingKeyPair ? userFromLocalStorage.signingKeyPair : undefined,
        name : undefined != userFromLocalStorage.name ? userFromLocalStorage.name : 'Unnamed user',
        base64Avatar : undefined != userFromLocalStorage.base64Avatar ? userFromLocalStorage.base64Avatar : ''
      }
    }
    return user;
  }

  saveUser(user: User) {
    localStorage.setItem('user', JSON.stringify(user))
  }

  async createEncryptionKey(): Promise<Keypair> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 4096,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256"
      },
      true,
      ["encrypt", "decrypt"]
    );
    const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateKey = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const keypair: Keypair = {publicKey, privateKey};
    return keypair;
  }

  async createSigningKey(): Promise<Keypair> {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: "ECDSA",
        namedCurve: "P-384",
      },
      true,
      ["sign", "verify"],
    );
    const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateKey = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
    const keypair: Keypair = {publicKey, privateKey};
    return keypair;
  }

  async createSignature(signingUser: User): Promise<ArrayBuffer> {
    let signature: ArrayBuffer = new ArrayBuffer(0);
    if (signingUser.signingKeyPair!.privateKey) {
      let payload = Buffer.from(signingUser.id);
      let ecKeyImportParams: EcKeyImportParams = {
        name: "ECDSA",
        namedCurve: "P-384",
      };
      let privateKey = await crypto.subtle.importKey("jwk", signingUser.signingKeyPair!.privateKey, ecKeyImportParams, true, ["sign"]);
      signature = await window.crypto.subtle.sign(
        {
          name: "ECDSA",
          hash: { name: "SHA-384" },
        },
        privateKey,
        payload
      );  
    }
    return signature;
  }

  async verifySignature(signingUserId: string, signingPublicKey: JsonWebKey, signature: ArrayBuffer): Promise<Boolean> {
    let verified: Boolean = false
    let payload = Buffer.from(signingUserId);
    let ecKeyImportParams: EcKeyImportParams = {
      name: "ECDSA",
      namedCurve: "P-384",
    };     
    let publicKey = await crypto.subtle.importKey("jwk", signingPublicKey, ecKeyImportParams, true, ["verify"]);     
    verified = await crypto.subtle.verify({
        name: "ECDSA",
        hash: { name: "SHA-384" },
      },
      publicKey,
      signature, 
      payload
    );
    return verified
  }

  createUser(encryptionPublicKey?: JsonWebKey, signingPublicKey?: JsonWebKey) {
    let body = {
      encryptionPublicKey,
      signingPublicKey
    };
    return this.http.post<CreateUserResponse>(`${environment.apiUrl}/user/create`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  restoreUser(userId: string, encryptionPublicKey?: JsonWebKey, signingPublicKey?: JsonWebKey) {
    let body = {
      userId,
      encryptionPublicKey,
      signingPublicKey
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

  deleteUserFromStorage(): undefined {
    localStorage.removeItem('user')
    return undefined
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

}
