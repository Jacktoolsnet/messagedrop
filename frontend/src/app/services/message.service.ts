import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal, WritableSignal } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { catchError, firstValueFrom, forkJoin, from, map, Observable, of, switchMap, throwError } from 'rxjs';
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
import { IndexedDbService } from './indexed-db.service';
import { MapService } from './map.service';
import { NetworkService } from './network.service';
import { TranslationHelperService } from './translation-helper.service';
import { DisplayMessageService } from './display-message.service';
import {
  MAX_PUBLIC_HASHTAGS,
  normalizeHashtags,
  parseHashtagStorageValue
} from '../utils/hashtag.util';

type PublishMessageOptions = {
  showAlways?: boolean;
  includeInRootList?: boolean;
  persistDraft?: boolean;
};

type PublishMessageResult = {
  status: number;
  via: 'create' | 'enable';
  moderation: MessageCreateResponse['moderation'] | null;
  messageId: number | null;
  messageUuid: string | null;
  published: boolean;
};

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

  private readonly snackBar = inject(DisplayMessageService);
  private readonly dialog = inject(MatDialog);
  private readonly http = inject(HttpClient);
  private readonly mapService = inject(MapService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly networkService = inject(NetworkService);
  private readonly i18n = inject(TranslationHelperService);
  private readonly indexedDbService = inject(IndexedDbService);

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

  private normalizePublishState(message: Partial<Message>): NonNullable<Message['publishState']> {
    if (message.manualModerationDecision === 'rejected') {
      return 'dsa_locked';
    }
    if (message.status === 'disabled' && message.dsaStatusToken) {
      return 'dsa_locked';
    }
    if (message.status === 'enabled') {
      return 'published';
    }
    return 'unpublished';
  }

  isDsaLocked(message: Partial<Message>): boolean {
    return this.normalizePublishState(message) === 'dsa_locked';
  }

  isParentMissingError(error: unknown): boolean {
    const matchesPayload = (value: unknown): boolean => {
      if (!value || typeof value !== 'object') {
        return false;
      }
      const candidate = value as { message?: unknown; error?: unknown };
      return candidate.message === 'parent_not_found'
        || candidate.error === 'parent_not_found'
        || candidate.message === 'parent_not_available'
        || candidate.error === 'parent_not_available';
    };

    if (matchesPayload(error)) {
      return true;
    }

    if (error instanceof HttpErrorResponse) {
      return matchesPayload(error.error);
    }

    return false;
  }

  private getMessageIdentifier(message: Message): string | number | null {
    if (Number.isFinite(message.id) && message.id > 0) {
      return message.id;
    }
    if (typeof message.uuid === 'string' && message.uuid.trim().length > 0) {
      return message.uuid;
    }
    return null;
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

  public getModerationPatch(moderation?: MessageCreateResponse['moderation'] | null): Partial<Message> {
    return this.buildModerationPatch(moderation);
  }

  private configureCreateMessageRequest(showAlways: boolean): string {
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
    return url;
  }

  private buildCreateMessageBody(message: Message, user: User) {
    return {
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
  }

  private createMessageRequest(message: Message, user: User, showAlways = false): Observable<MessageCreateResponse> {
    const url = this.configureCreateMessageRequest(showAlways);
    const body = this.buildCreateMessageBody(message, user);
    return this.http.post<MessageCreateResponse>(url, body, this.httpOptions).pipe(
      catchError(this.handleError)
    );
  }

  private shouldPublishViaCreate(message: Message, publishState: NonNullable<Message['publishState']>): boolean {
    if (!Number.isFinite(message.id) || message.id <= 0) {
      return true;
    }

    return publishState === 'server_missing'
      || publishState === 'local_only'
      || publishState === 'draft'
      || publishState === 'parent_missing';
  }

  private upsertRootMessageInSignals(nextMessage: Message): void {
    this.messagesSignal.update((messages) => {
      const index = messages.findIndex((item) => item.uuid === nextMessage.uuid);
      if (index >= 0) {
        const next = [...messages];
        next[index] = { ...next[index], ...nextMessage };
        return next;
      }
      return [nextMessage, ...messages];
    });
  }

  private upsertCommentInSignals(nextMessage: Message, includeInRootList = false): void {
    const parentUuid = nextMessage.parentUuid;
    if (!parentUuid) {
      return;
    }

    const commentsSignal = this.getCommentsSignalForMessage(parentUuid);
    let wasInserted = false;
    commentsSignal.update((comments) => {
      const index = comments.findIndex((item) => item.uuid === nextMessage.uuid);
      if (index >= 0) {
        const next = [...comments];
        next[index] = { ...next[index], ...nextMessage };
        return next;
      }
      wasInserted = true;
      return [...comments, nextMessage];
    });

    if (wasInserted) {
      const nextCount = (this.commentCounts[parentUuid] ?? 0) + 1;
      this.commentCounts[parentUuid] = nextCount;
      this.commentCountsSignal.update((counts) => ({
        ...counts,
        [parentUuid]: nextCount
      }));
    }

    if (includeInRootList) {
      this.messagesSignal.update((messages) =>
        messages.some((item) => item.uuid === nextMessage.uuid)
          ? messages.map((item) => item.uuid === nextMessage.uuid ? { ...item, ...nextMessage } : item)
          : [nextMessage, ...messages]
      );
    }
  }

  private async upsertOwnPublicMessage(userId: string, message: Message): Promise<void> {
    const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
    const uuid = typeof message.uuid === 'string' ? message.uuid.trim() : '';
    if (!normalizedUserId || !uuid) {
      return;
    }

    const existing = await this.loadOwnPublicMessages(normalizedUserId);
    const nextMessages = [
      {
        ...message,
        userId: normalizedUserId,
        publishState: message.publishState ?? this.normalizePublishState(message)
      },
      ...existing.filter((entry) => entry.uuid !== uuid)
    ];
    await this.saveOwnPublicMessages(normalizedUserId, nextMessages);
  }

  private syncOwnPublicMessage(user: User, message: Message): void {
    const userId = typeof user?.id === 'string' ? user.id.trim() : '';
    if (!userId) {
      return;
    }
    void this.upsertOwnPublicMessage(userId, {
      ...message,
      userId
    });
  }

  private applyCreatePublishSuccess(
    message: Message,
    user: User,
    response: MessageCreateResponse,
    includeInRootList = false
  ): PublishMessageResult {
    const decision = response?.moderation?.decision ?? 'approved';
    const moderationPatch = this.buildModerationPatch(response?.moderation);
    const createdId = response?.messageId ?? null;
    const createdUuid = response?.messageUuid ?? null;
    const nextMessage: Message = {
      ...message,
      ...moderationPatch,
      id: createdId ?? message.id,
      uuid: createdUuid ?? message.uuid,
      userId: typeof user?.id === 'string' && user.id.trim() ? user.id.trim() : message.userId,
      status: decision === 'rejected' ? 'disabled' : 'enabled',
      publishState: decision === 'rejected'
        ? 'unpublished'
        : this.normalizePublishState({
          status: 'enabled',
          dsaStatusToken: message.dsaStatusToken
        })
    };

    if (decision === 'rejected') {
      this.patchMessageSnapshotSmart(message, nextMessage);
      this.syncOwnPublicMessage(user, nextMessage);
      this.showModerationRejected(this.getModerationRejectedMessage(response?.moderation?.reason ?? null));
      return {
        status: response?.status ?? 200,
        via: 'create',
        moderation: response?.moderation ?? null,
        messageId: createdId,
        messageUuid: createdUuid,
        published: false
      };
    }

    if (nextMessage.parentUuid) {
      this.upsertCommentInSignals(nextMessage, includeInRootList);
    } else {
      this.upsertRootMessageInSignals(nextMessage);
    }

    this.syncOwnPublicMessage(user, nextMessage);

    if (decision === 'review') {
      this.showModerationReviewMessage(this.i18n.t('common.message.moderationReview'));
    } else {
      this.showPublishedMessage(this.i18n.t(nextMessage.parentUuid ? 'common.comment.created' : 'common.message.created'));
    }

    return {
      status: response?.status ?? 200,
      via: 'create',
      moderation: response?.moderation ?? null,
      messageId: createdId,
      messageUuid: createdUuid,
      published: true
    };
  }

  private applyEnablePublishSuccess(message: Message, user: User): PublishMessageResult {
    const nextMessage: Message = {
      ...message,
      userId: typeof user?.id === 'string' && user.id.trim() ? user.id.trim() : message.userId,
      status: 'enabled',
      publishState: 'published'
    };

    this.patchMessageSnapshotSmart(message, nextMessage);
    this.syncOwnPublicMessage(user, nextMessage);

    return {
      status: 200,
      via: 'enable',
      moderation: null,
      messageId: Number.isFinite(nextMessage.id) ? nextMessage.id : null,
      messageUuid: nextMessage.uuid ?? null,
      published: true
    };
  }

  public isRejectedByAutomatedModeration(message: Partial<Message> | null | undefined): boolean {
    if (!message) {
      return false;
    }
    if (String(message.manualModerationDecision ?? '').toLowerCase() === 'approved') {
      return false;
    }
    return String(message.aiModerationDecision ?? '').toLowerCase() === 'rejected'
      || this.toNullableBool(message.patternMatch) === true;
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

  public showDraftSavedMessage(): void {
    this.showPublishedMessage(this.i18n.t('common.message.draftSaved'));
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

  private setCommentCountForMessage(uuid: string, count: number): void {
    const normalizedUuid = typeof uuid === 'string' ? uuid.trim() : '';
    if (!normalizedUuid) {
      return;
    }

    const normalizedCount = Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0;
    this.commentCounts[normalizedUuid] = normalizedCount;
    this.commentCountsSignal.set({
      ...this.commentCountsSignal(),
      [normalizedUuid]: normalizedCount
    });

    const patchMessage = (message: Message): Message => (
      message.uuid === normalizedUuid
        ? { ...message, commentsNumber: normalizedCount }
        : message
    );

    this.messagesSignal.update((messages) => messages.map(patchMessage));
    this.selectedMessagesSignal.update((messages) => messages.map(patchMessage));
    for (const commentsSignal of this.commentsSignals.values()) {
      commentsSignal.set(commentsSignal().map(patchMessage));
    }
  }

  clearMessages() {
    this.publicMessageFetchToken += 1;
    this.setMessages([]);
    this._messageSet.update(trigger => trigger + 1);
  }

  clearSelectedMessages() {
    this.selectedMessagesSignal.set([]);
  }

  private collectOwnPublicMessageSnapshot(userId: string, messages: Message[]): Message[] {
    if (!userId) {
      return [];
    }

    const uniqueMessages = new Map<string, Message>();

    const collect = (message: Message | null | undefined): void => {
      if (!message) {
        return;
      }

      const uuid = typeof message.uuid === 'string' ? message.uuid.trim() : '';
      if (!uuid || uniqueMessages.has(uuid)) {
        return;
      }

      const normalizedUserId = typeof message.userId === 'string' ? message.userId.trim() : '';
      if (normalizedUserId !== userId) {
        return;
      }

      if (message.typ !== 'public' && message.typ !== 'comment') {
        return;
      }

      uniqueMessages.set(uuid, {
        ...message,
        uuid,
        userId: normalizedUserId,
        publishState: message.publishState ?? this.normalizePublishState(message)
      });

      if (Array.isArray(message.comments)) {
        message.comments.forEach((comment) => collect(comment));
      }
    };

    (messages ?? []).forEach((message) => collect(message));
    Array.from(this.commentsSignals.values()).forEach((commentsSignal) => {
      commentsSignal().forEach((message) => collect(message));
    });

    return Array.from(uniqueMessages.values()).sort((a, b) => (b.createDateTime ?? 0) - (a.createDateTime ?? 0));
  }

  private sanitizeOwnPublicMessageSnapshot(userId: string, messages: Message[]): Message[] {
    return this.collectOwnPublicMessageSnapshot(userId, messages);
  }

  async loadOwnPublicMessages(userId: string): Promise<Message[]> {
    if (!userId) {
      return [];
    }
    const messages = await this.indexedDbService.getOwnPublicMessages(userId);
    if (!Array.isArray(messages)) {
      return [];
    }
    const sanitized = this.sanitizeOwnPublicMessageSnapshot(userId, messages);
    if (sanitized.length !== messages.length) {
      await this.indexedDbService.setOwnPublicMessages(userId, sanitized);
    }
    return sanitized;
  }

  async saveOwnPublicMessages(userId: string, messages: Message[]): Promise<void> {
    if (!userId) {
      return;
    }
    const snapshot = this.collectOwnPublicMessageSnapshot(userId, messages ?? []).map((message) => ({
      ...message,
      publishState: message.publishState ?? this.normalizePublishState(message),
      translatedMessage: undefined
    }));
    await this.indexedDbService.setOwnPublicMessages(userId, snapshot);
  }

  async saveDraftMessage(message: Message, user: User): Promise<Message> {
    const userId = typeof user?.id === 'string' ? user.id.trim() : '';
    if (!userId) {
      throw new Error('missing_user_id');
    }

    const draftMessage: Message = {
      ...message,
      id: Number.isFinite(message.id) ? message.id : 0,
      userId,
      status: 'disabled',
      publishState: 'draft',
      createDateTime: message.createDateTime ?? Date.now(),
      deleteDateTime: message.deleteDateTime ?? null,
      commentsNumber: Number.isFinite(message.commentsNumber) ? message.commentsNumber : 0
    };

    const existing = await this.loadOwnPublicMessages(userId);
    const nextMessages = [
      draftMessage,
      ...existing.filter((entry) => entry.uuid !== draftMessage.uuid)
    ];
    await this.saveOwnPublicMessages(userId, nextMessages);
    return draftMessage;
  }

  async markOwnPublicMessagesWithMissingParents(userId: string, messageUuids: string[]): Promise<void> {
    const normalizedUuids = Array.isArray(messageUuids)
      ? messageUuids
        .map((uuid) => typeof uuid === 'string' ? uuid.trim() : '')
        .filter((uuid): uuid is string => uuid.length > 0)
      : [];

    if (!userId || normalizedUuids.length === 0) {
      return;
    }

    const missingParentSet = new Set(normalizedUuids);
    const existing = await this.loadOwnPublicMessages(userId);
    const patched = existing.map((message) =>
      missingParentSet.has(message.uuid)
        ? { ...message, publishState: 'parent_missing' as const }
        : message
    );
    await this.saveOwnPublicMessages(userId, patched);
  }

  async removeOwnPublicMessages(userId: string, messageUuids: string[]): Promise<void> {
    const normalizedUuids = Array.isArray(messageUuids)
      ? messageUuids
        .map((uuid) => typeof uuid === 'string' ? uuid.trim() : '')
        .filter((uuid): uuid is string => uuid.length > 0)
      : [];

    if (!userId || normalizedUuids.length === 0) {
      return;
    }

    const existing = await this.loadOwnPublicMessages(userId);
    if (existing.length === 0) {
      return;
    }

    const toRemove = new Set(normalizedUuids);
    const queue = [...normalizedUuids];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      for (const message of existing) {
        if (message.parentUuid === current && !toRemove.has(message.uuid)) {
          toRemove.add(message.uuid);
          queue.push(message.uuid);
        }
      }
    }

    const filtered = existing.filter((message) => !toRemove.has(message.uuid));
    await this.saveOwnPublicMessages(userId, filtered);
  }

  private async refreshParentAvailability(messages: Message[]): Promise<Message[]> {
    const allMessages = Array.isArray(messages) ? messages : [];
    const childMessages = allMessages.filter((message) =>
      typeof message.parentUuid === 'string'
      && message.parentUuid.trim().length > 0
    );

    if (childMessages.length === 0) {
      return messages;
    }

    const localMessagesByUuid = new Map<string, Message>();
    allMessages.forEach((message) => {
      const uuid = typeof message.uuid === 'string' ? message.uuid.trim() : '';
      if (uuid) {
        localMessagesByUuid.set(uuid, message);
      }
    });

    const parentAvailability = new Map<string, boolean>();
    const externalParentUuids = [...new Set(
      childMessages
        .map((message) => message.parentUuid.trim())
        .filter((parentUuid) => !localMessagesByUuid.has(parentUuid))
    )];

    await Promise.all(externalParentUuids.map(async (parentUuid) => {
      const result = await firstValueFrom(this.verifyMessageExistsByUuid(parentUuid));
      parentAvailability.set(parentUuid, result.published === true);
    }));

    const isParentAvailable = (parentUuid: string): boolean => {
      const localParent = localMessagesByUuid.get(parentUuid);
      if (localParent) {
        const localParentState = localParent.publishState ?? this.normalizePublishState(localParent);
        return localParentState === 'published';
      }
      return parentAvailability.get(parentUuid) === true;
    };

    return allMessages.map((message) => {
      const parentUuid = typeof message.parentUuid === 'string' ? message.parentUuid.trim() : '';
      if (!parentUuid) {
        return message;
      }

      const currentState = message.publishState ?? this.normalizePublishState(message);
      const parentAvailable = isParentAvailable(parentUuid);

      if (!parentAvailable) {
        if (currentState === 'dsa_locked') {
          return message;
        }
        return { ...message, publishState: 'parent_missing' as const };
      }

      return currentState === 'parent_missing'
        ? { ...message, publishState: 'server_missing' as const }
        : message;
    });
  }

  mergeOwnPublicMessages(localMessages: Message[], serverMessages: Message[]): Message[] {
    const merged = new Map<string, Message>();
    const serverByUuid = new Map<string, Message>();
    const localCommentCounts = new Map<string, number>();

    for (const localMessage of localMessages ?? []) {
      const parentUuid = typeof localMessage?.parentUuid === 'string' ? localMessage.parentUuid.trim() : '';
      if (!parentUuid) {
        continue;
      }
      localCommentCounts.set(parentUuid, (localCommentCounts.get(parentUuid) ?? 0) + 1);
    }

    for (const serverMessage of serverMessages ?? []) {
      const key = String(serverMessage?.uuid ?? '').trim();
      if (!key) {
        continue;
      }
      const normalized: Message = {
        ...serverMessage,
        publishState: this.normalizePublishState(serverMessage)
      };
      serverByUuid.set(key, normalized);
      merged.set(key, normalized);
    }

    for (const localMessage of localMessages ?? []) {
      const key = String(localMessage?.uuid ?? '').trim();
      if (!key) {
        continue;
      }

      const serverMessage = serverByUuid.get(key);
      if (serverMessage) {
        merged.set(key, {
          ...localMessage,
          ...serverMessage,
          translatedMessage: localMessage.translatedMessage ?? serverMessage.translatedMessage,
          publishState: this.normalizePublishState(serverMessage)
        });
        continue;
      }

      const localState = localMessage.publishState ?? this.normalizePublishState(localMessage);
      const missingState: Message['publishState'] = localState === 'local_only'
        ? 'local_only'
        : localState === 'draft'
          ? 'draft'
        : localState === 'parent_missing'
          ? 'parent_missing'
          : 'server_missing';
      merged.set(key, {
        ...localMessage,
        commentsNumber: localCommentCounts.get(key) ?? 0,
        publishState: missingState
      });
    }

    return Array.from(merged.values()).sort((a, b) => (b.createDateTime ?? 0) - (a.createDateTime ?? 0));
  }

  async syncOwnPublicMessages(user: User): Promise<Message[]> {
    const localMessages = await this.loadOwnPublicMessages(user.id);
    let serverMessages: Message[] = [];
    let serverSyncAvailable = false;
    try {
      await firstValueFrom(this.recountOwnCommentCounts(user.id));
      const response = await firstValueFrom(this.http.get<GetMessageResponse>(
        `${environment.apiUrl}/message/get/userId/${encodeURIComponent(user.id)}`,
        this.httpOptions
      ));
      serverMessages = this.mapRawMessages(response?.rows ?? [])
        .filter((message) => String(message.userId || '').trim() === user.id);
      serverSyncAvailable = true;
    } catch {
      const normalizedLocal = localMessages.map((message) => ({
        ...message,
        publishState: message.publishState ?? this.normalizePublishState(message)
      }));
      await this.saveOwnPublicMessages(user.id, normalizedLocal);
      return normalizedLocal;
    }

    const merged = serverSyncAvailable
      ? this.mergeOwnPublicMessages(localMessages, serverMessages)
      : localMessages;
    const refreshed = await this.refreshParentAvailability(merged);
    await this.saveOwnPublicMessages(user.id, refreshed);
    return refreshed;
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
      publishState: this.normalizePublishState({
        status: raw.status,
        dsaStatusToken: raw.dsaStatusToken,
        manualModerationDecision: raw.manualModerationDecision ?? null
      }),
      userId: raw.userId,
      multimedia: JSON.parse(raw.multimedia)
    };
  }

  createMessage(message: Message, user: User, showAlways = false) {
    this.publishMessage(message, user, {
      showAlways,
      persistDraft: true
    }).subscribe({
      error: () => {}
    });
  }

  public createComment(message: Message, user: User, showAlways = false, includeInRootList = false) {
    this.publishMessage(message, user, {
      showAlways,
      includeInRootList,
      persistDraft: true
    }).subscribe({
      error: () => {}
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
            this.patchMessageSnapshotSmart(message, {
              status: 'disabled',
              publishState: this.normalizePublishState({
                ...message,
                status: 'disabled'
              }),
              ...moderationPatch
            });
            return;
          }

          this.patchMessageSnapshotSmart(message, {
            ...message,
            status: 'enabled',
            publishState: this.normalizePublishState({
              ...message,
              status: 'enabled'
            }),
            ...moderationPatch
          });
          if (decision === 'review') {
            this.showModerationReviewMessage(this.i18n.t('common.message.moderationReview'));
          } else if (wasDisabled) {
            this.showPublishedMessage(this.i18n.t('common.message.republished'));
          }
        },
        error: err => this.snackBar.open(err.message, this.i18n.t('common.actions.ok'))
      });
  }

  setMessagePublished(message: Message, published: boolean, showAlways = false): Observable<SimpleStatusResponse> {
    const idOrUuid = this.getMessageIdentifier(message);
    if (!idOrUuid) {
      return throwError(() => new Error('invalid_message_identifier'));
    }
    const action = published ? 'enable' : 'disable';
    const url = `${environment.apiUrl}/message/${action}/${encodeURIComponent(String(idOrUuid))}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways,
      title: this.i18n.t('common.message.title'),
      image: '',
      icon: '',
      message: published ? this.i18n.t('common.message.updating') : this.i18n.t('common.message.disabling'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });

    return this.http.get<SimpleStatusResponse>(url, this.httpOptions).pipe(
      catchError(this.handleError)
    );
  }

  publishMessage(message: Message, user: User, options: PublishMessageOptions = {}): Observable<PublishMessageResult> {
    const {
      showAlways = false,
      includeInRootList = false,
      persistDraft = false
    } = options;

    const preparedMessage$ = persistDraft
      ? from(this.saveDraftMessage(message, user))
      : of(message);

    return preparedMessage$.pipe(
      switchMap((preparedMessage) => {
        const publishState = preparedMessage.publishState ?? this.normalizePublishState(preparedMessage);
        if (this.shouldPublishViaCreate(preparedMessage, publishState)) {
          return this.createMessageRequest(preparedMessage, user, showAlways).pipe(
            map((response) => this.applyCreatePublishSuccess(preparedMessage, user, response, includeInRootList))
          );
        }

        return this.setMessagePublished(preparedMessage, true, showAlways).pipe(
          map((response) => {
            if (response?.status !== 200) {
              return {
                status: response?.status ?? 0,
                via: 'enable' as const,
                moderation: null,
                messageId: Number.isFinite(preparedMessage.id) ? preparedMessage.id : null,
                messageUuid: preparedMessage.uuid ?? null,
                published: false
              };
            }

            return this.applyEnablePublishSuccess(preparedMessage, user);
          })
        );
      })
    );
  }

  publishMissingMessage(
    message: Message,
    user: User,
    showAlways = false,
    includeInRootList = false
  ): Observable<PublishMessageResult> {
    return this.publishMessage(message, user, {
      showAlways,
      includeInRootList,
      persistDraft: false
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
      this.setMessages([]);
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
          this.setMessages([]);
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
        this.setMessages(mappedMessages);
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
        this.setMessages([]);
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

  verifyMessageExistsByUuid(messageUuid: string): Observable<{ exists: boolean; status: number | null; published: boolean; messageStatus: string | null }> {
    const trimmedUuid = typeof messageUuid === 'string' ? messageUuid.trim() : '';
    if (!trimmedUuid) {
      return of({ exists: false, status: 400, published: false, messageStatus: null });
    }

    const headers = this.httpOptions.headers
      .set('x-skip-ui', 'true')
      .set('x-skip-backend-status', 'true');

    return this.http.get<{ status: number; message?: RawMessage }>(
      `${environment.apiUrl}/message/get/uuid/${encodeURIComponent(trimmedUuid)}`,
      { ...this.httpOptions, headers }
    ).pipe(
      map((response) => {
        const messageStatus = typeof response?.message?.status === 'string'
          ? response.message.status
          : null;
        return {
          exists: Boolean(response?.message),
          status: 200,
          published: String(messageStatus || '').trim().toLowerCase() === 'enabled',
          messageStatus
        };
      }),
      catchError((error: HttpErrorResponse) => of({
        exists: false,
        status: typeof error?.status === 'number' ? error.status : null,
        published: false,
        messageStatus: null
      }))
    );
  }

  markMessageTreeUnpublishedLocally(rootMessage: Message): void {
    const rootUuid = typeof rootMessage?.uuid === 'string' ? rootMessage.uuid.trim() : '';
    if (!rootUuid) {
      return;
    }

    const allMessages = new Map<string, Message>();
    const collect = (items: Message[]) => {
      for (const message of items ?? []) {
        const uuid = typeof message?.uuid === 'string' ? message.uuid.trim() : '';
        if (uuid) {
          allMessages.set(uuid, message);
        }
      }
    };

    collect(this.messagesSignal());
    collect(this.selectedMessagesSignal());
    for (const commentsSignal of this.commentsSignals.values()) {
      collect(commentsSignal());
    }

    const affectedUuids = new Set<string>([rootUuid]);
    const queue = [rootUuid];
    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        continue;
      }
      for (const message of allMessages.values()) {
        if (message.parentUuid === current && !affectedUuids.has(message.uuid)) {
          affectedUuids.add(message.uuid);
          queue.push(message.uuid);
        }
      }
    }

    const patchMessage = (message: Message): Message => {
      if (!affectedUuids.has(message.uuid)) {
        return message;
      }

      return {
        ...message,
        status: 'disabled',
        publishState: message.uuid === rootUuid ? 'unpublished' : 'parent_missing',
        commentsNumber: 0
      };
    };

    this.messagesSignal.update((messages) => messages.map(patchMessage));
    this.selectedMessagesSignal.update((messages) => messages.map(patchMessage));
    for (const [parentUuid, commentsSignal] of this.commentsSignals.entries()) {
      commentsSignal.set(commentsSignal().map(patchMessage));
      if (affectedUuids.has(parentUuid)) {
        this.commentCountsSignal.update((counts) => ({
          ...counts,
          [parentUuid]: 0
        }));
      }
    }

    this.commentCountsSignal.update((counts) => {
      const next = { ...counts };
      affectedUuids.forEach((uuid) => {
        next[uuid] = 0;
      });
      if (rootMessage.parentUuid) {
        next[rootMessage.parentUuid] = Math.max((next[rootMessage.parentUuid] ?? 0) - 1, 0);
      }
      return next;
    });

    if (rootMessage.parentUuid) {
      const nextParentCount = Math.max(
        (this.commentCountsSignal()[rootMessage.parentUuid] ?? 0),
        0
      );
      const patchParent = (message: Message): Message => (
        message.uuid === rootMessage.parentUuid
          ? { ...message, commentsNumber: nextParentCount }
          : patchMessage(message)
      );
      this.messagesSignal.update((messages) => messages.map(patchParent));
      this.selectedMessagesSignal.update((messages) => messages.map(patchParent));
      for (const commentsSignal of this.commentsSignals.values()) {
        commentsSignal.set(commentsSignal().map(patchParent));
      }
    }
  }

  recountOwnCommentCounts(userId: string): Observable<{ status: number; updated?: number }> {
    const trimmedUserId = typeof userId === 'string' ? userId.trim() : '';
    if (!trimmedUserId) {
      return of({ status: 400, updated: 0 });
    }

    return this.http.post<{ status: number; updated?: number }>(
      `${environment.apiUrl}/message/recount-comments/${encodeURIComponent(trimmedUserId)}`,
      {},
      this.httpOptions
    ).pipe(
      catchError((error: HttpErrorResponse) => of({
        status: typeof error?.status === 'number' ? error.status : 500,
        updated: 0
      }))
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

  private removeMessageFromSignals(message: Message): void {
    const isRootMessage = this.messagesSignal().some(m => m.id === message.id || m.uuid === message.uuid);

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
      return;
    }

    if (message.parentUuid) {
      const commentsSignal = this.getCommentsSignalForMessage(message.parentUuid);
      commentsSignal.set(commentsSignal().filter(c => c.id !== message.id && c.uuid !== message.uuid));

      this.commentCountsSignal.update(counts => ({
        ...counts,
        [message.parentUuid!]: Math.max((counts[message.parentUuid!] || 0) - 1, 0)
      }));

      this.commentCounts[message.parentUuid] = Math.max((this.commentCounts[message.parentUuid] || 0) - 1, 0);
    }
  }

  deleteMessage(message: Message, showAlways = false) {
    const idOrUuid = this.getMessageIdentifier(message);
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
          this.removeMessageFromSignals(message);
        },
        error: (err) => {
          if (err?.status === 404) {
            this.removeMessageFromSignals(message);
            return;
          }
          const errorMessage = err.message ?? this.i18n.t('common.message.deleteFailed');
          this.snackBar.open(errorMessage, this.i18n.t('common.actions.ok'));
        }
      });
  }

  public async loadCommentsForParentMessage(message: Message, showAlways = false): Promise<Message[]> {
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
    try {
      const getMessageResponse = await firstValueFrom(
        this.http.get<GetMessageResponse>(url, this.httpOptions).pipe(catchError(this.handleError))
      );
      const comments = (getMessageResponse.rows ?? []).map((rawMessage: RawMessage) => this.mapRawMessage(rawMessage));
      commentsSignal.set(comments);

      const nextParentCount = Math.max(
        Number.isFinite(message.commentsNumber) ? message.commentsNumber : 0,
        comments.length
      );
      this.setCommentCountForMessage(message.uuid, nextParentCount);

      comments.forEach(comment => {
        this.commentCounts[comment.uuid] = comment.commentsNumber;
      });
      this.commentCountsSignal.set({ ...this.commentCounts });
      return comments;
    } catch {
      commentsSignal.set([]);
      return [];
    }
  }

  public getCommentsForParentMessage(message: Message, showAlways = false) {
    void this.loadCommentsForParentMessage(message, showAlways);
  }

  detectPersonalInformation(text: string): boolean {
    const commonTlds = new Set([
      'com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'name', 'pro', 'dev', 'app', 'io',
      'de', 'at', 'ch', 'fr', 'es', 'it', 'pt', 'nl', 'be', 'lu', 'uk', 'ie',
      'us', 'ca', 'au', 'nz', 'jp', 'kr', 'cn', 'in', 'br', 'mx', 'ar', 'cl', 'co',
      'se', 'no', 'dk', 'fi', 'pl', 'cz', 'sk', 'hu', 'ro', 'bg', 'hr', 'si', 'gr', 'tr', 'ru', 'ua'
    ]);
    const containsUuidLikeValue = (value: string): boolean =>
      /(^|[^0-9a-f])(?:[0-9a-f]{8}[\s\u200B-\u200D\uFEFF._:,;/\\|()\[\]{}#*+=~"'`-]*[0-9a-f]{4}[\s\u200B-\u200D\uFEFF._:,;/\\|()\[\]{}#*+=~"'`-]*[1-8][0-9a-f]{3}[\s\u200B-\u200D\uFEFF._:,;/\\|()\[\]{}#*+=~"'`-]*[89ab][0-9a-f]{3}[\s\u200B-\u200D\uFEFF._:,;/\\|()\[\]{}#*+=~"'`-]*[0-9a-f]{12})([^0-9a-f]|$)/i
        .test(value);
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

    if (
      containsUuidLikeValue(text)
      || containsUuidLikeValue(normalizedObfuscatedText)
      || patterns.some((pattern) => pattern.test(text) || pattern.test(normalizedObfuscatedText))
    ) {
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
