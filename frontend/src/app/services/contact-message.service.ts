import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Buffer } from 'buffer';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { ContactMessage, ContactMessageListResponse, ContactMessageSendResponse } from '../interfaces/contact-message';
import { Contact } from '../interfaces/contact';
import { ShortMessage } from '../interfaces/short-message';
import { CryptoData } from '../interfaces/crypto-data';
import { CryptoService } from './crypto.service';
import { UserService } from './user.service';
import { SocketioService } from './socketio.service';
import { Envelope } from '../interfaces/envelope';
import { ContactService } from './contact.service';

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

@Injectable({
  providedIn: 'root'
})
export class ContactMessageService {
  private readonly http = inject(HttpClient);
  private readonly cryptoService = inject(CryptoService);
  private readonly userService = inject(UserService);
  private readonly socketioService = inject(SocketioService);
  private readonly contactService = inject(ContactService);

  readonly liveMessages = signal<ContactMessage | null>(null);
  readonly updatedMessages = signal<ContactMessage | null>(null);
  readonly deletedMessage = signal<{ messageId: string } | null>(null);

  private readonly httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-Authorization': `${environment.apiToken}`,
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

  deleteMessage(payload: DeleteMessagePayload) {
    return this.http.post<{ status: number; messageId: string }>(
      `${environment.apiUrl}/contactMessage/delete`,
      payload,
      this.httpOptions
    ).pipe(catchError(this.handleError));
  }

  markRead(messageIds: string[]) {
    return this.http.post<{ status: number; updated?: number }>(
      `${environment.apiUrl}/contactMessage/read`,
      { messageIds },
      this.httpOptions
    ).pipe(catchError(this.handleError));
  }

  markAllRead(contactId: string, before?: string) {
    return this.http.post<{ status: number }>(
      `${environment.apiUrl}/contactMessage/read`,
      { contactId, before },
      this.httpOptions
    ).pipe(catchError(this.handleError));
  }

  unreadCount(contactId: string) {
    return this.http.get<{ status: number; unread: number }>(
      `${environment.apiUrl}/contactMessage/unread/${contactId}`,
      this.httpOptions
    ).pipe(catchError(this.handleError));
  }

  initLiveReceive(): void {
    this.socketioService.initSocket();
    this.socketioService.initUserSocketEvents();
    const eventName = `receiveContactMessage:${this.userService.getUser().id}`;
    // ensure no duplicate handlers
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
          encryptedMessage: payload.envelope.contactUserEncryptedMessage || payload.envelope.userEncryptedMessage,
          signature: payload.envelope.messageSignature,
          status: 'delivered',
          createdAt: new Date().toISOString(),
          readAt: null
        };
        this.liveMessages.set(msg);
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
          encryptedMessage: payload.envelope.contactUserEncryptedMessage || payload.envelope.userEncryptedMessage,
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
    this.socketioService.getSocket().on(deleteEventName, (payload: { status: number; messageId?: string }) => {
      if (payload?.status === 200 && payload.messageId) {
        this.deletedMessage.set({ messageId: payload.messageId });
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

  async decryptAndVerify(contact: Contact, msg: ContactMessage): Promise<ShortMessage | null> {
    try {
      const decrypted = await this.cryptoService.decrypt(
        this.userService.getUser().cryptoKeyPair.privateKey,
        JSON.parse(msg.encryptedMessage) as CryptoData
      );
      if (!decrypted) return null;

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
      if (!valid) return null;
      return JSON.parse(decrypted) as ShortMessage;
    } catch {
      return null;
    }
  }
}
