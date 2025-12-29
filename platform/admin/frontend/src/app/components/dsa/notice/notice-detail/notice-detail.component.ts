import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../../../environments/environment';
import { DsaNoticeStatus } from '../../../../interfaces/dsa-notice-status.type';
import { DsaNotice } from '../../../../interfaces/dsa-notice.interface';
import { DsaService } from '../../../../services/dsa/dsa/dsa.service';
import { DecisionDialogComponent, DecisionDialogResult, DecisionOutcome } from '../../decisions/decision-dialog/decision-dialog.component';
import { DecisionSummaryComponent } from '../../decisions/decision-summary/decision-summary.component';
import { NoticeAppealsComponent } from '../appeals/notice-appeals.component';
import { EvidenceListComponent } from "../evidence/evidence-list/evidence-list.component";
import { ReportedContentPayload } from '../../../../interfaces/reported-content.interface';

// Optional: wenn du die vorhandene PublicMessageDetailComponent nutzen willst
// import { PublicMessageDetailComponent } from '../../../shared/public-message-detail/public-message-detail.component';

interface TranslationState {
  text?: string;
  translated?: string;
  loading: boolean;
  error?: string;
}

@Component({
  selector: 'app-notice-detail-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatDividerModule,
    EvidenceListComponent,
    DecisionSummaryComponent,
    NoticeAppealsComponent
  ],
  templateUrl: './notice-detail.component.html',
  styleUrls: ['./notice-detail.component.css']
})
export class NoticeDetailComponent implements OnInit {
  private ref = inject(MatDialogRef<NoticeDetailComponent, boolean>);
  private data = inject<DsaNotice>(MAT_DIALOG_DATA);
  private dsa = inject(DsaService);
  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  makingScreenshot = signal(false);
  private dirty = false;

  @ViewChild('evidenceList')
  private evidenceList?: EvidenceListComponent;

  @ViewChild('decisionSummary')
  private decisionSummary?: DecisionSummaryComponent;

  notice = signal<DsaNotice>(this.data);
  status = signal<DsaNoticeStatus>(this.data.status as DsaNoticeStatus);
  private autoStatusApplied = false;

  // reportedContent kommt aus der DB als JSON-String → parsen
  contentObj = computed<ReportedContentPayload | null>(() => {
    const payload = this.notice()?.reportedContent;
    if (!payload) {
      return null;
    }
    try {
      const parsed = JSON.parse(payload) as unknown;
      return parsed && typeof parsed === 'object' ? parsed as ReportedContentPayload : null;
    } catch {
      return null;
    }
  });

  // Übersetzungszustände
  reasonI18n = signal<TranslationState>({ text: this.data.reasonText || '', loading: false });
  messageI18n = signal<TranslationState>({
    text: this.contentObj()?.message || '',
    loading: false
  });

  // Hilfen
  isPublicMessage = computed(() => (this.notice()?.reportedContentType || '').toLowerCase().includes('public'));
  hasModeration = computed(() => {
    const c = this.contentObj();
    if (!c) return false;
    return [
      c.aiModerationDecision,
      c.aiModerationScore,
      c.aiModerationFlagged,
      c.aiModerationAt,
      c.patternMatch,
      c.patternMatchAt,
      c.manualModerationDecision,
      c.manualModerationReason,
      c.manualModerationAt,
      c.manualModerationBy
    ].some(value => value !== undefined && value !== null && value !== '');
  });

  close(ok = false) {
    this.ref.close(ok || this.dirty);
  }

  openStatusPage(): void {
    const id = this.notice().id;
    this.dsa.getNoticeStatusUrl(id).subscribe({
      next: (res) => {
        if (res?.statusUrl) window.open(res.statusUrl, '_blank', 'noopener');
      }
    });
  }

  openAddEvidence(): void {
    this.evidenceList?.openAdd();
  }

  openDecisionDialog(): void {
    const ref = this.dialog.open<DecisionDialogComponent, { noticeId: string }, DecisionDialogResult | false>(DecisionDialogComponent, {
      data: { noticeId: this.notice().id },
      width: 'min(700px, 96vw)',
      maxHeight: '90vh',
      panelClass: 'md-dialog-rounded'
    });

    ref.afterClosed().subscribe((result) => {
      if (!result || !result.saved) return;

      const outcome = result.outcome;

      this.status.set('DECIDED');
      this.notice.update(n => n ? ({ ...n, status: 'DECIDED', updatedAt: Date.now() }) : n);
      this.decisionSummary?.refresh();
      this.syncContentVisibility(outcome);
      this.dirty = true;
    });
  }

