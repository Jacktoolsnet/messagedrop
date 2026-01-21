import { CommonModule } from '@angular/common';
import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialog, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { SystemNotification, SystemNotificationFilter } from '../../../interfaces/system-notification';
import { SystemNotificationService } from '../../../services/system-notification.service';
import { HelpDialogComponent, HelpDialogData } from '../../utils/help-dialog/help-dialog.component';
import { DeleteAllSystemNotificationComponent } from '../delete-all-system-notification/delete-all-system-notification.component';
import { DeleteSystemNotificationComponent } from '../delete-system-notification/delete-system-notification.component';

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
    MatTooltipModule,
    TranslocoPipe
  ],
  templateUrl: './system-message-dialog.component.html',
  styleUrl: './system-message-dialog.component.css'
})
export class SystemMessageDialogComponent implements OnInit {

  private readonly systemNotificationService = inject(SystemNotificationService);
  private readonly dialogRef = inject(MatDialogRef<SystemMessageDialogComponent>);
  private readonly dialog = inject(MatDialog);

  readonly notifications = this.systemNotificationService.getNotificationsSignal();
  readonly currentFilter = this.systemNotificationService.getFilterSignal();
  readonly loading = this.systemNotificationService.getLoadingSignal();

  readonly selectedNotification = signal<SystemNotification | null>(null);

  constructor() {
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

  async reloadNotifications(): Promise<void> {
    await this.systemNotificationService.loadNotifications(this.currentFilter());
  }

  async selectNotification(notification: SystemNotification, event?: Event): Promise<void> {
    event?.stopPropagation();
    this.selectedNotification.set(notification);
    if (notification.status === 'unread') {
      try {
        const updated = await this.systemNotificationService.markAsRead([notification.uuid]);
        if (updated?.length) {
          this.selectedNotification.set(updated[0]);
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
        if (this.selectedNotification()?.uuid === notification.uuid) {
          this.selectedNotification.set(updated[0]);
        }
      }
    } catch {
      // no-op: snackbar handled in service
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
        if (this.selectedNotification()?.uuid === notification.uuid) {
          this.selectedNotification.set(updated[0]);
        }
      }
    } catch {
      // no-op: snackbar handled in service
    }
  }

  async confirmDelete(notification: SystemNotification, event?: MouseEvent): Promise<void> {
    event?.stopPropagation();
    const dialogRef = this.dialog.open(DeleteSystemNotificationComponent, {
      width: '320px',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (confirmed) {
      await this.deleteNotification(notification);
    }
  }

  private async deleteNotification(notification: SystemNotification): Promise<void> {
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

  async confirmDeleteAll(event?: MouseEvent): Promise<void> {
    event?.stopPropagation();
    const dialogRef = this.dialog.open(DeleteAllSystemNotificationComponent, {
      width: '320px',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
    });

    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (confirmed) {
      await this.deleteAllNotification();
    }
  }

  private async deleteAllNotification(): Promise<void> {
    try {
      this.notifications().forEach(async (notif) => {
        const deleted = await this.systemNotificationService.deleteNotifications([notif.uuid]);
        if (deleted > 0) {
          const current = this.selectedNotification();
          if (current?.uuid === notif.uuid) {
            this.selectedNotification.set(null);
          }
        }
      });
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

  openHelp(): void {
    const data: HelpDialogData = {
      titleKey: 'systemMessages.title',
      introKey: 'systemMessages.intro',
      items: [
        {
          icon: 'notifications',
          titleKey: 'systemMessages.items.inbox.title',
          descriptionKey: 'systemMessages.items.inbox.desc'
        },
        {
          icon: 'filter_alt',
          titleKey: 'systemMessages.items.filters.title',
          descriptionKey: 'systemMessages.items.filters.desc'
        },
        {
          icon: 'info',
          titleKey: 'systemMessages.items.details.title',
          descriptionKey: 'systemMessages.items.details.desc'
        },
        {
          icon: 'mark_email_read',
          titleKey: 'systemMessages.items.actions.title',
          descriptionKey: 'systemMessages.items.actions.desc'
        },
        {
          icon: 'delete_sweep',
          titleKey: 'systemMessages.items.deleteAll.title',
          descriptionKey: 'systemMessages.items.deleteAll.desc'
        }
      ]
    };

    this.dialog.open(HelpDialogComponent, {
      data,
      minWidth: 'min(520px, 95vw)',
      maxWidth: '95vw',
      width: 'min(680px, 95vw)',
      maxHeight: '90vh',
      height: 'auto',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }
}
