import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { TranslateResponse } from '../interfaces/translate-response';

@Injectable({
  providedIn: 'root'
})
export class TranslateService {

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.apiToken}`,
      withCredentials: 'true'
    })
  };

  constructor(private http: HttpClient) { }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  public translate(value: string, language: string) {
    return this.http.get<TranslateResponse>(`${environment.apiUrl}/translate/${language}/${value}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

}