  private syncContentVisibility(outcome: DecisionOutcome): void {
    const contentId = this.notice().contentId;
    if (!contentId) return;

    const visible = outcome === 'NO_ACTION';
    this.dsa.setPublicMessageVisibility(contentId, visible).subscribe({
      error: () => {
        this.snack.open('Could not update public visibility.', 'OK', { duration: 3000 });
      }
    });
  }

  ngOnInit(): void {
    this.ensureUnderReview();
  }

  /** Übersetzung via Admin-Backend (/translate/DE/:value) */
  translateToGerman(kind: 'reason' | 'message') {
    const state = kind === 'reason' ? this.reasonI18n : this.messageI18n;
    const text = state().text?.trim();
    if (!text) return;

    state.update(s => ({ ...s, loading: true, error: undefined }));
    const url = `${environment.apiUrl}/translate/DE/${encodeURIComponent(text)}`;

    this.http.get<{ status: number; result?: { text: string }, error?: string }>(url)
      .subscribe({
        next: (res) => {
          if (res.status === 200 && res.result?.text) {
            state.update(s => ({ ...s, translated: res.result!.text, loading: false }));
          } else {
            state.update(s => ({ ...s, error: res.error || 'Translation failed', loading: false }));
          }
        },
        error: () => {
          state.update(s => ({ ...s, error: 'Network error while translating', loading: false }));
        }
      });
  }

  formatScore(value?: number | null): string {
    return Number.isFinite(value) ? Number(value).toFixed(3) : '—';
  }

  formatBool(value?: boolean | number | null): string {
    if (value === undefined || value === null) return '—';
    return value === true || value === 1 ? 'Yes' : 'No';
  }

  formatTimestamp(value?: number | null): string {
    if (!Number.isFinite(value)) return '—';
    const ts = Number(value);
    try {
      return new Date(ts).toLocaleString(navigator.language || undefined);
    } catch {
      return new Date(ts).toISOString();
    }
  }

  /** kleine Embed-Helfer */
  youtubeEmbedHtml(): string | null {
    const c = this.contentObj();
    const id = c?.multimedia?.contentId;
    if (!c || c?.multimedia?.type !== 'youtube' || !id) return null;
    const safeId = String(id).replace(/^.*v=/, '').replace(/^shorts\//, '');
    return `<iframe width="560" height="315"
            src="https://www.youtube.com/embed/${safeId}"
            frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  }

  tenorGifUrl(): string | null {
    const c = this.contentObj();
    return c?.multimedia?.type === 'tenor' ? (c?.multimedia?.url || null) : null;
  }

  hasExternalLink(): boolean {
    const c = this.contentObj();
    return !!(this.notice().contentUrl || c?.multimedia?.sourceUrl);
  }

  externalLink(): string | null {
    const c = this.contentObj();
    return this.notice().contentUrl || c?.multimedia?.sourceUrl || null;
  }

  addScreenshotEvidence(): void {
    const url = this.externalLink();
    if (!url || this.makingScreenshot()) return;
    this.makingScreenshot.set(true);
    this.dsa.addEvidenceScreenshot(this.notice().id, { url, fullPage: true, viewport: { width: 1280, height: 800 } })
      .subscribe({
        next: () => {
          this.makingScreenshot.set(false);
          this.evidenceList?.load();
          this.snack.open('Screenshot added as evidence.', 'OK', { duration: 2500 });
        },
        error: () => this.makingScreenshot.set(false)
      });
  }

  private ensureUnderReview(): void {
    const current = this.notice();
    if (!current || this.autoStatusApplied) return;

    if ((current.status || '').toUpperCase() === 'RECEIVED') {
      this.autoStatusApplied = true;
      this.dsa.patchNoticeStatus(current.id, 'UNDER_REVIEW').subscribe({
        next: () => {
          this.status.set('UNDER_REVIEW');
          this.notice.update(n => ({ ...n, status: 'UNDER_REVIEW', updatedAt: Date.now() }));
          this.dirty = true;
        },
        error: () => {
          this.autoStatusApplied = false;
        }
      });
    }
  }
}
