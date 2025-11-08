import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { GetClientConnect } from '../interfaces/get-client-connect';
import { NetworkService } from './network.service';

@Injectable({
  providedIn: 'root'
})
export class ServerService {

  private _serverSet = signal(0);
  readonly serverSet = this._serverSet.asReadonly();

  private ready = false;
  private failed = false;
  private cryptoPublicKey: JsonWebKey | undefined;
  private signingPublicKey: JsonWebKey | undefined;

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-Authorization': `${environment.apiToken}`,
      withCredentials: 'true'
    })
  };

  private readonly http = inject(HttpClient);
  private readonly networkService = inject(NetworkService);

  private handleError(error: HttpErrorResponse) {
    // Return an observable with a user-facing error message.
    return throwError(() => error);
  }

  init() {
    this.connect().subscribe({
      next: (connectResponse: GetClientConnect) => {
        if (connectResponse.status === 200) {
          this.cryptoPublicKey = connectResponse.cryptoPublicKey;
          this.signingPublicKey = connectResponse.signingPublicKey;
          this.ready = true;
          this.failed = false;
          this._serverSet.update(trigger => trigger + 1);
        }
      },
      error: () => {
        this.ready = false;
        this.failed = true;
        this._serverSet.update(trigger => trigger + 1);
      }
    });
  }

  connect(): Observable<GetClientConnect> {
    const url = `${environment.apiUrl}/clientconnect`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: 'Connecting',
      image: '',
      icon: '',
      message: `Connecting to backend...`,
      button: '',
      delay: 0,
      showSpinner: true,
    });
    return this.http.get<GetClientConnect>(url, this.httpOptions)
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
