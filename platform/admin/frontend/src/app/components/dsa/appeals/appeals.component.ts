import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { RouterLink } from '@angular/router';

import { DsaAppeal } from '../../../interfaces/dsa-appeal.interface';
import { DsaNotice } from '../../../interfaces/dsa-notice.interface';
import { DsaService } from '../../../services/dsa/dsa/dsa.service';
import { AuthService } from '../../../services/auth/auth.service';
import { EvidenceListComponent } from '../notice/evidence/evidence-list/evidence-list.component';
import { DecisionSummaryComponent } from '../decisions/decision-summary/decision-summary.component';
import { NoticeAppealsComponent } from '../notice/appeals/notice-appeals.component';
import { AppealResolutionData, AppealResolutionDialogComponent } from './appeal-resolution-dialog/appeal-resolution-dialog.component';

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
    MatCardModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTooltipModule,
    MatDividerModule,
    EvidenceListComponent,
    DecisionSummaryComponent,
    NoticeAppealsComponent
  ],
  templateUrl: './appeals.component.html',
  styleUrls: ['./appeals.component.css']
})
export class AppealsComponent implements OnInit {
  private readonly dsa = inject(DsaService);
  private readonly snack = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly auth = inject(AuthService);

  readonly loading = signal(false);
  readonly appeals = signal<DsaAppeal[]>([]);
  readonly statusFilter = signal<AppealStatusFilter>('open');
  readonly selectedAppeal = signal<DsaAppeal | null>(null);
  readonly selectedNotice = signal<DsaNotice | null>(null);
  readonly rightLoading = signal(false);
  makingScreenshot = signal(false);

  // Parsed content of selected notice
  contentObj = signal<any | null>(null);

  ngOnInit(): void {
    this.load();
    this.dsa.loadAppealStats();
  }

  setStatus(status: AppealStatusFilter | null): void {
    if (!status) return;
    if (this.statusFilter() === status) return;
    this.statusFilter.set(status);
    this.load();
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

  selectAppeal(appeal: DsaAppeal): void {
    this.selectedAppeal.set(appeal);
    this.rightLoading.set(true);
    this.dsa.getNoticeById(appeal.noticeId).subscribe({
      next: (notice: DsaNotice) => {
        this.selectedNotice.set(notice);
        this.contentObj.set(this.safeParse(notice.reportedContent));
      },
      error: () => this.snack.open('Could not load notice detail.', 'OK', { duration: 3000 }),
      complete: () => this.rightLoading.set(false)
    });
  }

  resolveAppeal(appeal: DsaAppeal): void {
    const ref = this.dialog.open(AppealResolutionDialogComponent, {
      maxWidth: '95vw',
      maxHeight: '90vh',
      autoFocus: false,
      data: {
        defaultOutcome: appeal.outcome ?? 'UPHELD',
        reviewer: appeal.reviewer || this.auth.username() || undefined
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

  isSelected(a: DsaAppeal): boolean {
    return this.selectedAppeal()?.id === a.id;
  }

  // Helpers
  private safeParse(json: string | null | undefined): any {
    if (!json) return null;
    try { return JSON.parse(json); } catch { return null; }
  }

  hasExternalLink(): boolean {
    const n = this.selectedNotice();
    const c = this.contentObj();
    return !!(n?.contentUrl || c?.multimedia?.sourceUrl);
  }

  externalLink(): string | null {
    const n = this.selectedNotice();
    const c = this.contentObj();
    return n?.contentUrl || c?.multimedia?.sourceUrl || null;
  }

  addScreenshotEvidence(): void {
    const n = this.selectedNotice();
    const url = this.externalLink();
    if (!n || !url || this.makingScreenshot()) return;
    this.makingScreenshot.set(true);
    this.dsa.addEvidenceScreenshot(n.id, { url, fullPage: true, viewport: { width: 1280, height: 800 } })
      .subscribe({
        next: () => {
          this.makingScreenshot.set(false);
          this.snack.open('Screenshot added as evidence.', 'OK', { duration: 2000 });
        },
        error: () => this.makingScreenshot.set(false)
      });
  }
}
