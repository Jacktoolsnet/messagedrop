import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Observable, Subject, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { DisplayMessage } from '../components/utils/display-message/display-message.component';
import { GetClientConnect } from '../interfaces/get-client-connect';

@Injectable({
  providedIn: 'root'
})
export class ServerService {

  private ready: boolean = false;
  private failed: boolean = false;
  private cryptoPublicKey: JsonWebKey | undefined;
  private signingPublicKey: JsonWebKey | undefined;

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.apiToken}`
    })
  };

  constructor(private http: HttpClient, private displayMessage: MatDialog) { }

  private handleError(error: HttpErrorResponse) {
    // Return an observable with a user-facing error message.
    return throwError(() => error);
  }

  init(serverSubject: Subject<void>) {
    const displayMessageRef = this.displayMessage.open(DisplayMessage, {
      data: {
        title: 'Connecting',
        image: '',
        message: `Connecting to backend...`,
        button: '',
        delay: 0,
        showSpinner: true
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      closeOnNavigation: false,
      hasBackdrop: false
    });
    this.connect()
      .subscribe({
        next: (connectResponse: GetClientConnect) => {
          if (connectResponse.status === 200) {
            this.cryptoPublicKey = connectResponse.cryptoPublicKey;
            this.signingPublicKey = connectResponse.signingPublicKey;
            this.ready = true;
            this.failed = false;
            serverSubject.next();
          }
        },
        error: (err) => {
          this.ready = false;
          this.failed = true;
          serverSubject.next();
        },
        complete: () => { displayMessageRef.close(); }
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

  isFailed(): boolean {
    return this.failed;
  }

  public getCryptoPublicKey(): JsonWebKey | undefined {
    return this.cryptoPublicKey;
  }

  public getSigningPublicKey(): JsonWebKey | undefined {
    return this.signingPublicKey;
  }
}
