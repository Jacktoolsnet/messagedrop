import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { AppService } from './app.service';

const LANGUAGE_STORAGE_KEY = 'messagedrop.language';
const SUPPORTED_LANGS = ['en', 'de'] as const;
type SupportedLang = (typeof SUPPORTED_LANGS)[number];

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly appService = inject(AppService);

  private readonly _activeLang = signal<SupportedLang>(this.resolveInitialLang());
  readonly activeLang = this._activeLang.asReadonly();
  readonly availableLangs = SUPPORTED_LANGS;

  private readonly persistedLang = computed<SupportedLang | null>(() => {
    this.appService.settingsSet();
    if (!this.appService.isSettingsReady()) {
      return null;
    }

    return this.normalizeLang(this.appService.getAppSettings().language);
  });

  constructor() {
    effect(() => {
      const lang = this._activeLang();
      this.transloco.setActiveLang(lang);
      this.updateDocumentLang(lang);
      this.persistLocalStorage(lang);
    });

    effect(() => {
      const persisted = this.persistedLang();
      if (persisted && persisted !== this._activeLang()) {
        this._activeLang.set(persisted);
      }
    });

    effect(() => {
      const lang = this._activeLang();
      this.appService.settingsSet();
      if (!this.appService.isSettingsReady()) {
        return;
      }

      const settings = this.appService.getAppSettings();
      if (settings.language === lang) {
        return;
      }

      void this.appService.setAppSettings({ ...settings, language: lang });
    });
  }

  setLanguage(lang: SupportedLang): void {
    if (lang !== this._activeLang()) {
      this._activeLang.set(lang);
    }
  }

  private get defaultLang(): SupportedLang {
    return 'en';
  }

  private resolveInitialLang(): SupportedLang {
    if (this.appService.isSettingsReady()) {
      const settingsLang = this.normalizeLang(this.appService.getAppSettings().language);
      if (settingsLang) {
        return settingsLang;
      }
    }

    const stored = this.normalizeLang(this.readStoredLang());
    if (stored) {
      return stored;
    }

    return this.resolveBrowserLang() ?? this.defaultLang;
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

  private persistLocalStorage(lang: SupportedLang): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
    }
  }

  private updateDocumentLang(lang: SupportedLang): void {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.lang = lang;
  }
}
