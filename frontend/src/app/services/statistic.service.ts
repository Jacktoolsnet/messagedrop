import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';

@Injectable({
  providedIn: 'root'
})
export class StatisticService {

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.apiToken}`
    })
  };

  constructor(private http: HttpClient) { }

  private handleError(error: HttpErrorResponse) {
    // Return an observable with a user-facing error message.
    return throwError(() => error);
  }

  countVisitor() {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/statistic/count/visitor`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  countMessage() {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/statistic/count/message`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

}
