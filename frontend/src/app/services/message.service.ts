import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, signal, WritableSignal } from '@angular/core';
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

  readonly messagesSignal = signal<Message[]>([]);
  readonly selectedMessagesSignal = signal<Message[]>([]);
  readonly commentsSignal = signal<Message[]>([]);
  readonly commentsSignals = new Map<string, WritableSignal<Message[]>>();
  readonly commentCountsSignal = signal<Record<string, number>>({});

  private commentCounts: Record<string, number> = {};

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

  setMessages(messages: Message[]) {
    this.commentCounts = {};
    messages.forEach(msg => {
      this.commentCounts[msg.uuid] = msg.commentsNumber;
    });
    this.commentCountsSignal.set(this.commentCounts);
    this.messagesSignal.set(messages);
  }

  clearMessages() {
    this.messagesSignal.set([]);
  }

  clearSelectedMessages() {
    this.selectedMessagesSignal.set([]);
  }

  getLastSearchedLocation(): string {
    return this.lastSearchedLocation;
  }

  getCommentsSignalForMessage(parentUuid: string): WritableSignal<Message[]> {
    if (!this.commentsSignals.has(parentUuid)) {
      this.commentsSignals.set(parentUuid, signal<Message[]>([]));
    }
    return this.commentsSignals.get(parentUuid)!;
  }

  public mapRawMessages(rawMessages: RawMessage[]): Message[] {
    let messages: Message[] = [];
    rawMessages.forEach(rawMessage => messages.push(this.mapRawMessage(rawMessage)));
    return messages;
  }

  private mapRawMessage(raw: RawMessage): Message {
    return {
      id: raw.id,
      uuid: raw.uuid,
      parentId: raw.parentId,
      parentUuid: raw.parentUuid,
      typ: raw.typ,
      createDateTime: raw.createDateTime,
      deleteDateTime: raw.deleteDateTime,
      location: {
        latitude: raw.latitude,
        longitude: raw.longitude,
        plusCode: raw.plusCode,
      },
      message: raw.message,
      markerType: raw.markerType,
      style: raw.style,
      views: raw.views,
      likes: raw.likes,
      dislikes: raw.dislikes,
      comments: [],
      commentsNumber: raw.commentsNumber,
      status: raw.status,
      userId: raw.userId,
      multimedia: JSON.parse(raw.multimedia)
    };
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
      uuid: message.uuid,
      parentMessageId: message.parentId,
      parentUuid: message.parentUuid,
      messageTyp: message.typ,
      latitude: message.location.latitude,
      longitude: message.location.longitude,
      plusCode: message.location.plusCode,
      message: message.message,
      markerType: message.markerType,
      style: message.style,
      messageUserId: user.id,
      multimedia: JSON.stringify(message.multimedia)
    };
    this.http.post<SimpleStatusResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: createMessageResponse => {
          this.messagesSignal.update(messages => [message, ...messages]);
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

  public createComment(message: Message, user: User, showAlways: boolean = false) {
    const url = `${environment.apiUrl}/message/create`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Creating message`,
      button: '',
      delay: 0,
      showSpinner: true
    });

    const body = {
      uuid: message.uuid,
      parentMessageId: message.parentId,
      parentUuid: message.parentUuid,
      messageTyp: message.typ,
      latitude: message.location.latitude,
      longitude: message.location.longitude,
      plusCode: message.location.plusCode,
      message: message.message,
      markerType: message.markerType,
      style: message.style,
      messageUserId: user.id,
      multimedia: JSON.stringify(message.multimedia)
    };

    this.http.post<SimpleStatusResponse>(url, body, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: () => {
          const commentsSignal = this.getCommentsSignalForMessage(message.parentUuid!);
          commentsSignal.set([...commentsSignal(), message]);

          this.commentCounts[message.parentUuid] = this.commentCounts[message.parentUuid] + 1;

          this.snackBar.open(`Comment successfully dropped.`, '', { duration: 1000 });
          this.statisticService.countMessage().subscribe({ complete: () => { } });
        },
        error: (err) => {
          this.snackBar.open(err.message, 'OK')
        }
      });
  }

  updateMessage(message: Message, showAlways: boolean = false) {
    const url = `${environment.apiUrl}/message/update`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Updating message`,
      button: '',
      delay: 0,
      showSpinner: true
    });

    const body = {
      'id': message.id,
      'message': message.message,
      'style': message.style,
      'multimedia': JSON.stringify(message.multimedia)
    };

    this.http.post<SimpleStatusResponse>(url, body, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: () => {
          // Update der Nachricht im State
          this.messagesSignal.update(messages => {
            return messages.map(m => m.id === message.id ? { ...m, ...message } : m);
          });
        },
        error: err => this.snackBar.open(err.message, 'OK')
      });
  }

  likeMessage(message: Message, user: User, showAlways: boolean = false) {
    const url = `${environment.apiUrl}/message/like/${message.id}/by/${user.id}`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Liking message`,
      button: '',
      delay: 0,
      showSpinner: true
    });

    this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            // Message State updaten
            this.messagesSignal.update(messages => {
              return messages.map(m => m.id === message.id
                ? { ...m, likes: m.likes + 1, likedByUser: true }
                : m
              );
            });
          }
        },
        error: () => { }
      });
  }

  unlikeMessage(message: Message, user: User, showAlways: boolean = false) {
    const url = `${environment.apiUrl}/message/unlike/${message.id}/by/${user.id}`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Unliking message`,
      button: '',
      delay: 0,
      showSpinner: true
    });

    this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            this.messagesSignal.update(messages => {
              return messages.map(m => m.id === message.id
                ? { ...m, likes: m.likes - 1, likedByUser: false }
                : m
              );
            });
          }
        },
        error: () => { }
      });
  }

  messageLikedByUser(message: Message, user: User) {
    const url = `${environment.apiUrl}/message/id/${message.id}/likedby/${user.id}`;

    this.http.get<LikedByUserResponse>(url, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: (likedByUserResponse) => {
          const isLiked = likedByUserResponse.status === 200 && likedByUserResponse.likedByUser;

          this.messagesSignal.update(messages => {
            return messages.map(m => m.id === message.id
              ? { ...m, likedByUser: isLiked }
              : m
            );
          });
        },
        error: () => { }
      });
  }

  dislikeMessage(message: Message, user: User, showAlways: boolean = false) {
    const url = `${environment.apiUrl}/message/dislike/${message.id}/by/${user.id}`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Disliking message`,
      button: '',
      delay: 0,
      showSpinner: true
    });

    this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            this.messagesSignal.update(messages => {
              return messages.map(m => m.id === message.id
                ? { ...m, dislikes: m.dislikes + 1, dislikedByUser: true }
                : m
              );
            });
          }
        },
        error: () => { }
      });
  }

  undislikeMessage(message: Message, user: User, showAlways: boolean = false) {
    const url = `${environment.apiUrl}/message/undislike/${message.id}/by/${user.id}`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Undisliking message`,
      button: '',
      delay: 0,
      showSpinner: true
    });

    this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            this.messagesSignal.update(messages => {
              return messages.map(m => m.id === message.id
                ? { ...m, dislikes: m.dislikes - 1, dislikedByUser: false }
                : m
              );
            });
          }
        },
        error: () => { }
      });
  }

  messageDislikedByUser(message: Message, user: User) {
    const url = `${environment.apiUrl}/message/id/${message.id}/dislikedby/${user.id}`;

    this.http.get<DislikedByUserResponse>(url, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: (dislikedByUserResponse) => {
          const isDisliked = dislikedByUserResponse.status === 200 && dislikedByUserResponse.dislikedByUser;

          this.messagesSignal.update(messages => {
            return messages.map(m => m.id === message.id
              ? { ...m, dislikedByUser: isDisliked }
              : m
            );
          });
        },
        error: () => { }
      });
  }

  getByPlusCode(location: Location, messageSubject: Subject<void>, showAlways: boolean = false) {
    const plusCode = this.geolocationService.getPlusCodeBasedOnMapZoom(location, this.mapService.getMapZoom());
    const url = `${environment.apiUrl}/message/get/pluscode/${plusCode}`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Loading message`,
      button: '',
      delay: 0,
      showSpinner: true
    });

    this.http.get<GetMessageResponse>(url, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: (getMessageResponse) => {
          // lastSearchedLocation aktualisieren
          this.lastSearchedLocation = plusCode;

          // Messages neu setzen
          const mappedMessages = getMessageResponse.rows.map(raw => this.mapRawMessage(raw));
          this.messagesSignal.set(mappedMessages);

          messageSubject.next();
        },
        error: () => {
          // Fehlerfall: Location trotzdem aktualisieren, Messages leeren
          this.lastSearchedLocation = plusCode;
          this.messagesSignal.set([]);
          messageSubject.next();
        }
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
    const url = `${environment.apiUrl}/message/countview/${message.id}`;

    this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            this.messagesSignal.update(messages => {
              return messages.map(m => m.id === message.id
                ? { ...m, views: m.views + 1 }
                : m
              );
            });
          }
        },
        error: () => { }
      });
  }

  countComment(message: Message) {
    const url = `${environment.apiUrl}/message/countcomment/${message.id}`;

    this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            this.messagesSignal.update(messages => {
              return messages.map(m => m.id === message.id
                ? { ...m, commentsNumber: m.commentsNumber + 1 }
                : m
              );
            });
          }
        },
        error: () => { }
      });
  }

  disableMessage(message: Message, showAlways: boolean = false) {
    const url = `${environment.apiUrl}/message/disable/${message.id}`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Disabling message`,
      button: '',
      delay: 0,
      showSpinner: true
    });

    this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            // Messages-Array updaten
            this.messagesSignal.update(messages => messages.filter(m => m.id !== message.id));

            // Selected-Messages stack reduzieren
            this.selectedMessagesSignal.update(selected => {
              const newSelected = [...selected];
              newSelected.pop();
              return newSelected;
            });
          }
        },
        error: () => { }
      });
  }

  deleteMessage(message: Message, showAlways: boolean = false) {
    const url = `${environment.apiUrl}/message/delete/${message.id}`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Deleting message`,
      button: '',
      delay: 0,
      showSpinner: true
    });

    this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status !== 200) return;

          const isRootMessage = this.messagesSignal().some(m => m.id === message.id);

          if (isRootMessage) {
            // Root-Nachricht löschen
            this.messagesSignal.update(messages => messages.filter(m => m.id !== message.id));

            // Detailansicht zurücksetzen
            this.selectedMessagesSignal.set([]);
          } else {
            // Kommentar löschen → Comments-Signal anpassen
            const commentsSignal = this.getCommentsSignalForMessage(message.parentUuid!);
            commentsSignal.set(commentsSignal().filter(c => c.id !== message.id));

            this.commentCountsSignal.update(counts => ({
              ...counts,
              [message.parentUuid]: Math.max((counts[message.parentUuid] || 0) - 1, 0)
            }));

            this.commentCounts[message.parentUuid] = this.commentCounts[message.parentUuid] - 1 < 0 ? 0 : this.commentCounts[message.parentUuid] - 1;
          }
        },
        error: () => { }
      });
  }

  public getCommentsForParentMessage(message: Message, showAlways: boolean = false) {
    const url = `${environment.apiUrl}/message/get/comment/${message.uuid}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: 'Message service',
      image: '',
      icon: '',
      message: `Loading comments`,
      button: '',
      delay: 0,
      showSpinner: true
    });

    const commentsSignal = this.getCommentsSignalForMessage(message.uuid);

    this.http.get<GetMessageResponse>(url, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: (getMessageResponse) => {
          const comments = getMessageResponse.rows.map((rawMessage: RawMessage) => ({
            id: rawMessage.id,
            uuid: rawMessage.uuid,
            parentId: rawMessage.parentId,
            parentUuid: rawMessage.parentUuid,
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
          }));
          commentsSignal.set(comments);
          // commentCountsSignal aktualisieren
          comments.forEach(comment => {
            this.commentCounts[comment.uuid] = comment.commentsNumber;
          });
          this.commentCountsSignal.set(this.commentCounts);
        },
        error: () => {
          commentsSignal.set([]);
        }
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
