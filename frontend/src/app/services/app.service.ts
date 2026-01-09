import { Injectable, inject, signal } from '@angular/core';
import { AppSettings } from '../interfaces/app-settings';
import { NotificationAction } from '../interfaces/notification-action';
import { IndexedDbService } from './indexed-db.service';

@Injectable({
  providedIn: 'root'
})

export class AppService {
  private settingsReady = false;
  private consentCompleted = false;
  private _settingsSet = signal(0);
  readonly settingsSet = this._settingsSet.asReadonly();

  private readonly legalVersion = 1;

  private themeListener: ((e: MediaQueryListEvent) => void) | null = null;
  private appSettings: AppSettings | undefined;
  private notificationAction?: NotificationAction;

  private readonly indexedDbService = inject(IndexedDbService);

  // Irgendwo oben im Service:
  private readonly defaultAppSettings: AppSettings = {
    languageMode: 'system',
    defaultTheme: 'azure',
    themeMode: 'system',
    detectLocationOnStart: false,
    persistStorage: false,
    enableYoutubeContent: false,
    enablePinterestContent: false,
    enableSpotifyContent: false,
    enableTikTokContent: false,
    enableTenorContent: false,
    enableUnsplashContent: false,
    diagnosticLogging: false,
    backupOnExit: false,
    consentSettings: {
      disclaimer: false,
      privacyPolicy: false,
      termsOfService: false,
      ageConfirmed: false
    },
    legalVersion: this.legalVersion,
    acceptedLegalVersion: undefined
  };

  public isSettingsReady(): boolean {
    return this.settingsReady;
  }

  public getLegalVersion(): number {
    return this.legalVersion;
  }

  public isConsentCompleted(): boolean {
    return this.consentCompleted;
  }

  async setAppSettings(newAppSettings: AppSettings): Promise<void> {
    const current = this.appSettings ?? this.defaultAppSettings;
    const merged = { ...this.defaultAppSettings, ...current, ...newAppSettings };

    // Wenn alle Zustimmungen erteilt sind, die akzeptierte Version mitschreiben
    const isConsentComplete =
      merged.consentSettings.disclaimer === true &&
      merged.consentSettings.privacyPolicy === true &&
      merged.consentSettings.termsOfService === true &&
      merged.consentSettings.ageConfirmed === true;

    merged.acceptedLegalVersion = isConsentComplete ? this.legalVersion : undefined;
    await this.indexedDbService.setSetting('appSettings', JSON.stringify(merged)).then(() => {
      this.appSettings = merged;
      this.setTheme(this.appSettings);
      this.chekConsentCompleted();
      this._settingsSet.update(trigger => trigger + 1);
    });
  }

  public getAppSettings(): AppSettings {
    if (!this.appSettings) {
      this.appSettings = { ...this.defaultAppSettings };
    }
    return this.appSettings;
  }

  async loadAppSettings(): Promise<void> {
    try {
      const raw = await this.indexedDbService.getSetting<string>('appSettings');
      const parsed = raw ? JSON.parse(raw) as Partial<AppSettings> : null;
      this.appSettings = { ...this.defaultAppSettings, ...(parsed ?? {}) };

      // Wenn die gespeicherte Version nicht der aktuellen entspricht, Consent zurücksetzen
      if (this.appSettings.acceptedLegalVersion !== this.legalVersion) {
        this.appSettings = {
          ...this.appSettings,
          consentSettings: {
            ...this.appSettings.consentSettings,
            disclaimer: false,
            privacyPolicy: false,
            termsOfService: false,
            ageConfirmed: false
          },
          acceptedLegalVersion: undefined,
          legalVersion: this.legalVersion
        };
      }
    } catch {
      this.appSettings = { ...this.defaultAppSettings };
    }
    await this.syncPersistentStorageState();
    this.settingsReady = true;
    this.chekConsentCompleted();
    this._settingsSet.update(trigger => trigger + 1);
    this.setTheme(this.appSettings);
  }

