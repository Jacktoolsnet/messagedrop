import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { USER_ACCOUNT_BLOCK_REASONS, USER_POSTING_BLOCK_REASONS, findModerationReasonLabel } from '../../../../constants/user-moderation-reasons';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Multimedia } from '../../../../interfaces/multimedia.interface';
import { PlatformUserModeration, PlatformUserSummary } from '../../../../interfaces/platform-user-moderation.interface';
import { PublicMessageDetailData } from '../../../../interfaces/public-message-detail-data.interface';
import { PublicMessage } from '../../../../interfaces/public-message.interface';
import { DsaService } from '../../../../services/dsa/dsa/dsa.service';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { TranslateService } from '../../../../services/translate-service/translate-service.service';
import { parsePublicMessageDetailContent } from '../../../../utils/reported-content.util';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog.component';

@Component({
  selector: 'app-signal-detail',
  standalone: true,
  imports: [
    CommonModule, DatePipe,
    MatDialogModule, MatIconModule, MatButtonModule,
    MatChipsModule, MatDividerModule, MatTooltipModule, MatCardModule, MatMenuModule
  ],
  templateUrl: './signal-detail.component.html',
  styleUrls: ['./signal-detail.component.css']
})

export class SignalDetailComponent implements OnInit {
  private ref = inject(MatDialogRef<SignalDetailComponent>);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);
  private sanitizer = inject(DomSanitizer);
  private translator = inject(TranslateService);
  private dsa = inject(DsaService);
  readonly i18n = inject(TranslationHelperService);
  protected data = inject<PublicMessageDetailData>(MAT_DIALOG_DATA);

  // Inhalt
  msg = signal<PublicMessage | null>(null);
  providerIcon = signal<string>('article');
  providerLabel = signal<string>('Text');
  mediaKind = signal<'iframe' | 'image' | 'none'>('none');
  embedUrl = signal<SafeResourceUrl | null>(null);
  imageUrl = signal<string | null>(null);

  // Original-Quelle sichtbar?
  readonly sourceUrl = computed(() => {
    const m = this.msg();
    const d = this.data;
    return this.toSafeHttpUrl(d?.contentUrl || m?.multimedia?.sourceUrl || m?.multimedia?.url);
  });
  readonly hasModeration = computed(() => {
    const m = this.msg();
    if (!m) return false;
    return [
      m.aiModerationDecision,
      m.aiModerationScore,
      m.aiModerationFlagged,
      m.aiModerationAt,
      m.patternMatch,
      m.patternMatchAt,
      m.manualModerationDecision,
      m.manualModerationReason,
      m.manualModerationAt,
      m.manualModerationBy
    ].some(value => value !== undefined && value !== null && value !== '');
  });
  readonly platformUserId = computed(() => {
    const id = this.msg()?.userId;
    const value = typeof id === 'string' ? id.trim() : '';
    return value || null;
  });

  // Übersetzen-State
  tMsg = signal<string | null>(null);
  tReason = signal<string | null>(null);
  loadingMsg = signal(false);
  loadingReason = signal(false);
  actionBusy = signal(false);
  moderationState = signal<PlatformUserModeration | null>(null);
  moderationSummary = signal<PlatformUserSummary | null>(null);
  moderationBusy = signal(false);
  blockedUntilLocal = signal<string>('');
  readonly postingReasonOptions = USER_POSTING_BLOCK_REASONS;
  readonly accountReasonOptions = USER_ACCOUNT_BLOCK_REASONS;
  readonly postingReason = signal(USER_POSTING_BLOCK_REASONS[0]?.code ?? '');
  readonly accountReason = signal(USER_ACCOUNT_BLOCK_REASONS[0]?.code ?? '');

  ngOnInit() {
    const raw = parsePublicMessageDetailContent(this.data.reportedContent);

    if (!raw) return;
    this.msg.set(raw);
    const type = (raw.multimedia?.type || 'undefined').toLowerCase();

    this.providerIcon.set(this.iconFor(type));
    this.providerLabel.set(this.labelFor(type));

    switch (type) {
      case 'youtube': {
        const id = this.getYouTubeId(raw.multimedia);
        if (id) {
          const safeEmbedUrl = this.toSafeEmbedUrl(`https://www.youtube.com/embed/${id}`);
          if (safeEmbedUrl) {
            this.embedUrl.set(safeEmbedUrl);
            this.mediaKind.set('iframe');
          }
        }
        break;
      }
      case 'spotify': {
        const embed = this.buildSpotifyEmbed(raw.multimedia);
        if (embed) {
          const safeEmbedUrl = this.toSafeEmbedUrl(embed);
          if (safeEmbedUrl) {
            this.embedUrl.set(safeEmbedUrl);
            this.mediaKind.set('iframe');
          }
        }
        break;
      }
      case 'tiktok': {
        const id = this.getTikTokId(raw.multimedia);
        if (id) {
          const safeEmbedUrl = this.toSafeEmbedUrl(`https://www.tiktok.com/embed/v2/${id}`);
          if (safeEmbedUrl) {
            this.embedUrl.set(safeEmbedUrl);
            this.mediaKind.set('iframe');
          }
        }
        break;
      }
      case 'tenor':
      case 'image': {
        const url = this.toSafeHttpUrl(raw.multimedia.url || raw.multimedia.sourceUrl);
        if (url) {
          this.imageUrl.set(url);
          this.mediaKind.set('image');
        }
        break;
      }
      default:
        this.mediaKind.set('none');
    }

    const userId = typeof raw.userId === 'string' ? raw.userId.trim() : '';
    if (userId) {
      this.loadPlatformUserModeration(userId);
    }
  }

  // Actions
  close() { this.ref.close(); }
  openContentUrl() {
    const url = this.sourceUrl();
    if (url) window.open(url, '_blank', 'noopener');
  }

  openStatusPage() {
    if (this.data.source === 'signal' && this.data.signalId) {
      this.dsa.getSignalStatusUrl(this.data.signalId).subscribe({
        next: (res) => { if (res?.statusUrl) window.open(res.statusUrl, '_blank', 'noopener'); }
      });
    }
  }

  promoteSignal() {
    if (this.data.source !== 'signal' || !this.data.signalId) {
      this.snack.open(this.i18n.t('No signal id available.'), this.i18n.t('OK'), { duration: 2000 });
      return;
    }
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    this.dsa.promoteSignal(this.data.signalId).subscribe({
      next: () => {
        this.snack.open(this.i18n.t('Signal promoted to Notice.'), this.i18n.t('OK'), { duration: 3000 });
        this.ref.close(true);
      },
      error: () => {
        this.actionBusy.set(false);
      }
    });
  }

  dismissSignal() {
    if (this.data.source !== 'signal' || !this.data.signalId) {
      this.snack.open(this.i18n.t('No signal id available.'), this.i18n.t('OK'), { duration: 2000 });
      return;
    }
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Dismiss Signal?',
        message: 'This signal will be dismissed permanently.',
        confirmText: 'Dismiss',
        cancelText: 'Cancel',
        warn: true
      }
    });

    ref.afterClosed().subscribe(ok => {
      if (!ok) return;
      if (this.actionBusy()) return;
      this.actionBusy.set(true);
      this.dsa.deleteSignal(this.data.signalId!).subscribe({
        next: () => {
          this.snack.open(this.i18n.t('Signal deleted.'), this.i18n.t('OK'), { duration: 2500 });
          this.ref.close(true);
        },
        error: () => this.actionBusy.set(false)
      });
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

  translateMessage() {
    const text = this.msg()?.message?.trim();
    if (!text) {
      this.snack.open(this.i18n.t('No message to translate.'), this.i18n.t('OK'), { duration: 2000 });
      return;
    }
    this.loadingMsg.set(true);
    this.translator.translateToGerman(text).subscribe({
      next: (t) => this.tMsg.set(t),
      error: () => this.snack.open(this.i18n.t('Translation failed.'), this.i18n.t('OK'), { duration: 2500 }),
      complete: () => this.loadingMsg.set(false)
    });
  }

  translateReason() {
    const text = this.data.reasonText?.trim();
    if (!text) {
      this.snack.open(this.i18n.t('No reason to translate.'), this.i18n.t('OK'), { duration: 2000 });
      return;
    }
    this.loadingReason.set(true);
    this.translator.translateToGerman(text).subscribe({
      next: (t) => this.tReason.set(t),
      error: () => this.snack.open(this.i18n.t('Translation failed.'), this.i18n.t('OK'), { duration: 2500 }),
      complete: () => this.loadingReason.set(false)
    });
  }

  formatScore(value?: number | null): string {
    return Number.isFinite(value) ? Number(value).toFixed(3) : this.i18n.t('—');
  }

  formatBool(value?: boolean | number | null): string {
    if (value === undefined || value === null) return this.i18n.t('—');
    return value === true || value === 1 ? this.i18n.t('Yes') : this.i18n.t('No');
  }

  formatTimestamp(value?: number | null): string {
    if (!Number.isFinite(value)) return this.i18n.t('—');
    const ts = Number(value);
    try {
      return new Date(ts).toLocaleString(this.i18n.dateLocale());
    } catch {
      return new Date(ts).toISOString();
    }
  }

  formatBlockUntil(value?: number | null): string {
    if (!Number.isFinite(value)) return this.i18n.t('—');
    const ts = Number(value);
    if (ts <= 0) return this.i18n.t('—');
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

    this.snack.open(this.i18n.t('Please select a future date and time for a temporary block.'), this.i18n.t('OK'), { duration: 3000 });
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

  normalizeEpoch(value?: number | string | null): number | null {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return num < 1_000_000_000_000 ? num * 1000 : num;
  }

  // Helpers
  private iconFor(type: string): string {
    switch (type) {
      case 'youtube': return 'smart_display';
      case 'spotify': return 'music_note';
      case 'tiktok': return 'movie';
      case 'tenor': return 'gif';
      case 'image': return 'image';
      default: return 'article';
    }
  }
  private labelFor(type: string): string {
    switch (type) {
      case 'youtube': return 'YouTube';
      case 'spotify': return 'Spotify';
      case 'tiktok': return 'TikTok';
      case 'tenor': return this.i18n.t('Tenor GIF');
      case 'image': return this.i18n.t('Image');
      default: return this.i18n.t('Text');
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

  private toSafeEmbedUrl(value?: string | null): SafeResourceUrl | null {
    const safeHttpUrl = this.toSafeHttpUrl(value);
    return safeHttpUrl ? this.sanitizer.bypassSecurityTrustResourceUrl(safeHttpUrl) : null;
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

  private getYouTubeId(mm: Multimedia): string | null {
    const fromContent = this.sanitizeYoutubeId(mm.contentId?.split('?')[0] || null);
    if (fromContent) return fromContent;

    const sourceUrl = this.toSafeHttpUrl(mm.sourceUrl || mm.url);
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

  private buildSpotifyEmbed(mm: Multimedia): string | null {
    const allowedTypes = new Set(['track', 'album', 'playlist', 'episode', 'show']);

    const fromContent = typeof mm.contentId === 'string' ? mm.contentId.trim().replace(/^\/+/, '') : '';
    if (fromContent) {
      const parts = fromContent.split('/').filter(Boolean);
      if (parts.length === 2 && allowedTypes.has(parts[0]) && /^[a-zA-Z0-9]+$/.test(parts[1])) {
        return `https://open.spotify.com/embed/${parts[0]}/${parts[1]}`;
      }
    }

    const sourceUrl = this.toSafeHttpUrl(mm.sourceUrl || mm.url);
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

  private getTikTokId(mm: Multimedia): string | null {
    const sourceUrl = this.toSafeHttpUrl(mm.sourceUrl || mm.url);
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

    return this.sanitizeTikTokId(mm.contentId || null);
  }
}
