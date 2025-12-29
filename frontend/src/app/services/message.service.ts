import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, forkJoin, Observable, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { BoundingBox } from '../interfaces/bounding-box';
import { GetMessageResponse } from '../interfaces/get-message-response';
import { Message } from '../interfaces/message';
import { MessageCreateResponse } from '../interfaces/message-create-response';
import { RawMessage } from '../interfaces/raw-message';
import { SimpleStatusResponse } from '../interfaces/simple-status-response';
import { ToggleResponse } from '../interfaces/toggle-response';
import { User } from '../interfaces/user';
import { GeolocationService } from './geolocation.service';
import { MapService } from './map.service';
import { NetworkService } from './network.service';
import { TranslationHelperService } from './translation-helper.service';

@Injectable({
  providedIn: 'root'
})
export class MessageService {

  readonly messagesSignal = signal<Message[]>([]);
  readonly selectedMessagesSignal = signal<Message[]>([]);
  readonly commentsSignal = signal<Message[]>([]);
  readonly commentsSignals = new Map<string, WritableSignal<Message[]>>();
  readonly commentCountsSignal = signal<Record<string, number>>({});

  private _messageSet = signal(0);
  readonly messageSet = this._messageSet.asReadonly();

  private commentCounts: Record<string, number> = {};

