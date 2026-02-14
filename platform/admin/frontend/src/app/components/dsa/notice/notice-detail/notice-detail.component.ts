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
import { ReportedContentPayload, ReportedMultimedia } from '../../../../interfaces/reported-content.interface';

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
  mediaKind = signal<'iframe' | 'image' | 'none'>('none');
  embedUrl = signal<string | null>(null);
  imageUrl = signal<string | null>(null);

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
    this.updateMediaFromContent();
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

  hasExternalLink(): boolean {
    const c = this.contentObj();
    return !!this.toSafeHttpUrl(this.notice().contentUrl || c?.multimedia?.sourceUrl);
  }

  externalLink(): string | null {
    const c = this.contentObj();
    return this.toSafeHttpUrl(this.notice().contentUrl || c?.multimedia?.sourceUrl);
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

  private updateMediaFromContent(): void {
    const mm = this.contentObj()?.multimedia;
    this.embedUrl.set(null);
    this.imageUrl.set(null);
    this.mediaKind.set('none');

    const type = (mm?.type || '').toLowerCase();
    if (!type) return;

    if (type === 'youtube') {
      const id = this.getYouTubeId(mm);
      if (id) {
        this.embedUrl.set(`https://www.youtube.com/embed/${id}`);
        this.mediaKind.set('iframe');
      }
      return;
    }

    if (type === 'spotify') {
      const url = this.buildSpotifyEmbed(mm);
      if (url) {
        this.embedUrl.set(url);
        this.mediaKind.set('iframe');
      }
      return;
    }

    if (type === 'tiktok') {
      const id = this.getTikTokId(mm);
      if (id) {
        this.embedUrl.set(`https://www.tiktok.com/embed/v2/${id}`);
        this.mediaKind.set('iframe');
      }
      return;
    }

    if (type === 'tenor' || type === 'image') {
      const url = this.toSafeHttpUrl(mm?.url || mm?.sourceUrl);
      if (url) {
        this.imageUrl.set(url);
        this.mediaKind.set('image');
      }
    }
  }

  private isAllowedHost(host: string, allowedHosts: string[]): boolean {
    const normalized = host.toLowerCase();
    return allowedHosts.some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`));
  }

  private toSafeHttpUrl(value?: string | null): string | null {
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }
      return parsed.toString();
    } catch {
      return null;
    }
  }

  private sanitizeYoutubeId(value?: string | null): string | null {
    if (!value) return null;
    const cleaned = value.trim();
    return /^[a-zA-Z0-9_-]{6,20}$/.test(cleaned) ? cleaned : null;
  }

  private sanitizeTikTokId(value?: string | null): string | null {
    if (!value) return null;
    const cleaned = value.trim();
    return /^\d{6,32}$/.test(cleaned) ? cleaned : null;
  }

  private getYouTubeId(mm: ReportedMultimedia | null | undefined): string | null {
    const fromContent = this.sanitizeYoutubeId(String(mm?.contentId || '').split('?')[0]);
    if (fromContent) return fromContent;

    const sourceUrl = this.toSafeHttpUrl(mm?.sourceUrl || mm?.url);
    if (!sourceUrl) return null;

    try {
      const parsed = new URL(sourceUrl);
      if (!this.isAllowedHost(parsed.hostname, ['youtube.com', 'youtu.be'])) {
        return null;
      }
      if (this.isAllowedHost(parsed.hostname, ['youtu.be'])) {
        const id = parsed.pathname.split('/').filter(Boolean)[0];
        return this.sanitizeYoutubeId(id);
      }

      const queryId = parsed.searchParams.get('v');
      const safeQueryId = this.sanitizeYoutubeId(queryId);
      if (safeQueryId) return safeQueryId;

      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length >= 2 && (segments[0] === 'shorts' || segments[0] === 'embed')) {
        return this.sanitizeYoutubeId(segments[1]);
      }
    } catch {
      return null;
    }
    return null;
  }

  private buildSpotifyEmbed(mm: ReportedMultimedia | null | undefined): string | null {
    const allowedTypes = new Set(['track', 'album', 'playlist', 'episode', 'show']);

    const fromContent = typeof mm?.contentId === 'string' ? mm.contentId.trim().replace(/^\/+/, '') : '';
    if (fromContent) {
      const parts = fromContent.split('/').filter(Boolean);
      if (parts.length === 2 && allowedTypes.has(parts[0]) && /^[a-zA-Z0-9]+$/.test(parts[1])) {
        return `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`;
      }
    }

    const sourceUrl = this.toSafeHttpUrl(mm?.sourceUrl || mm?.url);
    if (!sourceUrl) return null;

    try {
      const parsed = new URL(sourceUrl);
      if (!this.isAllowedHost(parsed.hostname, ['open.spotify.com'])) {
        return null;
      }
      const segments = parsed.pathname.split('/').filter(Boolean);
      const startIndex = segments[0] === 'embed' ? 1 : 0;
      const type = segments[startIndex];
      const id = segments[startIndex + 1];
      if (!type || !id || !allowedTypes.has(type) || !/^[a-zA-Z0-9]+$/.test(id)) {
        return null;
      }
      return `https://open.spotify.com/embed/${type}/${id}`;
    } catch {
      return null;
    }
  }

  private getTikTokId(mm: ReportedMultimedia | null | undefined): string | null {
    const sourceUrl = this.toSafeHttpUrl(mm?.sourceUrl || mm?.url);
    if (sourceUrl) {
      try {
        const parsed = new URL(sourceUrl);
        if (this.isAllowedHost(parsed.hostname, ['tiktok.com', 'vm.tiktok.com'])) {
          const match = parsed.pathname.match(/\/@[^/]+\/video\/(\d+)/);
          const safeMatch = this.sanitizeTikTokId(match?.[1] || null);
          if (safeMatch) return safeMatch;
        }
      } catch {
        // ignore
      }
    }
    return this.sanitizeTikTokId(mm?.contentId || null);
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
