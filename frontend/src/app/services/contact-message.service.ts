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

interface SendMessagePayload {
  id?: string;
  contactId: string;
  direction: 'user' | 'contactUser';
  encryptedMessage: string;
  signature: string;
  status?: 'sent' | 'delivered' | 'read';
  createdAt?: string;
  userId: string;
  contactUserId: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContactMessageService {
  private readonly http = inject(HttpClient);
  private readonly cryptoService = inject(CryptoService);
  private readonly userService = inject(UserService);
  private readonly socketioService = inject(SocketioService);

  readonly liveMessages = signal<ContactMessage | null>(null);

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

  initLiveReceive(): void {
    // Already initialized
    if (this.socketioService.hasJoinedUserRoom()) {
      return;
    }
    this.socketioService.initSocket();
    this.socketioService.initUserSocketEvents();
    this.socketioService.getSocket().on(`receiveShortMessage:${this.userService.getUser().id}`, (payload: { status: number; envelope: Envelope; }) => {
      if (payload?.status === 200 && payload.envelope) {
        const msgId = (payload.envelope as unknown as { id?: string }).id ?? crypto.randomUUID();
        const msg: ContactMessage = {
          id: msgId,
          contactId: payload.envelope.contactId,
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
  }

  async encryptMessageForContact(contact: Contact, message: ShortMessage): Promise<{ encryptedMessage: string; signature: string }> {
    const plain = JSON.stringify(message);
    const signature = await this.cryptoService.createSignature(this.userService.getUser().signingKeyPair.privateKey, plain);

    const encryptedMessage = await this.cryptoService.encrypt(
      contact.contactUserEncryptionPublicKey!,
      plain
    );

    return { encryptedMessage, signature };
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
      const valid = await this.cryptoService.verifySignature(
        contact.contactUserSigningPublicKey!,
        decrypted,
        signatureBuffer
      );
      if (!valid) return null;
      return JSON.parse(decrypted) as ShortMessage;
    } catch {
      return null;
    }
  }
}
