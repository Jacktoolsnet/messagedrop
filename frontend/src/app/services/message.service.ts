import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { CreateMessageResponse } from '../interfaces/create-message-response';
import { catchError, retry, throwError } from 'rxjs';
import { Location } from '../interfaces/location';
import { User } from '../interfaces/user';
import { GetMessageResponse } from '../interfaces/get-message-response';


@Injectable({
  providedIn: 'root'
})
export class MessageService {

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

  createPublicMessage(message: string, location: Location, user:User) {
    let body = {
      'parentMessageId': 0,
      'messageTyp': 'public',
      'latitude': location.latitude,
      'longtitude': location.longitude,
      'plusCode': location.plusCode,
      'message': message,
      'messageUserId': user.userId
    };
    return this.http.post<CreateMessageResponse>(`${environment.apiUrl}/message/create`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getByPlusCode(location: Location) {
    let plusCode: string = '';
    switch (location.zoom) {
      case 19:
      case 18:
        plusCode = location.plusCode.substring(0, 8);
        break;
      case 17:
      case 16:
      case 15:
        plusCode = location.plusCode.substring(0, 6);
        break;
      case 14:
      case 13:
      case 12:
      case 11:
      case 10:
        plusCode = location.plusCode.substring(0, 4);
        break;
      default:
        plusCode = location.plusCode
        break;
    }
    return this.http.get<GetMessageResponse>(`${environment.apiUrl}/message/get/pluscode/${plusCode}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

}
