import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { NotificationCountResponse } from '../interfaces/notification-count-response';
import { NotificationListResponse } from '../interfaces/notification-list-response';
import { SystemNotification, SystemNotificationFilter } from '../interfaces/system-notification';
import { NetworkService } from './network.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class SystemNotificationService {
  private readonly notificationsSig = signal<SystemNotification[]>([]);
  private readonly filterSig = signal<SystemNotificationFilter>('unread');
  private readonly unreadCountSig = signal<number>(0);
  private readonly loadingSig = signal<boolean>(false);
  private readonly errorSig = signal<string | null>(null);

  private readonly httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-Authorization': `${environment.apiToken}`
    }),
    withCredentials: true
  };

  constructor(
    private readonly http: HttpClient,
    private readonly userService: UserService,
    private readonly networkService: NetworkService,
    private readonly snackBar: MatSnackBar
  ) { }

  getNotificationsSignal() {
    return this.notificationsSig.asReadonly();
  }

  getFilterSignal() {
    return this.filterSig.asReadonly();
  }

  getUnreadCountSignal() {
    return this.unreadCountSig.asReadonly();
  }

  getLoadingSignal() {
    return this.loadingSig.asReadonly();
  }

  getErrorSignal() {
    return this.errorSig.asReadonly();
  }

  getCurrentFilter(): SystemNotificationFilter {
    return this.filterSig();
  }

  reset(): void {
    this.notificationsSig.set([]);
    this.unreadCountSig.set(0);
    this.filterSig.set('unread');
    this.errorSig.set(null);
    this.loadingSig.set(false);
  }

  async loadNotifications(filter: SystemNotificationFilter = this.filterSig(), limit: number = 50, offset: number = 0): Promise<SystemNotification[]> {
    if (!this.userService.isReady()) {
      this.notificationsSig.set([]);
      return [];
    }

    const userId = this.userService.getUser().id;
    const url = `${environment.apiUrl}/notification/list/${userId}`;
    const params = new HttpParams()
      .set('status', filter)
      .set('limit', limit.toString())
      .set('offset', offset.toString());
    const options = { ...this.httpOptions, params };

    this.loadingSig.set(true);
    this.errorSig.set(null);

    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: 'System messages',
      image: '',
      icon: 'notifications',
      message: 'Loading system messages…',
      button: '',
      delay: 0,
      showSpinner: true
    });

    try {
      const response = await firstValueFrom(this.http.get<NotificationListResponse>(url, options));
      const notifications = response.rows ?? [];
      this.notificationsSig.set(notifications);
      this.filterSig.set(filter);
      return notifications;
    } catch (error) {
      const message = this.resolveErrorMessage(error);
      this.notificationsSig.set([]);
      this.errorSig.set('load_failed');
      this.snackBar.open(message, 'OK', { duration: 3000 });
      throw error;
    } finally {
      this.loadingSig.set(false);
    }
  }

  async markAsRead(uuids: string[]): Promise<SystemNotification[]> {
    if (!this.userService.isReady() || uuids.length === 0) {
      return [];
    }

    const url = `${environment.apiUrl}/notification/mark-read`;
    const options = { ...this.httpOptions };
    const body = { uuids };

    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: 'System messages',
      image: '',
      icon: 'notifications',
      message: 'Updating message status…',
      button: '',
      delay: 0,
      showSpinner: true
    });

    try {
      const response = await firstValueFrom(this.http.patch<NotificationListResponse>(url, body, options));
      const updated = response.rows ?? [];

      if (updated.length > 0) {
        const updatesMap = new Map(updated.map(item => [item.uuid, item]));
        const currentFilter = this.filterSig();

        this.notificationsSig.update(current => {
          const next = current.map(item => updatesMap.get(item.uuid) ?? item);
          if (currentFilter === 'unread') {
            return next.filter(item => item.status === 'unread');
          }
          return next;
        });
      }

      await this.refreshUnreadCount();
      return updated;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        await this.loadNotifications(this.filterSig());
        await this.refreshUnreadCount();
        return [];
      }
      const message = this.resolveErrorMessage(error);
      this.snackBar.open(message, 'OK', { duration: 3000 });
      throw error;
    }
  }

  async markAsUnread(uuids: string[]): Promise<SystemNotification[]> {
    if (!this.userService.isReady() || uuids.length === 0) {
      return [];
    }

    const url = `${environment.apiUrl}/notification/mark-unread`;
    const options = { ...this.httpOptions };
    const body = { uuids };

    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: 'System messages',
      image: '',
      icon: '',
      message: 'Updating message status…',
      button: '',
      delay: 0,
      showSpinner: true
    });

    try {
      const response = await firstValueFrom(this.http.patch<NotificationListResponse>(url, body, options));
      const updated = response.rows ?? [];

      if (updated.length > 0) {
        const updatesMap = new Map(updated.map(item => [item.uuid, item]));
        const currentFilter = this.filterSig();

        this.notificationsSig.update(current => {
          const next = current.map(item => updatesMap.get(item.uuid) ?? item);
          if (currentFilter === 'read') {
            return next.filter(item => item.status === 'read');
          }
          return next;
        });
      }

      await this.refreshUnreadCount();
      return updated;
    } catch (error) {
      const message = this.resolveErrorMessage(error);
      this.snackBar.open(message, 'OK', { duration: 3000 });
      throw error;
    }
  }

  async refreshUnreadCount(): Promise<number> {
    if (!this.userService.isReady()) {
      this.unreadCountSig.set(0);
      return 0;
    }

    const userId = this.userService.getUser().id;
    const url = `${environment.apiUrl}/notification/count/unread/${userId}`;

    try {
      const response = await firstValueFrom(this.http.get<NotificationCountResponse>(url, this.httpOptions));
      const total = typeof response.total === 'number' ? response.total : 0;
      this.unreadCountSig.set(total);
      return total;
    } catch (error) {
      // Avoid spamming the user with snackbars for background refreshes.
      console.error('Failed to refresh unread notification count', error);
      return this.unreadCountSig();
    }
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) {
        return 'Authorization required for system messages.';
      }
      return error.error?.error || 'Unable to process request for system messages.';
    }
    return 'Unexpected error while processing system messages.';
  }
}
