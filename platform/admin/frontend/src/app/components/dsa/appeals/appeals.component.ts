import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';

import { DsaService } from '../../../services/dsa/dsa/dsa.service';
import { DsaAppeal } from '../../../interfaces/dsa-appeal.interface';
import { NoticeDetailComponent } from '../notice/notice-detail/notice-detail.component';
import { AppealResolutionDialogComponent, AppealResolutionData } from './appeal-resolution-dialog/appeal-resolution-dialog.component';
import { DsaNotice } from '../../../interfaces/dsa-notice.interface';

type AppealStatusFilter = 'open' | 'resolved' | 'all';

@Component({
  selector: 'app-appeals',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    MatProgressBarModule,
    MatChipsModule
  ],
  templateUrl: './appeals.component.html',
  styleUrls: ['./appeals.component.css']
})
export class AppealsComponent implements OnInit {
  private readonly dsa = inject(DsaService);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(false);
  readonly appeals = signal<DsaAppeal[]>([]);
  readonly statusFilter = signal<AppealStatusFilter>('open');
  readonly searchTerm = signal('');

  readonly filteredAppeals = computed(() => {
    const q = this.searchTerm().trim().toLowerCase();
    if (!q) return this.appeals();
    return this.appeals().filter(ap => {
      return [
        ap.noticeContentId,
        ap.noticeCategory,
        ap.filedBy,
        ap.arguments,
        ap.outcome,
        ap.decisionOutcome
      ].some(field => field ? field.toLowerCase().includes(q) : false);
    });
  });

  ngOnInit(): void {
    this.load();
    this.dsa.loadAppealStats();
  }

  setStatus(status: AppealStatusFilter): void {
    if (this.statusFilter() === status) return;
    this.statusFilter.set(status);
    this.load();
  }

  onSearch(value: string): void {
    this.searchTerm.set(value);
  }

  clearSearch(): void {
    this.searchTerm.set('');
  }

  load(): void {
    this.loading.set(true);
    this.dsa.listAppeals({ status: this.statusFilter() }).subscribe({
      next: (rows: DsaAppeal[]) => this.appeals.set(rows ?? []),
      error: () => this.snack.open('Could not load appeals.', 'OK', { duration: 3000 }),
      complete: () => this.loading.set(false)
    });
  }

  refresh(): void {
    this.load();
  }

  isOpen(appeal: DsaAppeal): boolean {
    return !appeal.resolvedAt;
  }

  openNotice(appeal: DsaAppeal): void {
    this.dsa.getNoticeById(appeal.noticeId).subscribe({
      next: (notice: DsaNotice) => {
        this.dialog.open(NoticeDetailComponent, {
          data: notice,
          width: 'auto',
          maxWidth: '96vw',
          maxHeight: '90vh',
          panelClass: 'md-dialog-rounded'
        });
      },
      error: () => this.snack.open('Could not load notice detail.', 'OK', { duration: 3000 })
    });
  }

  resolveAppeal(appeal: DsaAppeal): void {
    const ref = this.dialog.open(AppealResolutionDialogComponent, {
      width: 'min(420px, 95vw)',
      maxHeight: '90vh',
      autoFocus: false,
      data: {
        defaultOutcome: appeal.outcome ?? 'UPHELD',
        reviewer: appeal.reviewer || undefined
      }
    });

    ref.afterClosed().subscribe((result: AppealResolutionData | null) => {
      if (!result) return;
      this.dsa.resolveAppeal(appeal.id, result).subscribe({
        next: () => {
          this.snack.open('Appeal updated.', 'OK', { duration: 2000 });
          this.load();
          this.dsa.loadAppealStats();
        },
        error: () => this.snack.open('Could not update appeal.', 'OK', { duration: 3000 })
      });
    });
  }

  outcomeLabel(appeal: DsaAppeal): string {
    if (!appeal.outcome) return 'Pending';
    return appeal.outcome.replace(/_/g, ' ').toLowerCase();
  }

  trackById(_index: number, appeal: DsaAppeal) {
    return appeal.id;
  }
}
