import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { CreateUserResponse } from '../interfaces/create-user-response';
import { catchError, retry, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type':  'application/json',
      Authorization: `Bearer ${environment.apiToken}`
    })
  };

  constructor(private http: HttpClient) { }

  private handleError(error: HttpErrorResponse) {
    if (error.status === 0) {
      // A client-side or network error occurred. Handle it accordingly.
      console.error('An error occurred:', error.error);
    } else {
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong.
      console.error(
        `Backend returned code ${error.status}, body was: `, error.error);
    }
    // Return an observable with a user-facing error message.
    return throwError(() => new Error('Something bad happened; please try again later.'));
  }

  getUser() {
    return localStorage.getItem('userId');
  }

  setUserId(userId: string) {
    localStorage.setItem('userId', userId)
  }

  createUser() {
    let body = {
      'publicKey': '12345'
    };
    return this.http.post<CreateUserResponse>(`${environment.apiUrl}/user/create`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }
}
