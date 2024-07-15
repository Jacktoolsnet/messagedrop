import { HttpHeaders, HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { throwError, catchError } from 'rxjs';
import { environment } from '../../environments/environment';
import { User } from '../interfaces/user';
import { Location } from '../interfaces/location';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationsService {

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type':  'application/json',
      Authorization: `Bearer ${environment.apiToken}`
    })
  };

  constructor(private http: HttpClient) { }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  subscribeToLocation(plusCode: string, user: User, name: string, subscrition: any) {
    console.log(subscrition);
    let body = {
      'userId': user.id,
      'plusCode': plusCode,
      'name': name,
      'subscription': JSON.stringify(subscrition)
    };
    console.log(body);
    return this.http.post<SimpleStatusResponse>(`${environment.apiUrl}/locationPushSubscription/subscribe`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  isUserSubscribedToLocation(plusCode: string, user:User) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/locationPushSubscription/get/${user.id}/${plusCode}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  unsubscribedToLocation(plusCode: string, user:User) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/locationPushSubscription/unsubscribe/${user.id}/${plusCode}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }
}
