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
import { MatTooltipModule } from '@angular/material/tooltip';
import { Multimedia } from '../../../../interfaces/multimedia.interface';
import { PublicMessageDetailData } from '../../../../interfaces/public-message-detail-data.interface';
import { PublicMessage } from '../../../../interfaces/public-message.interface';
import { DsaService } from '../../../../services/dsa/dsa/dsa.service';
import { TranslateService } from '../../../../services/translate-service/translate-service.service';
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
  private translator = inject(TranslateService);
  private dsa = inject(DsaService);
  protected data = inject<PublicMessageDetailData>(MAT_DIALOG_DATA);

  // Inhalt
  msg = signal<PublicMessage | null>(null);
  providerIcon = signal<string>('article');
  providerLabel = signal<string>('Text');
  mediaKind = signal<'iframe' | 'image' | 'none'>('none');
  embedUrl = signal<string | null>(null);
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

  // Übersetzen-State
  tMsg = signal<string | null>(null);
  tReason = signal<string | null>(null);
  loadingMsg = signal(false);
  loadingReason = signal(false);
  actionBusy = signal(false);

  ngOnInit() {
    const raw = typeof this.data.reportedContent === 'string'
      ? this.safeParse(this.data.reportedContent)
      : this.data.reportedContent;

    if (!raw) return;
    this.msg.set(raw);
    const type = (raw.multimedia?.type || 'undefined').toLowerCase();

    this.providerIcon.set(this.iconFor(type));
    this.providerLabel.set(this.labelFor(type));

    switch (type) {
      case 'youtube': {
        const id = this.getYouTubeId(raw.multimedia);
        if (id) {
          this.embedUrl.set(`https://www.youtube.com/embed/${id}`);
          this.mediaKind.set('iframe');
        }
        break;
      }
      case 'spotify': {
        const embed = this.buildSpotifyEmbed(raw.multimedia);
        if (embed) {
          this.embedUrl.set(embed);
          this.mediaKind.set('iframe');
        }
        break;
      }
      case 'tiktok': {
        const id = this.getTikTokId(raw.multimedia);
        if (id) {
          this.embedUrl.set(`https://www.tiktok.com/embed/v2/${id}`);
          this.mediaKind.set('iframe');
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
      this.snack.open('No signal id available.', 'OK', { duration: 2000 });
      return;
    }
    if (this.actionBusy()) return;
    this.actionBusy.set(true);
    this.dsa.promoteSignal(this.data.signalId).subscribe({
      next: () => {
        this.snack.open('Signal promoted to Notice.', 'OK', { duration: 3000 });
        this.ref.close(true);
      },
      error: () => {
        this.actionBusy.set(false);
      }
    });
  }

  dismissSignal() {
    if (this.data.source !== 'signal' || !this.data.signalId) {
      this.snack.open('No signal id available.', 'OK', { duration: 2000 });
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
          this.snack.open('Signal deleted.', 'OK', { duration: 2500 });
          this.ref.close(true);
        },
        error: () => this.actionBusy.set(false)
      });
    });
  }

  translateMessage() {
    const text = this.msg()?.message?.trim();
    if (!text) {
      this.snack.open('No message to translate.', 'OK', { duration: 2000 });
      return;
    }
    this.loadingMsg.set(true);
    this.translator.translateToGerman(text).subscribe({
      next: (t) => this.tMsg.set(t),
      error: () => this.snack.open('Translation failed.', 'OK', { duration: 2500 }),
      complete: () => this.loadingMsg.set(false)
    });
  }

  translateReason() {
    const text = this.data.reasonText?.trim();
    if (!text) {
      this.snack.open('No reason to translate.', 'OK', { duration: 2000 });
      return;
    }
    this.loadingReason.set(true);
    this.translator.translateToGerman(text).subscribe({
      next: (t) => this.tReason.set(t),
      error: () => this.snack.open('Translation failed.', 'OK', { duration: 2500 }),
      complete: () => this.loadingReason.set(false)
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

  normalizeEpoch(value?: number | string | null): number | null {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    if (!Number.isFinite(num)) return null;
    return num < 1_000_000_000_000 ? num * 1000 : num;
  }

  // Helpers
  private safeParse(json: string): PublicMessage | null {
    try { return JSON.parse(json); } catch { return null; }
  }
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
      case 'tenor': return 'Tenor GIF';
      case 'image': return 'Bild';
      default: return 'Text';
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
