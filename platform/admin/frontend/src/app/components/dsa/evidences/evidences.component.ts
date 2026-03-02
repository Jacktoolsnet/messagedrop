import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map, Subscription } from 'rxjs';

import { DsaNoticeFilters, DsaNoticeRange } from '../../../interfaces/dsa-notice-filters.interface';
import { DSA_NOTICE_STATUSES, DsaNoticeStatus } from '../../../interfaces/dsa-notice-status.type';
import { DsaNotice } from '../../../interfaces/dsa-notice.interface';
import { DsaService } from '../../../services/dsa/dsa/dsa.service';
import { EvidenceListComponent } from '../notice/evidence/evidence-list/evidence-list.component';
import { NoticeDetailComponent } from '../notice/notice-detail/notice-detail.component';

interface NoticeStatusMeta {
  label: string;
  icon: string;
  class: string;
}

@Component({
  selector: 'app-dsa-evidence',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    DatePipe,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatMenuModule,
    MatDividerModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatCardModule,
    EvidenceListComponent
  ],
  templateUrl: './evidences.component.html',
  styleUrl: './evidences.component.css'
})
export class EvidencesComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly dsa = inject(DsaService);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly statuses = DSA_NOTICE_STATUSES;

  readonly loading = signal(false);
  readonly notices = signal<DsaNotice[]>([]);
  readonly selectedNotice = signal<DsaNotice | null>(null);

  private readonly statusMeta: Record<DsaNoticeStatus, NoticeStatusMeta> = {
    RECEIVED: { label: 'Received', icon: 'mark_email_unread', class: 'status-received' },
    UNDER_REVIEW: { label: 'Under review', icon: 'manage_search', class: 'status-under-review' },
    DECIDED: { label: 'Decided', icon: 'gavel', class: 'status-decided' }
  };

  readonly filterForm = this.fb.nonNullable.group({
    status: this.fb.nonNullable.control<DsaNoticeStatus>('RECEIVED'),
    range: this.fb.nonNullable.control<DsaNoticeRange>('30d'),
    contentId: this.fb.control<string>(''),
    q: this.fb.control<string>(''),
  });

  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.load();

    const filterSub = this.filterForm.valueChanges
      .pipe(
        debounceTime(250),
        map(v => JSON.stringify(v)),
        distinctUntilChanged()
      )
      .subscribe(() => this.load());
    this.subs.push(filterSub);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  reload(): void {
    this.load();
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
    this.selectedNotice.set(notice);
  }

  isSelected(notice: DsaNotice): boolean {
    return this.selectedNotice()?.id === notice.id;
  }

  statusLabel(status: string): string {
    const meta = this.statusMeta[status as DsaNoticeStatus];
    return meta?.label ?? status;
  }

  statusIcon(status: string): string {
    const meta = this.statusMeta[status as DsaNoticeStatus];
    return meta?.icon ?? 'help';
  }

  statusClass(status: string): string {
    const meta = this.statusMeta[status as DsaNoticeStatus];
    return meta?.class ?? 'status-default';
  }

  // preview text removed from UI

  openNoticeDetail(n: DsaNotice, event?: Event): void {
    event?.stopPropagation();
    const ref = this.dialog.open(NoticeDetailComponent, {
      data: n,
      width: '96vw',
      minWidth: '96vw',
      maxHeight: '90vh',
      panelClass: 'md-dialog-rounded'
    });

    ref.afterClosed().subscribe(updated => {
      if (updated) {
        this.load();
      }
    });
  }

  private load(): void {
    this.loading.set(true);
    this.dsa.listNotices(this.toFilters()).subscribe({
      next: rows => {
        const data = rows ?? [];
        this.notices.set(data);
        this.syncSelection(data);
        this.loading.set(false);
      },
      error: () => {
        this.snack.open('Could not load notices.', 'OK', { duration: 3000 });
        this.notices.set([]);
        this.selectedNotice.set(null);
        this.loading.set(false);
      }
    });
  }

  private syncSelection(rows: DsaNotice[]): void {
    const current = this.selectedNotice();
    if (!current) {
      this.selectedNotice.set(null);
      return;
    }
    if (!rows.some(r => r.id === current.id)) {
      this.selectedNotice.set(null);
    }
  }

  private toFilters(): DsaNoticeFilters {
    const raw = this.filterForm.getRawValue();
    return {
      status: raw.status ? [raw.status] : undefined,
      contentId: raw.contentId?.trim() || undefined,
      q: raw.q?.trim() || undefined,
      range: raw.range || '30d',
      limit: 100,
      offset: 0,
      sort: 'updatedAt_desc' as const
    };
  }
}
