import { Injectable } from '@angular/core';
import { NotificationAction } from '../interfaces/notification-action';

@Injectable({
  providedIn: 'root'
})
export class AppService {
  private notificationAction?: NotificationAction;

  constructor() { }

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

  setTheme(themeName: string): void {
    // alte theme-[x] Klassen entfernen
    const current = Array.from(document.body.classList).find(cls => cls.startsWith('theme-'));
    if (current) {
      document.body.classList.remove(current);
    }

    document.body.classList.add(`theme-${themeName}`);
    localStorage.setItem('theme', themeName);
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
