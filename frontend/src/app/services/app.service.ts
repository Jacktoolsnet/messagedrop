import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NotificationAction } from '../interfaces/notification-action';
import { SharedContent } from '../interfaces/shared-content';

@Injectable({
  providedIn: 'root'
})
export class AppService {
  private sharedContent?: SharedContent;
  private notificationAction?: NotificationAction;
  private snackBarRef: any;

  constructor(private snackBar: MatSnackBar) { }

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
    this.snackBarRef = this.snackBar.open(`Shared content received: ${this.notificationAction.type}`, 'OK', {
      panelClass: ['snack-info'],
      horizontalPosition: 'center',
      verticalPosition: 'top',
      duration: 1000
    });
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
