import { Injectable } from '@angular/core';
import { AppSettings } from '../interfaces/app-settings';
import { NotificationAction } from '../interfaces/notification-action';
import { IndexedDbService } from './indexed-db.service';

@Injectable({
  providedIn: 'root'
})
export class AppService {
  private themeListener: ((e: MediaQueryListEvent) => void) | null = null;
  private appSettings: AppSettings = { defaultTheme: 'azure', themeMode: 'system' };
  private notificationAction?: NotificationAction;

  constructor(
    private indexedDbService: IndexedDbService
  ) { }

  public setAppSettings(newAppSettings: AppSettings): void {
    this.indexedDbService.setSetting('appSettings', JSON.stringify(newAppSettings)).then(() => {
      this.appSettings = newAppSettings;
      this.setTheme(this.appSettings);
    });
  }

  public getAppSettings(): AppSettings {
    if (!this.appSettings) {
      this.appSettings = { defaultTheme: 'azure', themeMode: 'system' };
    }
    return this.appSettings;
  }

  async loadAppSettings(): Promise<void> {
    try {
      const settings = JSON.parse(await this.indexedDbService.getSetting('appSettings'));
      if (settings) {
        this.appSettings = settings;
      } else {
        this.appSettings = { defaultTheme: 'azure', themeMode: 'system' };
      }
    } catch (error) {
      this.appSettings = { defaultTheme: 'azure', themeMode: 'system' };
    }
    this.setTheme(this.appSettings);
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
