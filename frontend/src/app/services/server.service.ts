import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { GetClientConnect } from '../interfaces/get-client-connect';

@Injectable({
  providedIn: 'root'
})
export class ServerService {

  private ready: boolean = false;
  private cryptoPublicKey: JsonWebKey | undefined;
  private signingPublicKey: JsonWebKey | undefined;

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.apiToken}`
    })
  };

  constructor(private http: HttpClient,) { }

  private handleError(error: HttpErrorResponse) {
    // Return an observable with a user-facing error message.
    return throwError(() => error);
  }

  init(serverSubject: Subject<void>) {
    this.connect()
      .subscribe({
        next: (connectResponse: GetClientConnect) => {
          if (connectResponse.status === 200) {
            this.cryptoPublicKey = connectResponse.cryptoPublicKey;
            this.signingPublicKey = connectResponse.signingPublicKey;
            serverSubject.next();
          }
        },
        error: (err) => {
          console.log(err);
        },
        complete: () => { }
      });
  }

  connect(): Observable<GetClientConnect> {
    return this.http.get<GetClientConnect>(`${environment.apiUrl}/clientconnect`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  isReady(): boolean {
    return this.ready;
  }

  public getCryptoPublicKey(): JsonWebKey | undefined {
    return this.cryptoPublicKey;
  }

  public getSigningPublicKey(): JsonWebKey | undefined {
    return this.signingPublicKey;
  }
}
