import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { AppService } from './app.service';

const LANGUAGE_STORAGE_KEY = 'messagedrop.language';
const SUPPORTED_LANGS = ['en', 'de', 'es', 'fr'] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];
export type LanguageMode = 'system' | SupportedLang;

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly appService = inject(AppService);

  private readonly _languageMode = signal<LanguageMode>(this.resolveInitialMode());
  readonly languageMode = this._languageMode.asReadonly();
  readonly availableLangs = SUPPORTED_LANGS;
  readonly effectiveLanguage = computed<SupportedLang>(() => {
    const mode = this._languageMode();
    if (mode === 'system') {
      return this.resolveBrowserLang() ?? this.defaultLang;
    }

    return mode;
  });

  private readonly persistedMode = computed<LanguageMode | null>(() => {
    this.appService.settingsSet();
    if (!this.appService.isSettingsReady()) {
      return null;
    }

    return this.resolveModeFromSettings();
  });

  constructor() {
    effect(() => {
      const lang = this.effectiveLanguage();
      this.transloco.setActiveLang(lang);
      this.updateDocumentLang(lang);
    });

    effect(() => {
      const mode = this._languageMode();
      this.persistLocalStorage(mode);
    });

    effect(() => {
      const persisted = this.persistedMode();
      if (persisted && persisted !== this._languageMode()) {
        this._languageMode.set(persisted);
      }
    });

    effect(() => {
      const mode = this._languageMode();
      this.appService.settingsSet();
      if (!this.appService.isSettingsReady()) {
        return;
      }

      const settings = this.appService.getAppSettings();
      if (settings.languageMode === mode) {
        return;
      }

      void this.appService.setAppSettings({ ...settings, languageMode: mode });
    });
  }

  setLanguageMode(mode: LanguageMode): void {
    if (mode !== this._languageMode()) {
      this._languageMode.set(mode);
    }
  }

  private get defaultLang(): SupportedLang {
    return 'en';
  }

  private resolveInitialMode(): LanguageMode {
    if (this.appService.isSettingsReady()) {
      const settingsMode = this.resolveModeFromSettings();
      if (settingsMode) {
        return settingsMode;
      }
    }

    const stored = this.normalizeMode(this.readStoredMode());
    if (stored) {
      return stored;
    }

    return 'system';
  }

  private resolveBrowserLang(): SupportedLang | null {
    if (typeof navigator === 'undefined') {
      return null;
    }

    const candidate = navigator.languages?.[0] || navigator.language;
    return this.normalizeLang(candidate) ?? this.defaultLang;
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

  private resolveModeFromSettings(): LanguageMode | null {
    const settings = this.appService.getAppSettings();
    const mode = this.normalizeMode(settings.languageMode);
    if (mode) {
      return mode;
    }

    const legacy = this.normalizeLang(settings.language);
    return legacy ?? null;
  }

  private normalizeMode(mode: string | null | undefined): LanguageMode | null {
    if (!mode) {
      return null;
    }

    if (mode === 'system') {
      return mode;
    }

    return this.normalizeLang(mode);
  }

  private readStoredMode(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    try {
      return localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      return null;
    }
  }

  private persistLocalStorage(mode: LanguageMode): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, mode);
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
