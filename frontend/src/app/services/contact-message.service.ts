import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Buffer } from 'buffer';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Contact } from '../interfaces/contact';
import { ContactMessage, ContactMessageListResponse, ContactMessageSendResponse } from '../interfaces/contact-message';
import { CryptoData } from '../interfaces/crypto-data';
import { Envelope } from '../interfaces/envelope';
import { ShortMessage } from '../interfaces/short-message';
import { ContactService } from './contact.service';
import { CryptoService } from './crypto.service';
import { IndexedDbService } from './indexed-db.service';
import { SocketioService } from './socketio.service';
import { UserService } from './user.service';

interface SendMessagePayload {
  id?: string;
  messageId?: string;
  contactId: string;
  direction: 'user' | 'contactUser';
  encryptedMessageForUser: string;
  encryptedMessageForContact: string;
  signature: string;
  status?: 'sent' | 'delivered' | 'read';
  createdAt?: string;
  userId: string;
  contactUserId: string;
}

interface UpdateMessagePayload {
  messageId: string;
  contactId: string;
  encryptedMessageForUser: string;
  encryptedMessageForContact: string;
  signature: string;
  status?: 'sent' | 'delivered' | 'read';
  userId: string;
  contactUserId: string;
}

interface DeleteMessagePayload {
  messageId: string;
  contactId: string;
  scope: 'single' | 'both';
  userId?: string;
  contactUserId?: string;
}

interface ReactionPayload {
  messageId: string;
  contactId: string;
  reaction: string | null;
  userId: string;
  contactUserId: string;
}

interface TranslationPayload {
  messageId: string;
  contactId: string;
  translatedMessage: string;
  userId: string;
}

interface PayloadAckPayload {
  contactId: string;
  messageIds: string[];
}

interface PayloadSyncResponse {
  status: number;
  purgedMessageIds: string[];
  nextCursor: number;
}

@Injectable({
  providedIn: 'root'
})
export class ContactMessageService {
  private readonly http = inject(HttpClient);
  private readonly cryptoService = inject(CryptoService);
  private readonly userService = inject(UserService);
  private readonly socketioService = inject(SocketioService);
  private readonly contactService = inject(ContactService);
  private readonly indexedDbService = inject(IndexedDbService);

  readonly liveMessages = signal<ContactMessage | null>(null);
  readonly updatedMessages = signal<ContactMessage | null>(null);
  readonly deletedMessage = signal<{ messageId: string; contactId?: string; remove?: boolean } | null>(null);
  readonly unreadCountUpdate = signal<{ contactId: string; unread: number } | null>(null);
  readonly reactionUpdate = signal<{ messageId: string; contactId?: string; reaction: string | null } | null>(null);

  mapStatusIcon(status?: 'sent' | 'delivered' | 'read' | 'deleted'): string {
    switch (status) {
      case 'read':
        return 'visibility';
      case 'delivered':
        return 'download';
      case 'deleted':
        return 'delete';
      case 'sent':
        return 'upload';
      default:
        return 'schedule';
    }
  }

