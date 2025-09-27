import { Injectable, signal } from '@angular/core';
import { AppSettings } from '../interfaces/app-settings';
import { ConsentKey } from '../interfaces/consent-settings.interface';
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

  private themeListener: ((e: MediaQueryListEvent) => void) | null = null;
  private appSettings: AppSettings | undefined;
  private notificationAction?: NotificationAction;

  constructor(
    private indexedDbService: IndexedDbService
  ) { }

  // Irgendwo oben im Service:
  private readonly defaultAppSettings: AppSettings = {
    defaultTheme: 'azure',
    themeMode: 'system',
    detectLocationOnStart: false,
    enableYoutubeContent: false,
    enablePinterestContent: false,
    enableSpotifyContent: false,
    enableTikTokContent: false,
    enableTenorContent: false,
    consentSettings: {
      disclaimer: false,
      privacyPolicy: false,
      termsOfService: false
    }
  };

  public isSettingsReady(): boolean {
    return this.settingsReady;
  }

  public isConsentCompleted(): boolean {
    return this.consentCompleted;
  }

  async setAppSettings(newAppSettings: AppSettings): Promise<void> {
    const merged = { ...this.defaultAppSettings, ...newAppSettings };
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
      const raw = await this.indexedDbService.getSetting('appSettings');
      const parsed = raw ? JSON.parse(raw) as Partial<AppSettings> : null;
      this.appSettings = { ...this.defaultAppSettings, ...(parsed ?? {}) };
    } catch {
      this.appSettings = { ...this.defaultAppSettings };
    }
    this.settingsReady = true;
    this.chekConsentCompleted();
    this._settingsSet.update(trigger => trigger + 1);
    this.setTheme(this.appSettings);
  }

  public chekConsentCompleted(required: ConsentKey[] = ['disclaimer']) {
    this.consentCompleted = required.some(k => this.appSettings?.consentSettings[k]);
  }

  // Notification-Daten
  public setNotificationAction(action: NotificationAction): void {
    this.notificationAction = action;
  }

  public getNotificationAction(): NotificationAction | undefined {
    return this.notificationAction;
  }

  public clearNotificationAction(): void {
    this.notificationAction = undefined;
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
}
