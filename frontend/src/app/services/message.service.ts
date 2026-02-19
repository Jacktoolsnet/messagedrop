import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, forkJoin, map, Observable, of, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { DisplayMessage } from '../components/utils/display-message/display-message.component';
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
import {
  MAX_PUBLIC_HASHTAGS,
  normalizeHashtags,
  parseHashtagStorageValue
} from '../utils/hashtag.util';

@Injectable({
  providedIn: 'root'
})
export class MessageService {

  readonly messagesSignal = signal<Message[]>([]);
  readonly selectedMessagesSignal = signal<Message[]>([]);
  readonly commentsSignal = signal<Message[]>([]);
  readonly commentsSignals = new Map<string, WritableSignal<Message[]>>();
  readonly commentCountsSignal = signal<Record<string, number>>({});

  private moderationDialogRef: MatDialogRef<DisplayMessage> | null = null;
  private publishDialogRef: MatDialogRef<DisplayMessage> | null = null;
  private reviewDialogRef: MatDialogRef<DisplayMessage> | null = null;

  private _messageSet = signal(0);
  readonly messageSet = this._messageSet.asReadonly();

  private commentCounts: Record<string, number> = {};
  private publicMessageFetchToken = 0;

  private lastSearchedLocation = '';

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      withCredentials: 'true'
    })
  };

  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly http = inject(HttpClient);
  private readonly mapService = inject(MapService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly networkService = inject(NetworkService);
  private readonly i18n = inject(TranslationHelperService);

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  private toNullableBool(value: unknown): boolean | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (!normalized) return null;
      if (normalized === '1' || normalized === 'true') return true;
      if (normalized === '0' || normalized === 'false') return false;
    }
    return null;
  }

  private toNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && !value.trim()) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private toEpochMs(value: unknown): number | null {
    const num = this.toNullableNumber(value);
    if (num === null) return null;
    return num < 1_000_000_000_000 ? num * 1000 : num;
  }

  private buildModerationPatch(moderation?: MessageCreateResponse['moderation'] | null): Partial<Message> {
    if (!moderation) return {};
    return {
      aiModerationDecision: moderation.decision ?? null,
      aiModerationScore: this.toNullableNumber(moderation.score),
      aiModerationFlagged: this.toNullableBool(moderation.flagged),
      patternMatch: this.toNullableBool(moderation.patternMatch),
      aiModerationAt: Date.now(),
      manualModerationDecision: null,
      manualModerationReason: null,
      manualModerationAt: null,
      manualModerationBy: null
    };
  }

  private showModerationRejected(message: string): void {
    this.moderationDialogRef?.close();
    const ref = this.dialog.open(DisplayMessage, {
      panelClass: '',
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.i18n.t('common.moderation.title'),
        image: '',
        icon: 'block',
        message,
        button: this.i18n.t('common.actions.ok'),
        delay: 0,
        showSpinner: false
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
    this.moderationDialogRef = ref;
    ref.afterClosed().subscribe(() => {
      if (this.moderationDialogRef === ref) {
        this.moderationDialogRef = null;
      }
    });
  }

  private getModerationRejectedMessage(reason?: string | null): string {
    if (reason === 'pattern') {
      return this.i18n.t('common.message.moderationRejectedPattern');
    }
    if (reason === 'ai') {
      return this.i18n.t('common.message.moderationRejectedAi');
    }
    return this.i18n.t('common.message.moderationRejected');
  }

  private showPublishedMessage(message: string): void {
    this.publishDialogRef?.close();
    const ref = this.dialog.open(DisplayMessage, {
      panelClass: '',
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.i18n.t('common.message.title'),
        image: '',
        icon: 'check_circle',
        message,
        button: '',
        delay: 2000,
        showSpinner: false,
        autoclose: true
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
    this.publishDialogRef = ref;
    ref.afterClosed().subscribe(() => {
      if (this.publishDialogRef === ref) {
        this.publishDialogRef = null;
      }
    });
  }

  private showModerationReviewMessage(message: string): void {
    this.reviewDialogRef?.close();
    const ref = this.dialog.open(DisplayMessage, {
      panelClass: '',
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.i18n.t('common.moderation.title'),
        image: '',
        icon: 'info',
        message,
        button: '',
        delay: 2000,
        showSpinner: false,
        autoclose: true
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
    this.reviewDialogRef = ref;
    ref.afterClosed().subscribe(() => {
      if (this.reviewDialogRef === ref) {
        this.reviewDialogRef = null;
      }
    });
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
    this.publicMessageFetchToken += 1;
    this.messagesSignal.set([]);
    this._messageSet.update(trigger => trigger + 1);
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
      createDateTime: this.toEpochMs(raw.createDateTime),
      deleteDateTime: this.toEpochMs(raw.deleteDateTime),
      location: {
        latitude: raw.latitude,
        longitude: raw.longitude,
        plusCode: raw.plusCode,
      },
      message: raw.message,
      markerType: raw.markerType,
      style: raw.style,
      hashtags: parseHashtagStorageValue(raw.hashtags),
      views: raw.views,
      likes: raw.likes,
      dislikes: raw.dislikes,
      comments: [],
      commentsNumber: raw.commentsNumber,
      status: raw.status,
      aiModerationDecision: raw.aiModerationDecision ?? null,
      aiModerationScore: this.toNullableNumber(raw.aiModerationScore),
      aiModerationFlagged: this.toNullableBool(raw.aiModerationFlagged),
      aiModerationAt: this.toNullableNumber(raw.aiModerationAt),
      patternMatch: this.toNullableBool(raw.patternMatch),
      patternMatchAt: this.toNullableNumber(raw.patternMatchAt),
      manualModerationDecision: raw.manualModerationDecision ?? null,
      manualModerationReason: raw.manualModerationReason ?? null,
      manualModerationAt: this.toNullableNumber(raw.manualModerationAt),
      manualModerationBy: raw.manualModerationBy ?? null,
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
      showSpinner: true,
      autoclose: false
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
      hashtags: normalizeHashtags(message.hashtags ?? [], MAX_PUBLIC_HASHTAGS).tags,
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
          const moderationPatch = this.buildModerationPatch(res?.moderation);
          if (decision === 'rejected') {
            this.showModerationRejected(this.getModerationRejectedMessage(res?.moderation?.reason ?? null));
            return;
          }
          const createdId = res?.messageId ?? null;
          const createdUuid = res?.messageUuid ?? null;
          const nextMessage: Message = {
            ...message,
            ...moderationPatch,
            id: createdId ?? message.id,
            uuid: createdUuid ?? message.uuid
          };
          this.messagesSignal.update(messages => [nextMessage, ...messages]);
          if (decision === 'review') {
            this.showModerationReviewMessage(this.i18n.t('common.message.moderationReview'));
          } else {
            this.showPublishedMessage(this.i18n.t('common.message.created'));
          }
        },
        error: (err) => { this.snackBar.open(err.message, this.i18n.t('common.actions.ok')); }
      });
  }

  public createComment(message: Message, user: User, showAlways = false, includeInRootList = false) {
    const url = `${environment.apiUrl}/message/create`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: this.i18n.t('common.message.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.message.creating'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
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
      hashtags: normalizeHashtags(message.hashtags ?? [], MAX_PUBLIC_HASHTAGS).tags,
      messageUserId: user.id,
      multimedia: JSON.stringify(message.multimedia)
    };

    this.http.post<MessageCreateResponse>(url, body, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: (res) => {
          const decision = res?.moderation?.decision ?? 'approved';
          const moderationPatch = this.buildModerationPatch(res?.moderation);
          if (decision === 'rejected') {
            this.showModerationRejected(this.getModerationRejectedMessage(res?.moderation?.reason ?? null));
            return;
          }

          const parentUuid = message.parentUuid!;
          const commentsSignal = this.getCommentsSignalForMessage(parentUuid);
          const createdId = res?.messageId ?? null;
          const createdUuid = res?.messageUuid ?? null;
          const nextMessage: Message = {
            ...message,
            ...moderationPatch,
            id: createdId ?? message.id,
            uuid: createdUuid ?? message.uuid
          };
          const nextComments = [...commentsSignal(), nextMessage];
          commentsSignal.set(nextComments);
          const nextCount = (this.commentCounts[parentUuid] ?? 0) + 1;
          this.commentCounts[parentUuid] = nextCount;
          this.commentCountsSignal.update(counts => ({
            ...counts,
            [parentUuid]: nextCount
          }));
          if (includeInRootList) {
            this.messagesSignal.update(messages =>
              messages.some(item => item.uuid === nextMessage.uuid)
                ? messages
                : [nextMessage, ...messages]
            );
          }

          if (decision === 'review') {
            this.showModerationReviewMessage(this.i18n.t('common.message.moderationReview'));
          } else {
            this.showPublishedMessage(this.i18n.t('common.comment.created'));
          }
        },
        error: (err) => {
          this.snackBar.open(err.message, this.i18n.t('common.actions.ok'))
        }
      });
  }

  updateMessage(message: Message, showAlways = false) {
    const url = `${environment.apiUrl}/message/update`;
    const wasDisabled = message.status === 'disabled';

    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: this.i18n.t('common.message.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.message.updating'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });

    const messageIdentifier = Number.isFinite(message.id) && message.id > 0
      ? message.id
      : message.uuid;
    const body = {
      'id': messageIdentifier,
      'message': message.message,
      'style': message.style,
      'hashtags': normalizeHashtags(message.hashtags ?? [], MAX_PUBLIC_HASHTAGS).tags,
      'multimedia': JSON.stringify(message.multimedia),
      'latitude': message.location?.latitude,
      'longitude': message.location?.longitude,
      'plusCode': message.location?.plusCode
    };

    this.http.post<MessageCreateResponse>(url, body, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: (res) => {
          const decision = res?.moderation?.decision ?? 'approved';
          const moderationPatch = this.buildModerationPatch(res?.moderation);
          if (decision === 'rejected') {
            this.showModerationRejected(this.getModerationRejectedMessage(res?.moderation?.reason ?? null));
            this.patchMessageSnapshotSmart(message, { status: 'disabled', ...moderationPatch });
            return;
          }

          this.patchMessageSnapshotSmart(message, { ...message, status: 'enabled', ...moderationPatch });
          if (decision === 'review') {
            this.showModerationReviewMessage(this.i18n.t('common.message.moderationReview'));
          } else if (wasDisabled) {
            this.showPublishedMessage(this.i18n.t('common.message.republished'));
          }
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
      showSpinner: true,
      autoclose: false
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
      showSpinner: true,
      autoclose: false
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
    const fetchToken = ++this.publicMessageFetchToken;
    const boundingBoxes = this.mapService.getVisibleMapBoundingBoxes();
    if (boundingBoxes.length === 0) {
      if (fetchToken !== this.publicMessageFetchToken) {
        return;
      }
      this.messagesSignal.set([]);
      this._messageSet.update(trigger => trigger + 1);
      return;
    }

    const requests = boundingBoxes.map((boundingBox, index) =>
      this.getByBoundingBox(boundingBox, showAlways && index === 0).pipe(
        catchError(() => of(null))
      )
    );

    forkJoin(requests).subscribe({
      next: (responses) => {
        if (fetchToken !== this.publicMessageFetchToken) {
          return;
        }
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
          (response.rows ?? []).forEach(raw => {
            uniqueMessages.set(raw.id, raw);
          });
        });

        const mappedMessages = Array.from(uniqueMessages.values()).map(raw => this.mapRawMessage(raw));
        this.messagesSignal.set(mappedMessages);
        this._messageSet.update(trigger => trigger + 1);
      },
      error: () => {
        if (fetchToken !== this.publicMessageFetchToken) {
          return;
        }
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
      showSpinner: true,
      autoclose: false
    });

    return this.http.get<GetMessageResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  getByUuid(messageUuid: string, showAlways = false): Observable<Message | null> {
    const trimmedUuid = typeof messageUuid === 'string' ? messageUuid.trim() : '';
    if (!trimmedUuid) {
      return of(null);
    }

    const url = `${environment.apiUrl}/message/get/uuid/${encodeURIComponent(trimmedUuid)}`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: this.i18n.t('common.message.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.message.loading'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });

    return this.http.get<{ status: number; message?: RawMessage }>(url, this.httpOptions).pipe(
      map((response) => {
        if (!response?.message) {
          return null;
        }
        return this.mapRawMessage(response.message);
      }),
      catchError(() => of(null))
    );
  }

  searchByHashtag(tag: string, showAlways = false): Observable<GetMessageResponse> {
    const normalized = normalizeHashtags([tag], 1).tags[0];
    const encoded = encodeURIComponent(normalized ?? '');
    const url = `${environment.apiUrl}/message/get/hashtag/${encoded}`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: this.i18n.t('common.hashtagSearch.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.hashtagSearch.searching'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });

    return this.http.get<GetMessageResponse>(url, this.httpOptions).pipe(
      catchError(this.handleError)
    );
  }

  moderatePublicHashtags(tags: string[]): Observable<MessageCreateResponse> {
    const normalized = normalizeHashtags(tags ?? [], MAX_PUBLIC_HASHTAGS).tags;
    const url = `${environment.apiUrl}/message/moderate/hashtags`;
    const body = { hashtags: normalized };
    return this.http.post<MessageCreateResponse>(url, body, this.httpOptions).pipe(
      catchError(this.handleError)
    );
  }

  navigateToMessageLocation(message: Message) {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(message.location.plusCode)}`;
    window.open(url, '_blank');
  }

  deleteMessage(message: Message, showAlways = false) {
    const idOrUuid = message.id ?? message.uuid;
    if (!idOrUuid) {
      this.snackBar.open(this.i18n.t('common.message.deleteFailed'), this.i18n.t('common.actions.ok'));
      return;
    }
    const url = `${environment.apiUrl}/message/delete/${idOrUuid}`;

    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: this.i18n.t('common.message.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.message.deleting'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });

    this.http.get<SimpleStatusResponse>(url, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status !== 200) return;

          const isRootMessage = this.messagesSignal().some(m => m.id === message.id);

          if (isRootMessage) {
            const parentUuid = message.uuid;
            const existing = this.messagesSignal();
            const toRemove = new Set<string>([parentUuid]);
            const queue: string[] = [parentUuid];

            while (queue.length > 0) {
              const current = queue.shift();
              if (!current) {
                continue;
              }
              const directFromMessages = existing
                .filter(item => item.parentUuid === current)
                .map(item => item.uuid);
              const directFromSignals = this.commentsSignals.get(current)?.().map(item => item.uuid) ?? [];
              [...directFromMessages, ...directFromSignals].forEach(uuid => {
                if (!toRemove.has(uuid)) {
                  toRemove.add(uuid);
                  queue.push(uuid);
                }
              });
            }

            this.messagesSignal.update(messages =>
              messages.filter(m => !toRemove.has(m.uuid) && !toRemove.has(m.parentUuid))
            );
            this.selectedMessagesSignal.set([]);

            this.commentCountsSignal.update(counts => {
              const next = { ...counts };
              toRemove.forEach(uuid => {
                delete next[uuid];
              });
              return next;
            });

            toRemove.forEach(uuid => {
              const sig = this.commentsSignals.get(uuid);
              if (sig) {
                sig.set([]);
                this.commentsSignals.delete(uuid);
              }
              delete this.commentCounts[uuid];
            });
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
      showSpinner: true,
      autoclose: false
    });

    const commentsSignal = this.getCommentsSignalForMessage(message.uuid);

    this.http.get<GetMessageResponse>(url, this.httpOptions)
      .pipe(catchError(this.handleError))
      .subscribe({
        next: (getMessageResponse) => {
          const comments = (getMessageResponse.rows ?? []).map((rawMessage: RawMessage) => ({
            id: rawMessage.id,
            uuid: rawMessage.uuid,
            parentId: rawMessage.parentId,
            parentUuid: rawMessage.parentUuid,
            typ: rawMessage.typ,
            createDateTime: this.toEpochMs(rawMessage.createDateTime),
            deleteDateTime: this.toEpochMs(rawMessage.deleteDateTime),
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
    const commonTlds = new Set([
      'com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'name', 'pro', 'dev', 'app', 'io',
      'de', 'at', 'ch', 'fr', 'es', 'it', 'pt', 'nl', 'be', 'lu', 'uk', 'ie',
      'us', 'ca', 'au', 'nz', 'jp', 'kr', 'cn', 'in', 'br', 'mx', 'ar', 'cl', 'co',
      'se', 'no', 'dk', 'fi', 'pl', 'cz', 'sk', 'hu', 'ro', 'bg', 'hr', 'si', 'gr', 'tr', 'ru', 'ua'
    ]);
    const normalizedTokenText = String(text ?? '')
      .toLowerCase()
      .replace(/[#]+/g, ' ')
      .replace(/[()[\]{};,]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const normalizedObfuscatedText = String(text ?? '')
      .toLowerCase()
      .replace(/[([{]\s*at\s*[)\]}]/g, ' @ ')
      .replace(/\bat\b/g, ' @ ')
      .replace(/[([{]\s*(dot|punkt)\s*[)\]}]/g, ' . ')
      .replace(/\b(dot|punkt)\b/g, ' . ')
      .replace(/[#]+/g, ' ')
      .replace(/[()[\]{};,]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const patterns: RegExp[] = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
      /\b[a-z0-9._%+-]+\s*@\s*[a-z0-9-]+(?:\s*\.\s*[a-z0-9-]+)+\b/i,
      /\b(?:\d[ -]*?){13,19}\b/,
      /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}\b/,
      /\b(?:\d{1,3}\.){3}\d{1,3}\b/,
      /\b(?:[a-fA-F0-9:]+:+)+[a-fA-F0-9]+\b/,
      /\b\d{3}-\d{2}-\d{4}\b/,
      /\b(?:https?:\/\/|www\.)[^\s]+/i,
      /\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?/i
    ];

    if (patterns.some((pattern) => pattern.test(text) || pattern.test(normalizedObfuscatedText))) {
      return true;
    }

    const tokens = normalizedTokenText.split(' ').filter(Boolean);
    const isLocalPart = (value: string) => /^[a-z0-9._%+-]{2,64}$/i.test(value);
    const isDomainLabel = (value: string) => /^[a-z0-9-]{2,63}$/i.test(value);
    const isTld = (value: string) => /^[a-z]{2,24}$/i.test(value) && commonTlds.has(value.toLowerCase());

    for (let index = 1; index < tokens.length - 2; index += 1) {
      const marker = tokens[index];
      if (marker !== '@' && marker !== 'at') {
        continue;
      }
      const localPart = tokens[index - 1];
      const domain = tokens[index + 1];
      if (!isLocalPart(localPart) || !isDomainLabel(domain)) {
        continue;
      }
      let tldIndex = index + 2;
      if (tokens[tldIndex] === '.' || tokens[tldIndex] === 'dot' || tokens[tldIndex] === 'punkt') {
        tldIndex += 1;
      }
      const tld = tokens[tldIndex];
      if (!tld) {
        continue;
      }
      if (isTld(tld)) {
        return true;
      }
    }

    const phoneCandidates = String(text ?? '').match(/\+?[0-9][0-9()\s.-]{6,}[0-9]/g);
    if (!phoneCandidates) {
      return false;
    }

    const dateLike = /^(\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})$/;
    return phoneCandidates.some((candidate) => {
      const trimmed = candidate.trim();
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length < 10) {
        return false;
      }
      if (dateLike.test(trimmed)) {
        return false;
      }
      const hasPlus = trimmed.startsWith('+');
      const hasSeparator = /[()\s-]/.test(trimmed);
      const hasOnlyDigitsAndDots = /^[0-9.]+$/.test(trimmed);
      if (hasOnlyDigitsAndDots) {
        const dotCount = (trimmed.match(/\./g) || []).length;
        return dotCount >= 2;
      }
      if (!hasPlus && !hasSeparator) {
        return false;
      }
      return true;
    });
  }

}
