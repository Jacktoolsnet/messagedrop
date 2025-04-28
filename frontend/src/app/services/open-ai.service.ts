import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Message } from '../interfaces/message';

@Injectable({
  providedIn: 'root'
})
export class OpenAiService {

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.apiToken}`,
      withCredentials: 'true'
    })
  };

  constructor(
    private http: HttpClient
  ) { }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  public moderateMessage(message: Message): Observable<any> {
    let body = {
      'message': message.message
    };
    return this.http.post<any>(`${environment.apiUrl}/openai/moderate`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
  }
}
