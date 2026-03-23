import { Injectable } from '@angular/core';

export const SUPPORTED_LANGS = ['en', 'de'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];
type TranslationDictionary = Record<string, string>;

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly defaultLang: SupportedLang = 'en';
  private readonly language = this.detectLanguage();
  private translations: TranslationDictionary = {};

  async init(): Promise<void> {
    this.translations = await this.loadDictionary(this.language);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = this.language;
    }
  }

  effectiveLanguage(): SupportedLang {
    return this.language;
  }

  localeId(): string {
    return this.language;
  }

  dateLocale(): string {
    return this.language === 'de' ? 'de-DE' : 'en-US';
  }

  translate(key: string, params?: Record<string, unknown>): string {
    const template = this.translations[key] ?? key;
    if (!params) {
      return template;
    }

    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, token: string) => {
      const value = params[token];
      return value === undefined || value === null ? '' : String(value);
    });
  }

  private detectLanguage(): SupportedLang {
    if (typeof navigator === 'undefined') {
      return this.defaultLang;
    }

    const candidates = [
      ...(Array.isArray(navigator.languages) ? navigator.languages : []),
      navigator.language
    ]
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => value.toLowerCase());

    return candidates.some((value) => value.startsWith('de')) ? 'de' : 'en';
  }

  private async loadDictionary(lang: SupportedLang): Promise<TranslationDictionary> {
    try {
      const response = await fetch(`/i18n/${lang}/common.json`, { cache: 'no-cache' });
      if (!response.ok) {
        return {};
      }

      const json = await response.json();
      return this.isDictionary(json) ? json : {};
    } catch {
      return {};
    }
  }

  private isDictionary(value: unknown): value is TranslationDictionary {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
