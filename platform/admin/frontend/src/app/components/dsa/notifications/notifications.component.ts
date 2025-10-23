import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { Subscription, debounceTime, distinctUntilChanged, map } from 'rxjs';

import { DsaNotification } from '../../../interfaces/dsa-notification.interface';
import { DsaNotice } from '../../../interfaces/dsa-notice.interface';
import { DsaNoticeFilters, DsaNoticeRange } from '../../../interfaces/dsa-notice-filters.interface';
import { DSA_NOTICE_STATUSES, DsaNoticeStatus } from '../../../interfaces/dsa-notice-status.type';
import { DsaService } from '../../../services/dsa/dsa/dsa.service';
import { NoticeDetailComponent } from '../notice/notice-detail/notice-detail.component';
import { NotificationDialogComponent } from './notification-dialog/notification-dialog.component';

type NoticeStatusMeta = {
  label: string;
  icon: string;
  class: string;
};

@Component({
  selector: 'app-dsa-notifications',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatCardModule,
    MatChipsModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule,
    MatButtonToggleModule
  ],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly dsa = inject(DsaService);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly statuses = DSA_NOTICE_STATUSES;

  readonly loading = signal(false);
  readonly notificationsLoading = signal(false);
  readonly notices = signal<DsaNotice[]>([]);
  readonly selectedNotice = signal<DsaNotice | null>(null);
  readonly notifications = signal<DsaNotification[]>([]);

  readonly emptyNotices = computed(() => !this.loading() && this.notices().length === 0);
  readonly emptyNotifications = computed(() => !this.notificationsLoading() && this.notifications().length === 0);

  readonly filterForm = this.fb.nonNullable.group({
    status: this.fb.nonNullable.control<DsaNoticeStatus>('RECEIVED'),
    range: this.fb.nonNullable.control<DsaNoticeRange>('30d'),
    contentId: this.fb.control<string>(''),
    q: this.fb.control<string>('')
  });

  private readonly statusMeta: Record<DsaNoticeStatus, NoticeStatusMeta> = {
    RECEIVED: { label: 'Received', icon: 'mark_email_unread', class: 'status-received' },
    UNDER_REVIEW: { label: 'Under review', icon: 'manage_search', class: 'status-under-review' },
    DECIDED: { label: 'Decided', icon: 'gavel', class: 'status-decided' }
  } as const;

  private subs: Subscription[] = [];
  private notificationSub: Subscription | null = null;
  private lastFetchedNoticeId: string | null = null;

  ngOnInit(): void {
    this.loadNotices();

    const filterSub = this.filterForm.valueChanges
      .pipe(
        debounceTime(250),
        map(v => JSON.stringify(v)),
        distinctUntilChanged()
      )
      .subscribe(() => this.loadNotices());
    this.subs.push(filterSub);
  }

  ngOnDestroy(): void {
    this.subs.forEach(sub => sub.unsubscribe());
  }

  reload(): void {
    this.loadNotices();
  }

  statusFilter(): DsaNoticeStatus {
    return this.filterForm.controls.status.value;
  }

  setStatus(status: DsaNoticeStatus | null): void {
    if (!status) return;
    const control = this.filterForm.controls.status;
    if (control.value === status) return;
    control.setValue(status);
  }

  selectNotice(notice: DsaNotice): void {
    if (this.selectedNotice()?.id === notice.id) return;
    this.selectedNotice.set(notice);
    this.fetchNotifications(notice.id);
  }

  isSelected(notice: DsaNotice): boolean {
    return this.selectedNotice()?.id === notice.id;
  }

  statusLabel(status: string): string {
    return this.statusMeta[status as DsaNoticeStatus]?.label ?? status;
  }

  statusIcon(status: string): string {
    return this.statusMeta[status as DsaNoticeStatus]?.icon ?? 'help';
  }

  statusClass(status: string): string {
    return this.statusMeta[status as DsaNoticeStatus]?.class ?? 'status-default';
  }

  noticePreview(notice: DsaNotice): string {
    const parsed = this.safeParse(notice.reportedContent);
    const candidates = [
      parsed?.message,
      parsed?.multimedia?.title,
      parsed?.multimedia?.description,
      notice.reasonText
    ].map(v => (typeof v === 'string' ? v.trim() : ''));
    return candidates.find(c => !!c) || 'No additional context available.';
  }

  channelIcon(notification: DsaNotification | null | undefined): string {
    const channel = (notification?.channel || '').toLowerCase();
    switch (channel) {
      case 'email':
        return 'alternate_email';
      case 'webhook':
        return 'swap_calls';
      case 'inapp':
        return 'mobile_friendly';
      default:
        return 'notifications';
    }
  }

  eventLabel(notification: DsaNotification): string {
    return notification.meta?.event || notification.payload?.event || '—';
  }

  statusColor(notification: DsaNotification): 'warn' | 'accent' | 'primary' {
    return notification.meta?.success === false ? 'warn' : 'accent';
  }

  copyPayload(notification: DsaNotification): void {
    const json = JSON.stringify(notification.payload ?? {}, null, 2);
    navigator.clipboard?.writeText(json).then(
      () => this.snack.open('Payload copied to clipboard.', 'OK', { duration: 2000 }),
      () => this.snack.open('Could not copy payload.', 'OK', { duration: 2000 })
    );
  }

  isEmail(notification: DsaNotification): boolean {
    return notification.channel.toLowerCase() === 'email';
  }

  resend(notification: DsaNotification): void {
    const sub = this.dsa.resendNotification(notification.id).subscribe({
      next: resp => {
        const msg = resp?.success ? 'Notification resent.' : 'Resend attempt finished with warnings.';
        this.snack.open(msg, 'OK', { duration: 2500 });
        const current = this.selectedNotice();
        if (current) {
          this.fetchNotifications(current.id);
        }
      },
      error: () => { }
    });
    this.subs.push(sub);
  }

  openNoticeDetail(notice: DsaNotice, event?: Event): void {
    event?.stopPropagation();
    this.dialog.open(NoticeDetailComponent, {
      data: notice,
      width: '96vw',
      minWidth: '96vw',
      maxHeight: '90vh',
      panelClass: 'md-dialog-rounded'
    });
  }

  openNewNotificationDialog(notice: DsaNotice): void {
    const ref = this.dialog.open(NotificationDialogComponent, {
      width: '520px',
      data: {
        notice
      },
      autoFocus: false,
      disableClose: true,
      panelClass: 'md-dialog-rounded'
    });

    ref.afterClosed().subscribe((result: { stakeholder: string; channel: string; payload: any } | undefined) => {
      if (!result) return;
      const payload = {
        ...result.payload,
        event: result.payload?.event || null
      };
      this.notificationsLoading.set(true);
      this.dsa.createNotification({
        noticeId: notice.id,
        stakeholder: result.stakeholder,
        channel: result.channel,
        payload
      }).subscribe({
        next: () => {
          this.snack.open('Notification queued.', 'OK', { duration: 2000 });
          this.fetchNotifications(notice.id, true);
        },
        error: () => {
          this.notificationsLoading.set(false);
          this.snack.open('Could not create notification.', 'OK', { duration: 3000 });
        }
      });
    });
  }

  trackNotice(_index: number, notice: DsaNotice): string {
    return notice.id;
  }

  trackNotification(_index: number, notification: DsaNotification): string {
    return notification.id;
  }

  private loadNotices(): void {
    this.loading.set(true);
    this.dsa.listNotices(this.toFilters()).subscribe({
      next: rows => {
        const data = rows ?? [];
        this.notices.set(data);
        this.syncSelection(data);
        this.loading.set(false);
        const active = this.selectedNotice();
        if (active) {
          this.fetchNotifications(active.id, true);
        } else {
          this.lastFetchedNoticeId = null;
          this.notifications.set([]);
        }
      },
      error: () => {
        this.snack.open('Could not load notices.', 'OK', { duration: 3000 });
        this.notices.set([]);
        this.selectedNotice.set(null);
        this.lastFetchedNoticeId = null;
        this.loading.set(false);
        this.notifications.set([]);
      }
    });
  }

  private fetchNotifications(noticeId: string, force = false): void {
    if (!force && this.lastFetchedNoticeId === noticeId && !this.notificationsLoading()) {
      return;
    }
    this.lastFetchedNoticeId = noticeId;
    if (this.notificationSub) {
      this.notificationSub.unsubscribe();
      this.notificationSub = null;
    }
    this.notificationsLoading.set(true);
    this.notificationSub = this.dsa.listNotifications({ noticeId, limit: 200, offset: 0 }).subscribe({
      next: rows => {
        this.notifications.set(rows ?? []);
        this.notificationsLoading.set(false);
      },
      error: () => {
        this.notifications.set([]);
        this.notificationsLoading.set(false);
        this.lastFetchedNoticeId = null;
        this.snack.open('Could not load notifications for this notice.', 'OK', { duration: 3000 });
      }
    });
    this.subs.push(this.notificationSub);
  }

  private syncSelection(rows: DsaNotice[]): void {
    const current = this.selectedNotice();
    if (!current) {
      this.notifications.set([]);
      return;
    }
    if (rows.some(row => row.id === current.id)) {
      return;
    }
    this.selectedNotice.set(null);
    this.notifications.set([]);
  }

  private toFilters(): DsaNoticeFilters {
    const raw = this.filterForm.getRawValue();
    return {
      status: raw.status ? [raw.status] : undefined,
      range: raw.range || '30d',
      contentId: raw.contentId?.trim() || undefined,
      q: raw.q?.trim() || undefined,
      limit: 100,
      offset: 0,
      sort: 'updatedAt_desc'
    };
  }

  private safeParse(json: string | null | undefined): any {
    if (!json) return null;
    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }
}