  private readonly httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      withCredentials: 'true'
    })
  };

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  list(contactId: string, options?: { limit?: number; offset?: number; before?: string }) {
    let params = new HttpParams();
    if (options?.limit !== undefined) {
      params = params.set('limit', options.limit);
    }
    if (options?.offset !== undefined) {
      params = params.set('offset', options.offset);
    }
    if (options?.before) {
      params = params.set('before', options.before);
    }

    return this.http.get<ContactMessageListResponse>(
      `${environment.apiUrl}/contactMessage/list/${contactId}`,
      { ...this.httpOptions, params }
    ).pipe(catchError(this.handleError));
  }

  send(payload: SendMessagePayload) {
    return this.http.post<ContactMessageSendResponse>(
      `${environment.apiUrl}/contactMessage/send`,
      payload,
      this.httpOptions
    ).pipe(catchError(this.handleError));
  }

  updateMessage(payload: UpdateMessagePayload) {
    return this.http.post<{ status: number; messageId: string }>(
      `${environment.apiUrl}/contactMessage/update`,
      payload,
      this.httpOptions
    ).pipe(catchError(this.handleError));
  }

  updateTranslation(payload: TranslationPayload) {
    return this.http.post<{ status: number; messageId: string }>(
      `${environment.apiUrl}/contactMessage/translate`,
      payload,
      this.httpOptions
    ).pipe(catchError(this.handleError));
  }

  deleteMessage(payload: DeleteMessagePayload) {
    return this.http.post<{ status: number; messageId: string }>(
      `${environment.apiUrl}/contactMessage/delete`,
      payload,
      this.httpOptions
    ).pipe(catchError(this.handleError));
  }

  reactToMessage(payload: ReactionPayload) {
    return this.http.post<{ status: number; messageId: string; reaction: string | null }>(
      `${environment.apiUrl}/contactMessage/reaction`,
      payload,
      this.httpOptions
    ).pipe(catchError(this.handleError));
  }

  markReadBothCopies(payload: { messageId: string; contactId: string; userId: string; contactUserId: string }) {
    return this.http.post<{ status: number; messageId: string }>(
      `${environment.apiUrl}/contactMessage/status/read`,
      payload,
      this.httpOptions
    ).pipe(catchError(this.handleError));
  }

  unreadCount(contactId: string) {
    return this.http.get<{ status: number; unread: number }>(
      `${environment.apiUrl}/contactMessage/unread/${contactId}`,
      this.httpOptions
    ).pipe(catchError(this.handleError));
  }

  ackPayloadStored(payload: PayloadAckPayload) {
    return this.http.post<{ status: number; updated: number }>(
      `${environment.apiUrl}/contactMessage/payload/ack`,
      payload,
      this.httpOptions
    ).pipe(catchError(this.handleError));
  }

  syncPayloadState(contactId: string, since = 0, limit = 500) {
    let params = new HttpParams();
    params = params.set('since', Math.max(0, Math.floor(since)));
    params = params.set('limit', Math.max(1, Math.min(1000, Math.floor(limit))));
    return this.http.get<PayloadSyncResponse>(
      `${environment.apiUrl}/contactMessage/sync/${contactId}`,
      { ...this.httpOptions, params }
    ).pipe(catchError(this.handleError));
  }

  async getPayloadSyncCursor(contactId: string): Promise<number> {
    const key = this.getPayloadSyncCursorKey(contactId);
    const stored = await this.indexedDbService.getSetting<number | string>(key);
    if (typeof stored === 'number' && Number.isFinite(stored)) {
      return Math.max(0, Math.floor(stored));
    }
    if (typeof stored === 'string') {
      const parsed = Number.parseInt(stored, 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }
    return 0;
  }

  async setPayloadSyncCursor(contactId: string, cursor: number): Promise<void> {
    const key = this.getPayloadSyncCursorKey(contactId);
    await this.indexedDbService.setSetting(key, Math.max(0, Math.floor(cursor)));
  }

  async storeLocalPayload(messageId: string, payload: ShortMessage): Promise<void> {
    if (!messageId || !payload) {
      return;
    }
    await this.indexedDbService.setContactMessagePayload(messageId, payload);
  }

  async getLocalPayload(messageId: string): Promise<ShortMessage | null> {
    if (!messageId) {
      return null;
    }
    return (await this.indexedDbService.getContactMessagePayload(messageId)) ?? null;
  }

  async deleteLocalPayload(messageId: string): Promise<void> {
    if (!messageId) {
      return;
    }
    await this.indexedDbService.deleteContactMessagePayload(messageId);
  }

  initLiveReceive(): void {
    this.socketioService.initSocket();
    const eventName = `receiveContactMessage:${this.userService.getUser().id}`;
    this.socketioService.getSocket().off(eventName);
    this.socketioService.getSocket().on(eventName, (payload: { status: number; envelope: Envelope; }) => {
      if (payload?.status === 200 && payload.envelope) {
        // Map incoming message to the local contact by sender userId
        const contact = this.contactService.sortedContactsSignal().find((c) => c.contactUserId === payload.envelope.userId);
        if (!contact) {
          return;
        }
        const msgId = (payload.envelope as unknown as { id?: string }).id ?? crypto.randomUUID();
        const msg: ContactMessage = {
          id: msgId,
          messageId: payload.envelope.messageId ?? msgId,
          contactId: contact.id,
          direction: 'contactUser',
          message: payload.envelope.contactUserEncryptedMessage || payload.envelope.userEncryptedMessage,
          signature: payload.envelope.messageSignature,
          status: 'delivered',
          createdAt: new Date().toISOString(),
          readAt: null
        };
        this.liveMessages.set(msg);
        // Ensure unread badge updates even if chatroom not open
        this.emitUnreadCountUpdate(contact.id);
      }
    });

    const updateEventName = `receiveUpdatedContactMessage:${this.userService.getUser().id}`;
    this.socketioService.getSocket().off(updateEventName);
    this.socketioService.getSocket().on(updateEventName, (payload: { status: number; envelope: Envelope; }) => {
      if (payload?.status === 200 && payload.envelope) {
        const contact = this.contactService.sortedContactsSignal().find((c) => c.contactUserId === payload.envelope.userId);
        if (!contact) {
          return;
        }
        const msgId = (payload.envelope as unknown as { id?: string }).id ?? crypto.randomUUID();
        const msg: ContactMessage = {
          id: msgId,
          messageId: payload.envelope.messageId ?? msgId,
          contactId: contact.id,
          direction: 'contactUser',
          message: payload.envelope.contactUserEncryptedMessage || payload.envelope.userEncryptedMessage,
          signature: payload.envelope.messageSignature,
          status: 'delivered',
          createdAt: new Date().toISOString(),
          readAt: null
        };
        this.updatedMessages.set(msg);
      }
    });

    const deleteEventName = `receiveDeletedContactMessage:${this.userService.getUser().id}`;
    this.socketioService.getSocket().off(deleteEventName);
    this.socketioService.getSocket().on(deleteEventName, (payload: { status: number; messageId?: string; statusLabel?: string; userId?: string; remove?: boolean }) => {
      if (payload?.status === 200 && payload.messageId) {
        // Find contact by sender userId
        const contact = payload.userId
          ? this.contactService.sortedContactsSignal().find((c) => c.contactUserId === payload.userId)
          : undefined;
        this.deletedMessage.set({ messageId: payload.messageId, contactId: contact?.id, remove: payload.remove });
      }
    });

    const reactionEventName = `receiveContactMessageReaction:${this.userService.getUser().id}`;
    this.socketioService.getSocket().off(reactionEventName);
    this.socketioService.getSocket().on(reactionEventName, (payload: { status: number; messageId?: string; userId?: string; reaction?: string | null; contactId?: string }) => {
      if (payload?.status === 200 && payload.messageId) {
        const contact = payload.userId
          ? this.contactService.sortedContactsSignal().find((c) => c.contactUserId === payload.userId)
          : undefined;
        this.reactionUpdate.set({ messageId: payload.messageId, contactId: contact?.id ?? payload.contactId, reaction: payload.reaction ?? null });
      }
    });

    const readEventName = `receiveMessageRead:${this.userService.getUser().id}`;
    this.socketioService.getSocket().off(readEventName);
    this.socketioService.getSocket().on(readEventName, (payload: { status: number; messageId?: string; contactId?: string }) => {
      if (payload?.status === 200 && payload.messageId) {
        this.updatedMessages.set({
          id: payload.messageId,
          messageId: payload.messageId,
          contactId: payload.contactId ?? '',
          direction: 'user',
          message: '',
          signature: '',
          status: 'read',
          createdAt: ''
        } as ContactMessage);
      }
    });
  }

  emitUnreadCountUpdate(contactId: string): void {
    this.unreadCount(contactId).subscribe({
      next: (res) => {
        this.unreadCountUpdate.set({ contactId, unread: res.unread ?? 0 });
      },
      error: () => {
        this.unreadCountUpdate.set({ contactId, unread: 0 });
      }
    });
  }

  async encryptMessageForContact(contact: Contact, message: ShortMessage): Promise<{ encryptedMessageForUser: string; encryptedMessageForContact: string; signature: string }> {
    const plain = JSON.stringify(message);
    const signature = await this.cryptoService.createSignature(this.userService.getUser().signingKeyPair.privateKey, plain);

    const encryptedMessageForUser = await this.cryptoService.encrypt(
      this.userService.getUser().cryptoKeyPair.publicKey,
      plain
    );

    const encryptedMessageForContact = await this.cryptoService.encrypt(
      contact.contactUserEncryptionPublicKey!,
      plain
    );

    return { encryptedMessageForUser, encryptedMessageForContact, signature };
  }

  async encryptTranslation(text: string): Promise<string> {
    return this.cryptoService.encrypt(
      this.userService.getUser().cryptoKeyPair.publicKey,
      text
    );
  }

  async decryptAndVerify(contact: Contact, msg: ContactMessage): Promise<ShortMessage | null> {
    if (!msg.message?.trim()) {
      return null;
    }
    try {
      const decrypted = await this.cryptoService.decrypt(
        this.userService.getUser().cryptoKeyPair.privateKey,
        JSON.parse(msg.message) as CryptoData
      );
      if (!decrypted) return null;

      let payload: ShortMessage;
      try {
        payload = JSON.parse(decrypted) as ShortMessage;
      } catch {
        return null;
      }

      // Signatur prüfen
      const signatureBuffer = Buffer.from(JSON.parse(msg.signature));
      // Convert Buffer to ArrayBuffer for WebCrypto verify
      const signatureArrayBuffer = signatureBuffer.buffer.slice(
        signatureBuffer.byteOffset,
        signatureBuffer.byteOffset + signatureBuffer.byteLength
      );
      const signingKey = msg.direction === 'user'
        ? this.userService.getUser().signingKeyPair.publicKey
        : contact.contactUserSigningPublicKey!;
      const valid = await this.cryptoService.verifySignature(
        signingKey,
        decrypted,
        signatureArrayBuffer
      );

      const translated = await this.decryptTranslation(msg.translatedMessage);
      if (translated) {
        payload = { ...payload, translatedMessage: translated };
      }
      return { ...payload, verified: valid };
    } catch {
      return null;
    }
  }

  private async decryptTranslation(encrypted?: string | null): Promise<string | null> {
    if (!encrypted) {
      return null;
    }
    try {
      const decrypted = await this.cryptoService.decrypt(
        this.userService.getUser().cryptoKeyPair.privateKey,
        JSON.parse(encrypted) as CryptoData
      );
      return decrypted || null;
    } catch {
      return null;
    }
  }

  private getPayloadSyncCursorKey(contactId: string): string {
    return `contactMessageSyncCursor:${contactId}`;
  }
}
