import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
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

  constructor(private http: HttpClient, private networkService: NetworkService) { }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  public translate(value: string, language: string, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/translate/${language}/${value}`;
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
