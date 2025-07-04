import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, Subject, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { DislikedByUserResponse } from '../interfaces/disliked-by-user-respons';
import { GetMessageResponse } from '../interfaces/get-message-response';
import { LikedByUserResponse } from '../interfaces/liked-by-user-respons';
import { Location } from '../interfaces/location';
import { Message } from '../interfaces/message';
import { RawMessage } from '../interfaces/raw-message';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { User } from '../interfaces/user';
import { GeolocationService } from './geolocation.service';
import { MapService } from './map.service';
import { NetworkService } from './network.service';
import { StatisticService } from './statistic.service';

@Injectable({
  providedIn: 'root'
})
export class MessageService {

  private messages: Message[] = [];
  public selectedMessages: Message[] = [];
  private comments: Message[] = [];
  private lastSearchedLocation: string = '';

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-Authorization': `${environment.apiToken}`,
      withCredentials: 'true'
    })
  };

  constructor(
    private snackBar: MatSnackBar,
    private statisticService: StatisticService,
    private http: HttpClient,
    private mapService: MapService,
    private geolocationService: GeolocationService,
    private networkService: NetworkService
  ) { }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  getMessages(): Message[] {
    return this.messages;
  }

  setMessages(rawMessages: RawMessage[]) {
    this.messages = [];
    rawMessages.forEach((rawMessage: RawMessage) => {
      let message: Message = {
        id: rawMessage.id,
        parentId: rawMessage.parentId,
        typ: rawMessage.typ,
        createDateTime: rawMessage.createDateTime,
        deleteDateTime: rawMessage.deleteDateTime,
        location: {
          latitude: rawMessage.latitude,
          longitude: rawMessage.longitude,
          plusCode: rawMessage.plusCode,
        },
        message: rawMessage.message,
        markerType: rawMessage.markerType,
        style: rawMessage.style,
        views: rawMessage.views,
        likes: rawMessage.likes,
        dislikes: rawMessage.dislikes,
        comments: [],
        commentsNumber: rawMessage.commentsNumber,
        status: rawMessage.status,
        userId: rawMessage.userId,
        multimedia: JSON.parse(rawMessage.multimedia)
      };
      this.messages.push(message);
    });
  }

  getSelectedMessages(): Message[] {
    return this.selectedMessages;
  }

  getComments(): Message[] {
    return this.comments;
  }

  clearMessages() {
    this.messages = [];
  }

  clearComments() {
    this.comments = [];
  }

  clearSelectedMessages() {
    this.selectedMessages = [];
  }
  getLastSearchedLocation(): string {
    return this.lastSearchedLocation;
  }

  createMessage(message: Message, user: User, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/message/create`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Creating message`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    let body = {
      'parentMessageId': message.parentId,
      'messageTyp': message.typ,
      'latitude': message.location.latitude,
      'longtitude': message.location.longitude,
      'plusCode': message.location.plusCode,
      'message': message.message,
      'markerType': message.markerType,
      'style': message.style,
      'messageUserId': user.id,
      'multimedia': JSON.stringify(message.multimedia)
    };
    this.http.post<SimpleStatusResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: createMessageResponse => {
          this.messages.unshift(message);
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

  createComment(message: Message, user: User, showAlways: boolean = false) {
    let parentMessage: Message = this.selectedMessages[this.selectedMessages.length - 1];
    let url = `${environment.apiUrl}/message/create`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Creating message`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    let body = {
      'parentMessageId': message.parentId,
      'messageTyp': message.typ,
      'latitude': message.location.latitude,
      'longtitude': message.location.longitude,
      'plusCode': message.location.plusCode,
      'message': message.message,
      'markerType': message.markerType,
      'style': message.style,
      'messageUserId': user.id,
      'multimedia': JSON.stringify(message.multimedia)
    };
    this.http.post<SimpleStatusResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: createMessageResponse => {
          parentMessage.comments.push(message);
          this.snackBar.open(`Comment succesfully dropped.`, '', { duration: 1000 });
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

  updateMessage(message: Message, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/message/update`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Updating message`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    let body = {
      'id': message.id,
      'message': message.message,
      'style': message.style,
      'multimedia': JSON.stringify(message.multimedia)
    };
    this.http.post<SimpleStatusResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: createMessageResponse => {
          this.snackBar.open(`Succesfully updated.`, '', { duration: 1000 });
        },
        error: (err: any) => { this.snackBar.open(err.message, 'OK'); },
        complete: () => { }
      });
  }

  likeMessage(message: Message, user: User, likeButtonColor: string, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/message/like/${message.id}/by/${user.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Liking message`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    this.http.get<SimpleStatusResponse>(url, this.httpOptions)
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

  unlikeMessage(message: Message, user: User, likeButtonColor: string, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/message/unlike/${message.id}/by/${user.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Unliking message`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    this.http.get<SimpleStatusResponse>(url, this.httpOptions)
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
    let url = `${environment.apiUrl}/message/id/${message.id}/likedby/${user.id}`;
    this.http.get<LikedByUserResponse>(url, this.httpOptions)
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

  dislikeMessage(message: Message, user: User, dislikeButtonColor: string, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/message/dislike/${message.id}/by/${user.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `disliking message`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    this.http.get<SimpleStatusResponse>(url, this.httpOptions)
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

  undislikeMessage(message: Message, user: User, dislikeButtonColor: string, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/message/undislike/${message.id}/by/${user.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Undisliking message`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    this.http.get<SimpleStatusResponse>(url, this.httpOptions)
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
    let url = `${environment.apiUrl}/message/id/${message.id}/dislikedby/${user.id}`;
    return this.http.get<DislikedByUserResponse>(url, this.httpOptions)
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

  getByPlusCode(location: Location, messageSubject: Subject<void>, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/message/get/pluscode/${this.geolocationService.getPlusCodeBasedOnMapZoom(location, this.mapService.getMapZoom())}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Loading message`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    this.http.get<GetMessageResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (getMessageResponse) => {
          this.lastSearchedLocation = this.geolocationService.getPlusCodeBasedOnMapZoom(location, this.mapService.getMapZoom());
          this.clearMessages();
          getMessageResponse.rows.forEach((rawMessage: RawMessage) => {
            let message: Message = {
              id: rawMessage.id,
              parentId: rawMessage.parentId,
              typ: rawMessage.typ,
              createDateTime: rawMessage.createDateTime,
              deleteDateTime: rawMessage.deleteDateTime,
              location: {
                latitude: rawMessage.latitude,
                longitude: rawMessage.longitude,
                plusCode: rawMessage.plusCode,
              },
              message: rawMessage.message,
              markerType: rawMessage.markerType,
              style: rawMessage.style,
              views: rawMessage.views,
              likes: rawMessage.likes,
              dislikes: rawMessage.dislikes,
              comments: [],
              commentsNumber: rawMessage.commentsNumber,
              status: rawMessage.status,
              userId: rawMessage.userId,
              multimedia: JSON.parse(rawMessage.multimedia)
            };
            this.messages.push(message);
          });
          messageSubject.next();
        },
        error: (err) => {
          this.lastSearchedLocation = this.geolocationService.getPlusCodeBasedOnMapZoom(location, this.mapService.getMapZoom());
          this.messages = [];
          messageSubject.next();
        },
        complete: () => { }
      });
  }

  getByPlusForMarker(location: Location, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/message/get/pluscode/${location.plusCode}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Loading message`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    return this.http.get<GetMessageResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  navigateToMessageLocation(message: Message) {
    let url: string = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(message.location.plusCode)}`;
    window.open(url, '_blank');
  }

  countView(message: Message) {
    let url = `${environment.apiUrl}/message/countview/${message.id}`;
    this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (SimpleStatusResponse) => {
          if (SimpleStatusResponse.status === 200) {
            message.views = message.views + 1;
          }
        },
        error: (err: any) => {
        },
        complete: () => { }
      });
  }

  countComment(message: Message) {
    let url = `${environment.apiUrl}/message/countcomment/${message.id}`;
    return this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (SimpleStatusResponse) => {
          if (SimpleStatusResponse.status === 200) {
            message.commentsNumber = message.commentsNumber + 1;
          }
        },
        error: (err) => {
        },
        complete: () => { }
      });
  }

  disableMessage(message: Message, selectedMessages: Message[], showAlways: boolean = false) {
    let url = `${environment.apiUrl}/message/disable/${message.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Disableing message`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            this.messages = this.messages.filter(element => element.id !== message.id);
            selectedMessages.pop();
          }
        },
        error: (err) => {
        },
        complete: () => { }
      });
  }

  deleteMessage(message: Message, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/message/delete/${message.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Deleting message`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            if (this.messages.map(e => e.id).indexOf(message.id) !== -1) {
              this.messages.splice(this.messages.map(e => e.id).indexOf(message.id), 1);
            } else if (this.messages.map(e => e.id).indexOf(message.parentId) !== -1) {
              let parentMessageIndex = this.messages.map(e => e.id).indexOf(message.parentId)
              this.messages[parentMessageIndex].comments.splice(this.messages[parentMessageIndex].comments.map(e => e.id).indexOf(message.id), 1);
            }
            // The last selected message was deleted. So remove it from the selectedMessage array.
            this.selectedMessages.pop();
          }
        },
        error: (err) => {
        },
        complete: () => { }
      });
  }

  getCommentsForParentMessage(message: Message, showAlways: boolean = false) {
    let url = `${environment.apiUrl}/message/get/comment/${message.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Loading comments`,
      button: '',
      delay: 0,
      showSpinner: true
    });
    return this.http.get<GetMessageResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (getMessageResponse) => {
          message.comments = [];
          getMessageResponse.rows.forEach((rawMessage: RawMessage) => {
            let comment: Message = {
              id: rawMessage.id,
              parentId: rawMessage.parentId,
              typ: rawMessage.typ,
              createDateTime: rawMessage.createDateTime,
              deleteDateTime: rawMessage.deleteDateTime,
              location: {
                latitude: rawMessage.latitude,
                longitude: rawMessage.longitude,
                plusCode: rawMessage.plusCode,
              },
              message: rawMessage.message,
              markerType: rawMessage.markerType,
              style: rawMessage.style,
              views: rawMessage.views,
              likes: rawMessage.likes,
              dislikes: rawMessage.dislikes,
              comments: [],
              commentsNumber: rawMessage.commentsNumber,
              status: rawMessage.status,
              userId: rawMessage.userId,
              multimedia: JSON.parse(rawMessage.multimedia)
            };
            message.comments.push(comment);
          });
        },
        error: (err) => {
          message.comments = [];
        },
        complete: () => { }
      });
  }

  detectPersonalInformation(text: string): boolean {
    // 🔍 Regex-Muster für verschiedene PII-Typen
    const patterns: RegExp[] = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,  // E-Mail-Adresse
      /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}\b/,  // Internationale Telefonnummern
      /\b(?:\d[ -]*?){13,19}\b/,  // Kreditkarten (Visa, Mastercard, Amex, etc.)
      /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}\b/,  // IBAN (international)
      /\b(?:\d{1,3}\.){3}\d{1,3}\b/,  // IPv4-Adresse
      /\b(?:[a-fA-F0-9:]+:+)+[a-fA-F0-9]+\b/,  // IPv6-Adresse
      /\b\d{3}-\d{2}-\d{4}\b/,  // US Social Security Number (SSN)
      /\b\d{2}-\d{7}|\d{9}|\d{10}\b/,  // Steuernummern
      /\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b/,  // Datum
      /\b(?:Name|Vorname|Nachname|Adresse|Straße|Telefon|Konto|IBAN|Passnummer|PLZ|Personalausweis|Steuernummer)\b/i  // Relevante Begriffe
    ];

    // Prüfen, ob irgendein Muster im Text gefunden wird
    return patterns.some(pattern => pattern.test(text));
  }

}
