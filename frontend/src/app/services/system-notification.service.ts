import { HttpClient, HttpErrorResponse, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { NotificationCountResponse } from '../interfaces/notification-count-response';
import { NotificationListResponse } from '../interfaces/notification-list-response';
import { SystemNotification, SystemNotificationFilter } from '../interfaces/system-notification';
import { NetworkService } from './network.service';
import { TranslationHelperService } from './translation-helper.service';
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
    }),
    withCredentials: true
  };

  private readonly http = inject(HttpClient);
  private readonly userService = inject(UserService);
  private readonly networkService = inject(NetworkService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly i18n = inject(TranslationHelperService);

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

  reset(): void {
    this.notificationsSig.set([]);
    this.unreadCountSig.set(0);
    this.filterSig.set('unread');
    this.errorSig.set(null);
    this.loadingSig.set(false);
  }

  async loadNotifications(filter: SystemNotificationFilter = this.filterSig(), limit = 50, offset = 0): Promise<SystemNotification[]> {
    if (!this.userService.hasJwt()) {
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
      title: this.i18n.t('common.systemMessages.title'),
      image: '',
      icon: 'notifications',
      message: this.i18n.t('common.systemMessages.loading'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
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
      this.snackBar.open(message, this.i18n.t('common.actions.ok'), { duration: 3000 });
      throw error;
    } finally {
      this.loadingSig.set(false);
    }
  }

  async markAsRead(uuids: string[]): Promise<SystemNotification[]> {
    if (!this.userService.hasJwt() || uuids.length === 0) {
      return [];
    }

    const url = `${environment.apiUrl}/notification/mark`;
    const options = { ...this.httpOptions };
    const body = { uuids, status: 'read' };

    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: this.i18n.t('common.systemMessages.title'),
      image: '',
      icon: 'notifications',
      message: this.i18n.t('common.systemMessages.updatingStatus'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
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
      this.snackBar.open(message, this.i18n.t('common.actions.ok'), { duration: 3000 });
      throw error;
    }
  }

  async markAsUnread(uuids: string[]): Promise<SystemNotification[]> {
    if (!this.userService.hasJwt() || uuids.length === 0) {
      return [];
    }

    const url = `${environment.apiUrl}/notification/mark`;
    const options = { ...this.httpOptions };
    const body = { uuids, status: 'unread' };

    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: this.i18n.t('common.systemMessages.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.systemMessages.updatingStatus'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
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
      this.snackBar.open(message, this.i18n.t('common.actions.ok'), { duration: 3000 });
      throw error;
    }
  }

  async deleteNotifications(uuids: string[]): Promise<number> {
    if (!this.userService.hasJwt() || uuids.length === 0) {
      return 0;
    }

    const url = `${environment.apiUrl}/notification/delete`;
    const options = { ...this.httpOptions };
    const body = { uuids };

    this.networkService.setNetworkMessageConfig(url, {
      showAlways: false,
      title: this.i18n.t('common.systemMessages.title'),
      image: '',
      icon: 'delete',
      message: this.i18n.t('common.systemMessages.removing'),
      button: '',
      delay: 0,
      showSpinner: true,
      autoclose: false
    });

    try {
      const response = await firstValueFrom(this.http.delete<{ status: number; deleted: number }>(url, { ...options, body }));
      const deleted = response.deleted ?? 0;

      if (deleted > 0) {
        this.notificationsSig.update(current => current.filter(item => !uuids.includes(item.uuid)));
        await this.refreshUnreadCount();
      }

      return deleted;
    } catch (error) {
      const message = this.resolveErrorMessage(error);
      this.snackBar.open(message, this.i18n.t('common.actions.ok'), { duration: 3000 });
      throw error;
    }
  }

  async refreshUnreadCount(): Promise<number> {
    if (!this.userService.hasJwt()) {
      this.unreadCountSig.set(0);
      return 0;
    }

    const userId = this.userService.getUser().id;
    const url = `${environment.apiUrl}/notification/count/unread/${userId}`;

    try {
      const response = await firstValueFrom(this.http.get<NotificationCountResponse>(url, this.httpOptions));
      const total = Number(response.total ?? 0);
      const safeTotal = Number.isFinite(total) ? total : 0;
      this.unreadCountSig.set(safeTotal);
      return safeTotal;
    } catch (error) {
      // Avoid spamming the user with snackbars for background refreshes.
      console.error('Failed to refresh unread notification count', error);
      return this.unreadCountSig();
    }
  }

  private resolveErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 403) {
        return this.i18n.t('errors.systemMessages.authRequired');
      }
      return error.error?.error || this.i18n.t('errors.systemMessages.requestFailed');
    }
    return this.i18n.t('errors.systemMessages.unexpected');
  }
}
