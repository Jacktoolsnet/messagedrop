import { CommonModule } from '@angular/common';
import { Component, effect, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SystemNotification, SystemNotificationFilter } from '../../../interfaces/system-notification';
import { SystemNotificationService } from '../../../services/system-notification.service';

@Component({
  selector: 'app-system-message-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatIconModule,
    MatListModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  templateUrl: './system-message-dialog.component.html',
  styleUrl: './system-message-dialog.component.css'
})
export class SystemMessageDialogComponent implements OnInit {

  readonly notifications = this.systemNotificationService.getNotificationsSignal();
  readonly currentFilter = this.systemNotificationService.getFilterSignal();
  readonly loading = this.systemNotificationService.getLoadingSignal();

  readonly selectedNotification = signal<SystemNotification | null>(null);

  constructor(
    private readonly systemNotificationService: SystemNotificationService,
    private readonly dialogRef: MatDialogRef<SystemMessageDialogComponent>
  ) {
    effect(() => {
      const items = this.notifications();
      const current = this.selectedNotification();

      if (!items || items.length === 0 || !current) {
        return;
      }

      const updated = items.find(item => item.uuid === current.uuid);
      if (updated && updated !== current) {
        this.selectedNotification.set(updated);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    await this.systemNotificationService.loadNotifications(this.currentFilter());
  }

  trackByUuid(_index: number, item: SystemNotification) {
    return item.uuid;
  }

  async handleFilterChange(event: MatButtonToggleChange): Promise<void> {
    const nextFilter = event.value as SystemNotificationFilter;
    if (nextFilter === this.currentFilter()) {
      return;
    }
    this.selectedNotification.set(null);
    await this.systemNotificationService.loadNotifications(nextFilter);
  }

  async selectNotification(notification: SystemNotification): Promise<void> {
    this.selectedNotification.set(notification);
    if (notification.status === 'unread') {
      try {
        const updated = await this.systemNotificationService.markAsRead([notification.uuid]);
        if (updated?.length) {
          this.selectedNotification.set(updated[0]);
        } else {
          this.selectedNotification.set({ ...notification, status: 'read' });
        }
      } catch {
        this.selectedNotification.set(notification);
      }
    }
  }

  async markNotificationAsRead(notification: SystemNotification, event?: MouseEvent): Promise<void> {
    event?.stopPropagation();
    if (notification.status !== 'unread') {
      return;
    }
    try {
      const updated = await this.systemNotificationService.markAsRead([notification.uuid]);
      if (updated?.length) {
        this.selectedNotification.set(updated[0]);
      } else {
        this.selectedNotification.set({ ...notification, status: 'read' });
      }
    } catch {
      this.selectedNotification.set(notification);
    }
  }

  async markNotificationAsUnread(notification: SystemNotification, event?: MouseEvent): Promise<void> {
    event?.stopPropagation();
    if (notification.status === 'unread') {
      return;
    }
    try {
      const updated = await this.systemNotificationService.markAsUnread([notification.uuid]);
      if (updated?.length) {
        this.selectedNotification.set(updated[0]);
      } else {
        this.selectedNotification.set({ ...notification, status: 'unread' });
      }
    } catch {
      this.selectedNotification.set(notification);
    }
  }

  async deleteNotification(notification: SystemNotification, event?: MouseEvent): Promise<void> {
    event?.stopPropagation();
    const uuid = notification.uuid;
    try {
      const deleted = await this.systemNotificationService.deleteNotifications([uuid]);
      if (deleted > 0) {
        const current = this.selectedNotification();
        if (current?.uuid === uuid) {
          this.selectedNotification.set(null);
        }
      }
    } catch {
      // error already surfaced via snackbar
    }
  }

  openStatusLink(url?: string | null, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!url) {
      return;
    }
    window.open(url, '_blank', 'noopener');
  }

  backToList(): void {
    this.selectedNotification.set(null);
  }

  close(): void {
    this.dialogRef.close();
  }
}
