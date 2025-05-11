import { Injectable } from '@angular/core';
import { NotificationAction } from '../interfaces/notification-action';
import { SharedContent } from '../interfaces/shared-content';

@Injectable({
  providedIn: 'root'
})
export class AppService {
  private sharedContent?: SharedContent;
  private notificationAction?: NotificationAction;

  constructor() { }

  public set(formData: FormData): void {
    this.sharedContent = {
      title: formData.get('title') as string,
      text: formData.get('text') as string,
      url: formData.get('url') as string
    };
  }

  public getSharedContent(): SharedContent | undefined {
    return this.sharedContent;
  }

  public clearSharedContent(): void {
    this.sharedContent = undefined;
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
