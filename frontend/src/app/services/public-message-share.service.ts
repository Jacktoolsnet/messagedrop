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
  private readonly publicShareBaseUrl = this.resolvePublicShareBaseUrl();

  canShare(message: Pick<Message, 'uuid' | 'status'> | null | undefined): boolean {
    const uuid = typeof message?.uuid === 'string' ? message.uuid.trim() : '';
    return !!uuid && message?.status === 'enabled';
  }

  buildPublicMessageUrl(messageUuid: string): string {
    const trimmedUuid = typeof messageUuid === 'string' ? messageUuid.trim() : '';
    return `${this.publicShareBaseUrl}/${encodeURIComponent(trimmedUuid)}`;
  }

  buildAppMessageUrl(messageUuid: string): string {
    const trimmedUuid = typeof messageUuid === 'string' ? messageUuid.trim() : '';
    return `${this.resolveAppBaseUrl()}/?publicMessage=${encodeURIComponent(trimmedUuid)}`;
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
    void message;
    return this.translation.t('common.share.publicMessageText');
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

  private resolvePublicShareBaseUrl(): string {
    const configuredShareBaseUrl = String(environment.publicShareBaseUrl || '').trim().replace(/\/+$/, '');
    if (configuredShareBaseUrl) {
      return configuredShareBaseUrl;
    }

    const publicSiteUrl = String(environment.publicSiteUrl || '').trim().replace(/\/+$/, '');
    if (publicSiteUrl) {
      return `${publicSiteUrl}/p`;
    }

    const apiBaseUrl = String(environment.apiUrl || '').trim().replace(/\/+$/, '');
    return apiBaseUrl ? `${apiBaseUrl}/p` : '/p';
  }

  private resolveAppBaseUrl(): string {
    const browserOrigin = this.resolveBrowserOrigin();
    if (browserOrigin) {
      return browserOrigin;
    }

    return String(environment.appUrl || '').trim().replace(/\/+$/, '');
  }

  private resolveBrowserOrigin(): string {
    if (typeof window === 'undefined' || !window.location?.origin) {
      return '';
    }

    return String(window.location.origin).trim().replace(/\/+$/, '');
  }
}
