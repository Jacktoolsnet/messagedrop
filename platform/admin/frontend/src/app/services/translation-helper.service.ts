import { inject, Injectable } from '@angular/core';
import { LanguageService } from './language.service';

@Injectable({ providedIn: 'root' })
export class TranslationHelperService {
  private readonly languageService = inject(LanguageService);

  t(key: string, params?: Record<string, unknown>): string {
    return this.languageService.translate(key, params);
  }

  lang(): string {
    return this.languageService.effectiveLanguage();
  }

  dateLocale(): string {
    return this.languageService.dateLocale();
  }
}
