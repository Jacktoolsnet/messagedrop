import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { catchError, Subject, throwError } from 'rxjs';
import { Location } from '../interfaces/location';
import { User } from '../interfaces/user';
import { GetMessageResponse } from '../interfaces/get-message-response';
import { GeolocationService } from './geolocation.service';
import { Message } from '../interfaces/message';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { LikedByUserResponse } from '../interfaces/liked-by-user-respons';
import { DislikedByUserResponse } from '../interfaces/disliked-by-user-respons';
import { MapService } from './map.service';
import { MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { StatisticService } from './statistic.service';

@Injectable({
  providedIn: 'root'
})
export class MessageService {

  public messages: Message[] = [];
  public lastSearchedLocation: string = '';

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.apiToken}`
    })
  };

  constructor(
    private snackBar: MatSnackBar,
    private statisticService: StatisticService,
    private http: HttpClient,
    private mapService: MapService,
    private geolocationService: GeolocationService
  ) { }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  getMessages(): Message[] {
    return this.messages;
  }

  clearMessages() {
    this.messages = [];
  }

  getLastSearchedLocation(): string {
    return this.lastSearchedLocation;
  }

  createMessage(message: Message, location: Location, user: User) {
    let body = {
      'parentMessageId': message.parentId,
      'messageTyp': message.typ,
      'latitude': location.latitude,
      'longtitude': location.longitude,
      'plusCode': location.plusCode,
      'message': message.message,
      'markerType': message.markerType,
      'style': message.style,
      'messageUserId': user.id
    };
    this.http.post<SimpleStatusResponse>(`${environment.apiUrl}/message/create`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: createMessageResponse => {
          this.snackBar.open(`Message succesfully dropped.`, '', { duration: 1000 });
          this.statisticService.countMessage()
            .subscribe({
              next: (data) => { },
              error: (err) => { },
              complete: () => { }
            });
        },
        error: (err) => { this.snackBar.open(err.message, 'OK'); },
        complete: () => { }
      })
  }

  updateMessage(message: Message, location: Location, user: User) {
    let body = {
      'id': message.id,
      'message': message.message,
      'style': message.style
    };
    this.http.post<SimpleStatusResponse>(`${environment.apiUrl}/message/update`, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: createMessageResponse => {
          this.snackBar.open(`Message succesfully dropped.`, '', { duration: 1000 });
        },
        error: (err: any) => { this.snackBar.open(err.message, 'OK'); },
        complete: () => { }
      });
  }

  likeMessage(message: Message, user: User, likeButtonColor: string) {
    this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/message/like/${message.id}/by/${user.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            message.likes = message.likes + 1;
            likeButtonColor = 'primary';
            message.likedByUser = true;
          }
        },
        error: (err) => {
        },
        complete: () => { }
      })
  }

  unlikeMessage(message: Message, user: User, likeButtonColor: string) {
    this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/message/unlike/${message.id}/by/${user.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            message.likes = message.likes - 1;
            likeButtonColor = 'secondary';
            message.likedByUser = false;
          }
        },
        error: (err) => {
        },
        complete: () => { }
      })
  }

  messageLikedByUser(message: Message, user: User, likeButtonColor: string) {
    this.http.get<LikedByUserResponse>(`${environment.apiUrl}/message/id/${message.id}/likedby/${user.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (likedByUserResponse) => {
          if (likedByUserResponse.status === 200 && likedByUserResponse.likedByUser) {
            likeButtonColor = 'primary';
            message.likedByUser = true;
          } else {
            likeButtonColor = 'secondary';
            message.likedByUser = false;
          }
        },
        error: (err) => {
        },
        complete: () => { }
      })
  }

  dislikeMessage(message: Message, user: User, dislikeButtonColor: string) {
    this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/message/dislike/${message.id}/by/${user.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            message.dislikes = message.dislikes + 1;
            dislikeButtonColor = 'primary';
            message.dislikedByUser = true;
          }
        },
        error: (err) => {
        },
        complete: () => { }
      })
  }

  undislikeMessage(message: Message, user: User, dislikeButtonColor: string) {
    this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/message/undislike/${message.id}/by/${user.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            message.dislikes = message.dislikes - 1;
            dislikeButtonColor = 'secondary';
            message.dislikedByUser = false;
          }
        },
        error: (err) => {
        },
        complete: () => { }
      })
  }

  messageDislikedByUser(message: Message, user: User, dislikeButtonColor: string) {
    return this.http.get<DislikedByUserResponse>(`${environment.apiUrl}/message/id/${message.id}/dislikedby/${user.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (dislikedByUserResponse) => {
          if (dislikedByUserResponse.status === 200 && dislikedByUserResponse.dislikedByUser) {
            dislikeButtonColor = 'primary';
            message.dislikedByUser = true;
          } else {
            dislikeButtonColor = 'secondary';
            message.dislikedByUser = false;
          }
        },
        error: (err) => {
        },
        complete: () => { }
      });
  }

  getByPlusCode(location: Location, messageSubject: Subject<boolean>) {
    this.http.get<GetMessageResponse>(`${environment.apiUrl}/message/get/pluscode/${this.geolocationService.getPlusCodeBasedOnMapZoom(location, this.mapService.getMapZoom())}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (getMessageResponse) => {
          this.lastSearchedLocation = this.geolocationService.getPlusCodeBasedOnMapZoom(location, this.mapService.getMapZoom());
          this.messages = [...getMessageResponse.rows];
          messageSubject.next(true);
        },
        error: (err) => {
          this.lastSearchedLocation = this.geolocationService.getPlusCodeBasedOnMapZoom(location, this.mapService.getMapZoom());
          this.messages = [];
          messageSubject.next(true);
        },
        complete: () => { }
      });
  }

  getByPlusForMarker(location: Location) {
    return this.http.get<GetMessageResponse>(`${environment.apiUrl}/message/get/pluscode/${location.plusCode}`, this.httpOptions)
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

  countComment(message: Message) {
    return this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/message/countcomment/${message.id}`, this.httpOptions)
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

  deleteMessage(message: Message, selectedMessages: Message[], dialogRef: MatDialogRef<any>) {
    this.http.get<SimpleStatusResponse>(`${environment.apiUrl}/message/delete/${message.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            this.messages = this.messages.filter(element => element.id !== message.id);
            selectedMessages.pop();
            if (this.messages.length === 0) {
              dialogRef.close();
            }
          }
        },
        error: (err) => {
        },
        complete: () => { }
      });
  }

  getCommentsForParentMessage(parentMessage: Message) {
    return this.http.get<GetMessageResponse>(`${environment.apiUrl}/message/get/comment/${parentMessage.id}`, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }
}
