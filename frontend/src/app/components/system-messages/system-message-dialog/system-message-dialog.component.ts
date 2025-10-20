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

      if (!items || items.length === 0) {
        if (current !== null) {
          this.selectedNotification.set(null);
        }
        return;
      }

      if (current === null) {
        this.selectedNotification.set(items[0] ?? null);
        return;
      }

      const updated = items.find(item => item.uuid === current.uuid);
      if (updated) {
        this.selectedNotification.set(updated);
      } else {
        this.selectedNotification.set(items[0] ?? null);
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
      await this.systemNotificationService.markAsRead([notification.uuid]);
    }
  }

  async markNotificationAsRead(notification: SystemNotification, event?: MouseEvent): Promise<void> {
    event?.stopPropagation();
    if (notification.status !== 'unread') {
      return;
    }
    await this.systemNotificationService.markAsRead([notification.uuid]);
  }

  async markCurrentAsRead(): Promise<void> {
    const current = this.selectedNotification();
    if (!current || current.status !== 'unread') {
      return;
    }
    await this.systemNotificationService.markAsRead([current.uuid]);
  }

  openStatusLink(url?: string | null, event?: MouseEvent): void {
    event?.stopPropagation();
    if (!url) {
      return;
    }
    window.open(url, '_blank', 'noopener');
  }

  close(): void {
    this.dialogRef.close();
  }
}
