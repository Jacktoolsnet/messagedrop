import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../../../environments/environment';
import { USER_ACCOUNT_BLOCK_REASONS, USER_POSTING_BLOCK_REASONS, findModerationReasonLabel } from '../../../../constants/user-moderation-reasons';
import { DsaNoticeStatus } from '../../../../interfaces/dsa-notice-status.type';
import { DsaNotice } from '../../../../interfaces/dsa-notice.interface';
import { PlatformUserModeration, PlatformUserSummary } from '../../../../interfaces/platform-user-moderation.interface';
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
    MatMenuModule,
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
  platformUserId = computed(() => {
    const id = this.contentObj()?.userId;
    const value = typeof id === 'string' ? id.trim() : '';
    return value || null;
  });
  moderationState = signal<PlatformUserModeration | null>(null);
  moderationSummary = signal<PlatformUserSummary | null>(null);
  moderationBusy = signal(false);
  blockedUntilLocal = signal<string>('');
  readonly postingReasonOptions = USER_POSTING_BLOCK_REASONS;
  readonly accountReasonOptions = USER_ACCOUNT_BLOCK_REASONS;
  readonly postingReason = signal(USER_POSTING_BLOCK_REASONS[0]?.code ?? '');
  readonly accountReason = signal(USER_ACCOUNT_BLOCK_REASONS[0]?.code ?? '');

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
    const userId = this.platformUserId();
    if (userId) {
      this.loadPlatformUserModeration(userId);
    }
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

  loadPlatformUserModeration(userId: string) {
    this.moderationBusy.set(true);
    this.dsa.getPlatformUserModeration(userId).subscribe({
      next: (res) => {
        this.moderationState.set(res?.moderation ?? null);
        this.moderationSummary.set(res?.summary ?? null);
        const postingUntil = this.toLocalDateTimeValue(res?.moderation?.posting?.blockedUntil ?? null);
        const accountUntil = this.toLocalDateTimeValue(res?.moderation?.account?.blockedUntil ?? null);
        this.blockedUntilLocal.set(postingUntil || accountUntil || '');
        this.syncReasonSelection('posting', res?.moderation?.posting?.reason ?? null);
        this.syncReasonSelection('account', res?.moderation?.account?.reason ?? null);
      },
      complete: () => this.moderationBusy.set(false)
    });
  }

  blockPosting() {
    const userId = this.platformUserId();
    if (!userId) return;
    this.updateModeration(userId, 'posting', true, this.postingReason());
  }

  blockAccount() {
    const userId = this.platformUserId();
    if (!userId) return;
    this.updateModeration(userId, 'account', true, this.accountReason());
  }

  unblockPosting() {
    const userId = this.platformUserId();
    if (!userId) return;
    this.updateModeration(userId, 'posting', false, 'manual_unblock');
  }

  unblockAccount() {
    const userId = this.platformUserId();
    if (!userId) return;
    this.updateModeration(userId, 'account', false, 'manual_unblock');
  }

  private updateModeration(userId: string, target: 'posting' | 'account', blocked: boolean, reason: string) {
    if (blocked && !this.hasValidBlockedUntilSelection()) {
      return;
    }

    this.moderationBusy.set(true);
    this.dsa.updatePlatformUserModeration(userId, {
      target,
      blocked,
      reason,
      blockedUntil: blocked ? this.parseBlockedUntil() : null
    }).subscribe({
      next: (res) => {
        this.moderationState.set(res?.moderation ?? null);
        this.moderationSummary.set(res?.summary ?? null);
        this.syncReasonSelection('posting', res?.moderation?.posting?.reason ?? null);
        this.syncReasonSelection('account', res?.moderation?.account?.reason ?? null);
        if (target === 'posting') {
          this.blockedUntilLocal.set(this.toLocalDateTimeValue(res?.moderation?.posting?.blockedUntil ?? null));
        } else {
          this.blockedUntilLocal.set(this.toLocalDateTimeValue(res?.moderation?.account?.blockedUntil ?? null));
        }
      },
      complete: () => this.moderationBusy.set(false)
    });
  }

  onBlockedUntilInput(value: string) {
    this.blockedUntilLocal.set(value || '');
  }

  clearBlockedUntil() {
    this.blockedUntilLocal.set('');
  }

  blockedUntilMinLocal(): string {
    return this.toLocalDateTimeValue(this.nextAllowedBlockUntilTimestamp());
  }

  formatBlockUntil(value?: number | null): string {
    if (!Number.isFinite(value)) return '—';
    const ts = Number(value);
    if (ts <= 0) return '—';
    return this.formatTimestamp(ts);
  }

  formatReason(reason: string | null | undefined, target: 'posting' | 'account'): string {
    return findModerationReasonLabel(reason, target === 'posting' ? this.postingReasonOptions : this.accountReasonOptions);
  }

  private parseBlockedUntil(): number | null {
    const raw = this.blockedUntilLocal()?.trim();
    if (!raw) return null;
    const ts = new Date(raw).getTime();
    return Number.isFinite(ts) && ts > 0 ? ts : null;
  }

  private hasValidBlockedUntilSelection(): boolean {
    const raw = this.blockedUntilLocal()?.trim();
    if (!raw) {
      return true;
    }

    const blockedUntil = this.parseBlockedUntil();
    if (blockedUntil !== null && blockedUntil >= this.nextAllowedBlockUntilTimestamp()) {
      return true;
    }

    this.snack.open('Please select a future date and time for a temporary block.', 'OK', { duration: 3000 });
    return false;
  }

  private nextAllowedBlockUntilTimestamp(): number {
    const min = new Date();
    min.setSeconds(0, 0);
    min.setMinutes(min.getMinutes() + 1);
    return min.getTime();
  }

  private toLocalDateTimeValue(value?: number | null): string {
    if (!Number.isFinite(value)) return '';
    const ts = Number(value);
    if (ts <= 0) return '';
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${hh}:${mm}`;
  }

  private syncReasonSelection(target: 'posting' | 'account', reason: string | null): void {
    const options = target === 'posting' ? this.postingReasonOptions : this.accountReasonOptions;
    const fallback = options[0]?.code ?? '';
    const next = options.some((option) => option.code === reason) ? (reason || fallback) : fallback;
    if (target === 'posting') {
      this.postingReason.set(next);
      return;
    }
    this.accountReason.set(next);
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
