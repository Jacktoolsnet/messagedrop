import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
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
    MatChipsModule, MatDividerModule, MatTooltipModule, MatCardModule
  ],
  templateUrl: './signal-detail.component.html',
  styleUrls: ['./signal-detail.component.css']
})

export class SignalDetailComponent implements OnInit {
  private ref = inject(MatDialogRef<SignalDetailComponent>);
  private dialog = inject(MatDialog);
  private sanitizer = inject(DomSanitizer);
  private snack = inject(MatSnackBar);
  private translator = inject(TranslateService);
  private dsa = inject(DsaService);
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
    const u = d?.contentUrl || m?.multimedia?.sourceUrl || m?.multimedia?.url;
    return (u && u.trim()) ? u : null;
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
          this.embedUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${id}`));
          this.mediaKind.set('iframe');
        }
        break;
      }
      case 'spotify': {
        const embed = this.buildSpotifyEmbed(raw.multimedia);
        if (embed) {
          this.embedUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(embed));
          this.mediaKind.set('iframe');
        }
        break;
      }
      case 'tiktok': {
        const id = this.getTikTokId(raw.multimedia);
        if (id) {
          this.embedUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.tiktok.com/embed/v2/${id}`));
          this.mediaKind.set('iframe');
        }
        break;
      }
      case 'tenor':
      case 'image': {
        const url = raw.multimedia.url || raw.multimedia.sourceUrl;
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

  // Helpers
  private safeParse(json: string): PublicMessage | null {
    try { return JSON.parse(json); } catch { return null; }
  }
  private iconFor(type: string): string {
    switch (type) {
      case 'youtube': return 'smart_display';
      case 'spotify': return 'music_note';
      case 'tiktok': return 'movie';
      case 'tenor': return 'gif_box';
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
  private getYouTubeId(mm: Multimedia): string | null {
    if (mm.contentId) return mm.contentId.split('?')[0];
    const html = mm.oembed?.html ?? undefined;
    if (html) {
      const m = html.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
      if (m?.[1]) return m[1];
    }
    const src = mm.sourceUrl || mm.url || '';
    const watch = src.match(/[?&]v=([a-zA-Z0-9_-]+)/);
    if (watch?.[1]) return watch[1];
    const shorts = src.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
    if (shorts?.[1]) return shorts[1];
    const embed = src.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
    if (embed?.[1]) return embed[1];
    return null;
  }
  private buildSpotifyEmbed(mm: Multimedia): string | null {
    if (mm.contentId) return `https://open.spotify.com/embed/${mm.contentId}`;
    const src = mm.sourceUrl || mm.url;
    if (!src) return null;
    if (src.includes('open.spotify.com')) {
      return src.replace('open.spotify.com/', 'open.spotify.com/embed/');
    }
    return null;
  }
  private getTikTokId(mm: Multimedia): string | null {
    const src = mm.sourceUrl || mm.url || '';
    const m = src.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
    if (m?.[1]) return m[1];
    return mm.contentId || null;
  }
}
