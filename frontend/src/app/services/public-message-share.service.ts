import { Injectable, inject } from '@angular/core';
import { environment } from '../../environments/environment';
import { Message } from '../interfaces/message';
import { DisplayMessageService } from './display-message.service';
import { TranslationHelperService } from './translation-helper.service';

@Injectable({
  providedIn: 'root'
})
export class PublicMessageShareService {
  private readonly snackBar = inject(DisplayMessageService);
  private readonly translation = inject(TranslationHelperService);

  canShare(message: Pick<Message, 'uuid' | 'status'> | null | undefined): boolean {
    const uuid = typeof message?.uuid === 'string' ? message.uuid.trim() : '';
    return !!uuid && message?.status === 'enabled';
  }

  buildPublicMessageUrl(messageUuid: string): string {
    const trimmedUuid = typeof messageUuid === 'string' ? messageUuid.trim() : '';
    return `${environment.publicShareUrl}/${encodeURIComponent(trimmedUuid)}`;
  }

  buildAppMessageUrl(messageUuid: string): string {
    const trimmedUuid = typeof messageUuid === 'string' ? messageUuid.trim() : '';
    return `${environment.appUrl}/?publicMessage=${encodeURIComponent(trimmedUuid)}`;
  }

  async share(message: Pick<Message, 'uuid' | 'status' | 'message' | 'translatedMessage'>): Promise<void> {
    if (!this.canShare(message)) {
      return;
    }

    const url = this.buildPublicMessageUrl(message.uuid);
    const title = this.translation.t('common.share.publicMessageTitle');
    const text = this.buildShareText(message);

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        if (this.isAbortError(error)) {
          return;
        }
      }
    }

    const copied = await this.copyToClipboard(url);
    this.snackBar.open(
      copied
        ? this.translation.t('common.share.copySuccess')
        : this.translation.t('common.share.copyFailed'),
      undefined,
      {
        duration: 3200,
        verticalPosition: 'top',
        panelClass: copied ? 'snack-success' : 'snack-error'
      }
    );
  }

  private buildShareText(message: Pick<Message, 'message' | 'translatedMessage'>): string {
    const source = typeof message.translatedMessage === 'string' && message.translatedMessage.trim()
      ? message.translatedMessage
      : message.message;
    const normalized = source.replace(/\s+/g, ' ').trim();
    const excerpt = normalized.length > 140
      ? `${normalized.slice(0, 137).trimEnd()}…`
      : normalized;

    return excerpt
      ? this.translation.t('common.share.publicMessageText', { message: excerpt })
      : this.translation.t('common.share.publicMessageTitle');
  }

  private async copyToClipboard(text: string): Promise<boolean> {
    if (!text) {
      return false;
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        // fall through to legacy fallback
      }
    }

    if (typeof document === 'undefined') {
      return false;
    }

    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('readonly', 'true');
    input.style.position = 'fixed';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    document.body.appendChild(input);
    input.focus();
    input.select();

    try {
      return document.execCommand('copy');
    } catch {
      return false;
    } finally {
      document.body.removeChild(input);
    }
  }

  private isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
  }
}
