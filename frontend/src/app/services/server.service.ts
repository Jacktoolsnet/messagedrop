import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { GetClientConnect } from '../interfaces/get-client-connect';
import { NetworkService } from './network.service';

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
      Authorization: `Bearer ${environment.apiToken}`,
      withCredentials: 'true'
    })
  };

  constructor(private http: HttpClient, private networkService: NetworkService) { }

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
        complete: () => { }
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