  private lastSearchedLocation = '';

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      withCredentials: 'true'
    })
  };

  private readonly snackBar = inject(MatSnackBar);
  private readonly http = inject(HttpClient);
  private readonly mapService = inject(MapService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly networkService = inject(NetworkService);
  private readonly i18n = inject(TranslationHelperService);

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

  getCommentsSignalForMessage(parentUuid: string): WritableSignal<Message[]> {
    if (!this.commentsSignals.has(parentUuid)) {
      this.commentsSignals.set(parentUuid, signal<Message[]>([]));
    }
    return this.commentsSignals.get(parentUuid)!;
  }

  public mapRawMessages(rawMessages: RawMessage[]): Message[] {
    const messages: Message[] = [];
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
      dsaStatusToken: raw.dsaStatusToken,
      userId: raw.userId,
      multimedia: JSON.parse(raw.multimedia)
    };
  }

  createMessage(message: Message, user: User, showAlways = false) {
    const url = `${environment.apiUrl}/message/create`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: this.i18n.t('common.message.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.message.creating'),
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
    this.http.post<MessageCreateResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      )
      .subscribe({
        next: (res) => {
          const decision = res?.moderation?.decision ?? 'approved';
          if (decision === 'rejected') {
            this.snackBar.open(this.i18n.t('common.message.moderationRejected'), this.i18n.t('common.actions.ok'), {
              horizontalPosition: 'center',
              verticalPosition: 'top'
            });
            return;
          }
          this.messagesSignal.update(messages => [message, ...messages]);
          if (decision === 'review') {
            this.snackBar.open(this.i18n.t('common.message.moderationReview'), '', { duration: 2000 });
          } else {
            this.snackBar.open(this.i18n.t('common.message.created'), '', { duration: 1000 });
          }
        },
        error: (err) => { this.snackBar.open(err.message, this.i18n.t('common.actions.ok')); }
      });
  }

  public createComment(message: Message, user: User, showAlways = false) {
    const url = `${environment.apiUrl}/message/create`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: this.i18n.t('common.message.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.message.creating'),
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

    this.http.post<MessageCreateResponse>(url, body, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: (res) => {
          const decision = res?.moderation?.decision ?? 'approved';
          if (decision === 'rejected') {
            this.snackBar.open(this.i18n.t('common.message.moderationRejected'), this.i18n.t('common.actions.ok'), {
              horizontalPosition: 'center',
              verticalPosition: 'top'
            });
            return;
          }

          const commentsSignal = this.getCommentsSignalForMessage(message.parentUuid!);
          commentsSignal.set([...commentsSignal(), message]);
          this.commentCounts[message.parentUuid] = this.commentCounts[message.parentUuid] + 1;

          if (decision === 'review') {
            this.snackBar.open(this.i18n.t('common.message.moderationReview'), '', { duration: 2000 });
          } else {
            this.snackBar.open(this.i18n.t('common.comment.created'), '', { duration: 1000 });
          }
        },
        error: (err) => {
          this.snackBar.open(err.message, this.i18n.t('common.actions.ok'))
        }
      });
  }

  updateMessage(message: Message, showAlways = false) {
    const url = `${environment.apiUrl}/message/update`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: this.i18n.t('common.message.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.message.updating'),
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
        error: err => this.snackBar.open(err.message, this.i18n.t('common.actions.ok'))
      });
  }

  private patchMessageSnapshotSmart(target: Message, patch: Partial<Message>) {
    const isComment = !!target.parentUuid; // Kommentare haben parentUuid != null

    if (isComment) {
      // 1) das beschreibbare Comments-Signal für den Parent holen
      const commentsSig = this.getCommentsSignalForMessage(target.parentUuid);
      // 2) dort updaten
      commentsSig.update(list =>
        list.map(comment => (comment.uuid === target.uuid ? { ...comment, ...patch } : comment))
      );
    } else {
      // Top-Level-Message patchen
      this.messagesSignal.update(list =>
        list.map(message => (message.uuid === target.uuid ? { ...message, ...patch } : message))
      );
    }
  }

  likeToggle(message: Message, user: User, showAlways = false) {
    const url = `${environment.apiUrl}/message/like/${message.uuid}/by/${user.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: this.i18n.t('common.message.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.message.togglingLike'),
      button: '',
      delay: 0,
      showSpinner: true
    });

    this.http.get<ToggleResponse>(url, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe(res => {
        if (res.status === 200) {
          this.patchMessageSnapshotSmart(message, {
            likes: res.likes,
            dislikes: res.dislikes
          });
        }
      });
  }

  dislikeToggle(message: Message, user: User, showAlways = false) {
    const url = `${environment.apiUrl}/message/dislike/${message.uuid}/by/${user.id}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: this.i18n.t('common.message.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.message.togglingDislike'),
      button: '',
      delay: 0,
      showSpinner: true
    });

    this.http.get<ToggleResponse>(url, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe(res => {
        if (res.status === 200) {
          this.patchMessageSnapshotSmart(message, {
            likes: res.likes,
            dislikes: res.dislikes
          });
        }
      });
  }

  getByVisibleMapBoundingBox(showAlways = false) {
    const boundingBoxes = this.mapService.getVisibleMapBoundingBoxes();
    if (boundingBoxes.length === 0) {
      return;
    }

    const requests = boundingBoxes.map((boundingBox, index) =>
      this.getByBoundingBox(boundingBox, showAlways && index === 0).pipe(
        catchError(() => of(null))
      )
    );

    forkJoin(requests).subscribe({
      next: (responses) => {
        const successfulResponses = responses.filter((response): response is GetMessageResponse => response !== null);

        this.lastSearchedLocation = this.geolocationService.getPlusCodeBasedOnMapZoom(
          this.mapService.getMapLocation(),
          this.mapService.getMapZoom()
        );

        if (successfulResponses.length === 0) {
          this.messagesSignal.set([]);
          this._messageSet.update(trigger => trigger + 1);
          return;
        }

        const uniqueMessages = new Map<number, RawMessage>();
        successfulResponses.forEach(response => {
          response.rows.forEach(raw => {
            uniqueMessages.set(raw.id, raw);
          });
        });

        const mappedMessages = Array.from(uniqueMessages.values()).map(raw => this.mapRawMessage(raw));
        this.messagesSignal.set(mappedMessages);
        this._messageSet.update(trigger => trigger + 1);
      },
      error: () => {
        this.lastSearchedLocation = this.geolocationService.getPlusCodeBasedOnMapZoom(
          this.mapService.getMapLocation(),
          this.mapService.getMapZoom()
        );
        this.messagesSignal.set([]);
        this._messageSet.update(trigger => trigger + 1);
      }
    });
  }

  getByBoundingBox(boundingBox: BoundingBox, showAlways = false): Observable<GetMessageResponse> {
    const url = `${environment.apiUrl}/message/get/boundingbox/${boundingBox.latMin}/${boundingBox.lonMin}/${boundingBox.latMax}/${boundingBox.lonMax}`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: this.i18n.t('common.message.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.message.loading'),
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
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(message.location.plusCode)}`;
    window.open(url, '_blank');
  }

  deleteMessage(message: Message, showAlways = false) {
    const url = `${environment.apiUrl}/message/delete/${message.id}`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: this.i18n.t('common.message.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.message.deleting'),
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
            this.messagesSignal.update(messages => messages.filter(m => m.id !== message.id));
            this.selectedMessagesSignal.set([]);
          } else {
            const commentsSignal = this.getCommentsSignalForMessage(message.parentUuid!);
            commentsSignal.set(commentsSignal().filter(c => c.id !== message.id));

            this.commentCountsSignal.update(counts => ({
              ...counts,
              [message.parentUuid]: Math.max((counts[message.parentUuid] || 0) - 1, 0)
            }));

            this.commentCounts[message.parentUuid] = Math.max((this.commentCounts[message.parentUuid] || 0) - 1, 0);
          }
        },
        error: (err) => {
          const message = err.message ?? this.i18n.t('common.message.deleteFailed');
          this.snackBar.open(message, this.i18n.t('common.actions.ok'));
        }
      });
  }

  public getCommentsForParentMessage(message: Message, showAlways = false) {
    const url = `${environment.apiUrl}/message/get/comment/${message.uuid}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: this.i18n.t('common.message.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.message.loadingComments'),
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
