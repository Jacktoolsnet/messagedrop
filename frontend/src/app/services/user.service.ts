import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { CreateUserResponse } from '../interfaces/create-user-response';
import { catchError, retry, throwError } from 'rxjs';
import { User } from '../interfaces/user';
import { Keypair } from '../interfaces/keypair';

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

  constructor(private http: HttpClient) { }

  private handleError(error: HttpErrorResponse) {
    if (error.status === 0) {
      // A client-side or network error occurred. Handle it accordingly.
      console.error('An error occurred:', error.error);
    } else {
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong.
      console.error(
        `Backend returned code ${error.status}, body was: `, error.error);
    }
    // Return an observable with a user-facing error message.
    return throwError(() => new Error('Something bad happened; please try again later.'));
  }

  getUser(): User {
    let user: User = JSON.parse(localStorage.getItem('user') || '{}');
    return user;
  }

  setUserId(user: User) {
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

  createUser(encryptionPublicKey?:JsonWebKey, signingPublicKey?:JsonWebKey) {
    let body = {
      encryptionPublicKey,
      signingPublicKey
    };
    return this.http.post<CreateUserResponse>(`${environment.apiUrl}/user/create`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }
}
