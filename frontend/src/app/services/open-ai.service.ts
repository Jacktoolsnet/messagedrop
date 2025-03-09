import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Message } from '../interfaces/message';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';

@Injectable({
  providedIn: 'root'
})
export class OpenAiService {

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.apiToken}`
    })
  };

  constructor(
    private snackBar: MatSnackBar,
    private http: HttpClient
  ) { }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  moderateMessage(message: Message): Observable<any> {
    let body = {
      'message': message.message
    };
    return this.http.post<SimpleStatusResponse>(`${environment.apiUrl}/openai/moderate`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
  }
}
