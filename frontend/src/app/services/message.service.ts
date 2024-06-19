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
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { LikedByUserResponse } from '../interfaces/liked-by-user-respons';
import { DislikedByUserResponse } from '../interfaces/disliked-by-user-respons';


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

  createMessage(message: Message, location: Location, user:User) {
    let body = {
      'parentMessageId': 0,
      'messageTyp': message.typ,
      'latitude': location.latitude,
      'longtitude': location.longitude,
      'plusCode': location.plusCode,
      'message': message.message,
      'markerType': message.markerType,
      'style': message.style,
      'messageUserId': user.id
    };
    return this.http.post<CreateMessageResponse>(`${environment.apiUrl}/message/create`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  updateMessage(message: Message, location: Location, user:User) {
    let body = {
      'id': message.id,
      'message': message.message,
      'style': message.style
    };
    return this.http.post<CreateMessageResponse>(`${environment.apiUrl}/message/update`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  likeMessage(message: Message, user: User) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/message/like/${message.id}/by/${user.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  unlikeMessage(message: Message, user: User) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/message/unlike/${message.id}/by/${user.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  messageLikedByUser(message: Message, user: User) {
    return this.http.get<LikedByUserResponse>(`${environment.apiUrl}/message/id/${message.id}/likedby/${user.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  dislikeMessage(message: Message, user: User) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/message/dislike/${message.id}/by/${user.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  undislikeMessage(message: Message, user: User) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/message/undislike/${message.id}/by/${user.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  messageDislikedByUser(message: Message, user: User) {
    return this.http.get<DislikedByUserResponse>(`${environment.apiUrl}/message/id/${message.id}/dislikedby/${user.id}`, this.httpOptions)
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

  countView(message: Message) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/message/countview/${message.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  disableMessage(message: Message) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/message/disable/${message.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  deleteMessage(message: Message) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/message/delete/${message.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }
}
