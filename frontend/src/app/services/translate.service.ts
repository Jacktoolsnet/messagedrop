import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { TranslateResponse } from '../interfaces/translate-response';
import { LanguageService } from './language.service';
import { NetworkService } from './network.service';
import { TranslationHelperService } from './translation-helper.service';

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

  public translate(value: string, language: string, showAlways = false, messageUuid?: string | null) {
    const targetLang = this.resolveTargetLanguage(language);
    const safeLang = encodeURIComponent(targetLang);
    const safeValue = encodeURIComponent(value);
    const safeMessageUuid = typeof messageUuid === 'string' ? messageUuid.trim() : '';
    const query = safeMessageUuid ? `?messageUuid=${encodeURIComponent(safeMessageUuid)}` : '';
    const url = `${environment.apiUrl}/translate/${safeLang}/${safeValue}${query}`;
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
    return this.http.get<TranslateResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }

}
