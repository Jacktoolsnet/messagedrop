import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { TranslateResponse } from '../interfaces/translate-response';
import { NetworkService } from './network.service';

@Injectable({
  providedIn: 'root'
})
export class TranslateService {

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
    return throwError(() => error);
  }

  public translate(value: string, language: string, showAlways = false) {
    const url = `${environment.apiUrl}/translate/${language}/${value}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Translate service',
      image: '',
      icon: '',
      message: `Translating message`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    return this.http.get<TranslateResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

}