  public chekConsentCompleted() {
    const consentsComplete = (
      this.appSettings?.consentSettings.disclaimer === true
      && this.appSettings?.consentSettings.privacyPolicy === true
      && this.appSettings?.consentSettings.termsOfService === true
      && this.appSettings?.consentSettings.ageConfirmed === true
    );

    const versionAccepted = this.appSettings?.acceptedLegalVersion === this.legalVersion;

    // Consent gilt nur, wenn alle Häkchen gesetzt und die aktuelle Version akzeptiert wurde
    this.consentCompleted = consentsComplete && versionAccepted;
  }

  // Notification-Daten
  public setNotificationAction(action: NotificationAction): void {
    this.notificationAction = action;
  }

  public getNotificationAction(): NotificationAction | undefined {
    return this.notificationAction;
  }

  setTheme(appSettings: AppSettings): void {
    const themeClass = Array.from(document.body.classList).find(cls => cls.startsWith('theme-'));
    if (themeClass) document.body.classList.remove(themeClass);
    document.body.classList.add(`theme-${appSettings.defaultTheme}`);

    const applyModeClass = (isDark: boolean) => {
      document.body.classList.remove('light', 'dark');
      document.body.classList.add(isDark ? 'dark' : 'light');
    };

    const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Nur entfernen, wenn vorhanden
    if (this.themeListener) {
      darkModeQuery.removeEventListener('change', this.themeListener);
      this.themeListener = null;
    }

    if (appSettings.themeMode === 'dark') {
      applyModeClass(true);
    } else if (appSettings.themeMode === 'light') {
      applyModeClass(false);
    } else {
      applyModeClass(darkModeQuery.matches);
      this.themeListener = (e: MediaQueryListEvent) => applyModeClass(e.matches);
      darkModeQuery.addEventListener('change', this.themeListener);
    }
  }

  /*this.swPush.notificationClicks.subscribe((result) => {
    if (result.notification.data.primaryKey.type === 'place') {
      this.showComponent = true;
      let location: Location = this.geolocationService.getLocationFromPlusCode(result.notification.data.primaryKey.id);
      if (!this.locationReady) {
        this.mapService.flyToWithZoom(location, 19);
      } else {
        this.mapService.flyTo(location);
      }
    }
    if (result.notification.data.primaryKey.type === 'contact') {
      this.openContactListDialog();
    }
  });*/

  public isStoragePersistenceSupported(): boolean {
    return this.storagePersistenceAvailable();
  }

  public async updateStoragePersistencePreference(enable: boolean): Promise<boolean> {
    const granted = enable ? await this.requestPersistentStorage() : false;
    const updatedSettings = { ...this.getAppSettings(), persistStorage: granted };
    await this.setAppSettings(updatedSettings);
    return granted;
  }

  public async requestStoragePersistence(): Promise<boolean> {
    return this.requestPersistentStorage();
  }

  private storagePersistenceAvailable(): boolean {
    return typeof navigator !== 'undefined'
      && !!navigator.storage
      && typeof navigator.storage.persist === 'function'
      && typeof navigator.storage.persisted === 'function';
  }

  private async syncPersistentStorageState(): Promise<void> {
    if (!this.appSettings || !this.storagePersistenceAvailable()) {
      if (this.appSettings) {
        this.appSettings = { ...this.appSettings, persistStorage: false };
      }
      return;
    }

    try {
      const persisted = await navigator.storage.persisted();
      this.appSettings = { ...this.appSettings, persistStorage: persisted };
    } catch {
      this.appSettings = { ...this.appSettings, persistStorage: false };
    }
  }

  private async requestPersistentStorage(): Promise<boolean> {
    if (!this.storagePersistenceAvailable()) {
      return false;
    }

    try {
      if (await navigator.storage.persisted()) {
        return true;
      }
      return await navigator.storage.persist();
    } catch {
      return false;
    }
  }
}
