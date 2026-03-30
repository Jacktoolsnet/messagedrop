import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { TranslateResponse } from '../interfaces/translate-response';
import { LanguageService } from './language.service';
import { NetworkService } from './network.service';
import { TranslationHelperService } from './translation-helper.service';
import { UserService } from './user.service';

interface TranslateRequest {
  language: string;
  value: string;
  messageUuid?: string;
  deeplApiKey?: string;
}

interface ValidateTranslateKeyResponse {
  status: number;
  result?: {
    valid: boolean;
    quotaReached: boolean;
    characterCount: number | null;
    characterLimit: number | null;
  };
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class TranslateService {

  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      withCredentials: 'true'
    })
  };

  private readonly http = inject(HttpClient);
  private readonly languageService = inject(LanguageService);
  private readonly networkService = inject(NetworkService);
  private readonly i18n = inject(TranslationHelperService);
  private readonly userService = inject(UserService);

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  private resolveTargetLanguage(language: string | null | undefined): string {
    const trimmed = typeof language === 'string' ? language.trim() : '';
    if (trimmed) {
      return trimmed.toUpperCase();
    }
    const fallback = this.languageService.effectiveLanguage?.() ?? 'en';
    return fallback.toUpperCase();
  }

  private extractApiMessage(error: unknown): string | null {
    const extract = (value: unknown): string | null => {
      if (!value || typeof value !== 'object') {
        return null;
      }

      const candidate = value as { message?: unknown; error?: unknown };
      if (typeof candidate.error === 'string' && candidate.error.trim()) {
        return candidate.error.trim();
      }
      if (typeof candidate.message === 'string' && candidate.message.trim()) {
        return candidate.message.trim();
      }
      return null;
    };

    if (error instanceof HttpErrorResponse) {
      return extract(error.error);
    }
    return extract(error);
  }

  public getErrorMessage(error: unknown): string | null {
    switch (this.extractApiMessage(error)) {
      case 'user_deepl_auth_failed':
        return this.i18n.t('common.translate.userApiKeyInvalid');
      case 'user_deepl_quota_exceeded':
        return this.i18n.t('common.translate.userApiKeyQuotaExceeded');
      case 'user_deepl_auth_required':
        return this.i18n.t('common.user.translationSettings.testEmpty');
      case 'translate_key_validation_failed':
        return this.i18n.t('common.user.translationSettings.testError');
      case 'translate_failed_rate_limited':
        return this.i18n.t('errors.rateLimit');
      case 'translate_value_required':
        return this.i18n.t('common.translate.emptyText');
      default:
        return null;
    }
  }

  public translate(value: string, language: string, showAlways = false, messageUuid?: string | null) {
    const targetLang = this.resolveTargetLanguage(language);
    const safeMessageUuid = typeof messageUuid === 'string' ? messageUuid.trim() : '';
    const customDeeplApiKey = this.userService.getDeeplApiKey();
    const body: TranslateRequest = {
      language: targetLang,
      value,
      ...(safeMessageUuid ? { messageUuid: safeMessageUuid } : {}),
      ...(customDeeplApiKey ? { deeplApiKey: customDeeplApiKey } : {})
    };
    const url = `${environment.apiUrl}/translate`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: this.i18n.t('common.translate.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.translate.message'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });
    return this.http.post<TranslateResponse>(url, body, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

  public validateDeeplApiKey(deeplApiKey: string) {
    return this.http.post<ValidateTranslateKeyResponse>(
      `${environment.apiUrl}/translate/validate`,
      { deeplApiKey },
      this.httpOptions
    ).pipe(
      catchError(this.handleError)
    );
  }

}
