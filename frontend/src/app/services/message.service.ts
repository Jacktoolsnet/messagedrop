import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { CreateMessageResponse } from '../interfaces/create-message-response';
import { catchError, retry, throwError } from 'rxjs';
import { Location } from '../interfaces/location';
import { User } from '../interfaces/user';
import { GetMessageResponse } from '../interfaces/get-message-response';
import { GeolocationService } from './geolocation.service';
import { Message } from '../interfaces/message';


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

  constructor(private http: HttpClient, private geolocationService: GeolocationService) { }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  createPublicMessage(message: Message, location: Location, user:User) {
    let body = {
      'parentMessageId': 0,
      'messageTyp': 'public',
      'latitude': location.latitude,
      'longtitude': location.longitude,
      'plusCode': location.plusCode,
      'message': message.message,
      'style': message.style,
      'messageUserId': user.id
    };
    return this.http.post<CreateMessageResponse>(`${environment.apiUrl}/message/create`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getByPlusCode(location: Location) {
    let plusCode: String = this.geolocationService.getPlusCodeBasedOnMapZoom(location);
    return this.http.get<GetMessageResponse>(`${environment.apiUrl}/message/get/pluscode/${plusCode}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getByPlusForMarker(location: Location) {
    let plusCode: String = location.plusCode;
    return this.http.get<GetMessageResponse>(`${environment.apiUrl}/message/get/pluscode/${plusCode}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  navigateToMessageLocation(user: User, message: Message) {
    let url: string = `https://www.google.com/maps/dir/${encodeURIComponent(user.location.plusCode)}/${encodeURIComponent(message.plusCode)}`
    window.open(url, '_blank');
  }

}
