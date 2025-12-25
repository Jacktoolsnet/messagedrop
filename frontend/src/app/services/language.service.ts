import { effect, inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

const LANGUAGE_STORAGE_KEY = 'messagedrop.language';
const SUPPORTED_LANGS = ['en', 'de'] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);

  readonly availableLangs = SUPPORTED_LANGS;
  readonly activeLang = signal<SupportedLang>(this.resolveInitialLang());

  constructor() {
    effect(() => {
      const lang = this.activeLang();
      this.transloco.setActiveLang(lang);
      this.persistLang(lang);
    });
  }

  setLanguage(lang: string): void {
    this.activeLang.set(this.normalizeLang(lang) ?? this.defaultLang);
  }

  private get defaultLang(): SupportedLang {
    return 'en';
  }

  private resolveInitialLang(): SupportedLang {
    const stored = this.normalizeLang(this.readStoredLang());
    if (stored) {
      return stored;
    }

    const browser = this.resolveBrowserLang();
    if (browser) {
      return browser;
    }

    return this.defaultLang;
  }

  private resolveBrowserLang(): SupportedLang | null {
    if (typeof navigator === 'undefined') {
      return null;
    }

    const candidates = navigator.languages?.length
      ? navigator.languages
      : [navigator.language];

    for (const candidate of candidates) {
      const normalized = this.normalizeLang(candidate);
      if (normalized) {
        return normalized;
      }
    }

    return null;
  }

  private normalizeLang(lang: string | null | undefined): SupportedLang | null {
    if (!lang) {
      return null;
    }

    const normalized = lang.toLowerCase().split('-')[0];
    return SUPPORTED_LANGS.includes(normalized as SupportedLang)
      ? (normalized as SupportedLang)
      : null;
  }

  private readStoredLang(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    try {
      return localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private persistLang(lang: SupportedLang): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
    }
  }
}
