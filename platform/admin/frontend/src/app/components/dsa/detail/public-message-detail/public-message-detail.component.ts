import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Multimedia } from '../../../../interfaces/multimedia.interface';
import { PublicMessageDetailData } from '../../../../interfaces/public-message-detail-data.interface';
import { PublicMessage } from '../../../../interfaces/public-message.interface';

@Component({
  selector: 'app-public-message-detail',
  standalone: true,
  imports: [
    CommonModule, DatePipe,
    MatDialogModule, MatIconModule, MatButtonModule,
    MatChipsModule, MatDividerModule, MatTooltipModule, MatCardModule
  ],
  templateUrl: './public-message-detail.component.html',
  styleUrls: ['./public-message-detail.component.css']
})
export class PublicMessageDetailComponent {
  private ref = inject(MatDialogRef<PublicMessageDetailComponent>);
  private sanitizer = inject(DomSanitizer);
  protected data = inject<PublicMessageDetailData>(MAT_DIALOG_DATA);

  msg = signal<PublicMessage | null>(null);
  providerIcon = signal<string>('article');
  providerLabel = signal<string>('Text');
  mediaKind = signal<'iframe' | 'image' | 'none'>('none');
  embedUrl = signal<SafeResourceUrl | null>(null);
  imageUrl = signal<string | null>(null);

  /** Sicht-/Nutzbare Original-URL (contentUrl > sourceUrl > url) */
  readonly sourceUrl = computed(() => {
    const m = this.msg();
    const d = this.data;
    const u = d?.contentUrl || m?.multimedia?.sourceUrl || m?.multimedia?.url;
    return (u && u.trim()) ? u : null;
  });

  ngOnInit() {
    const raw = typeof this.data.reportedContent === 'string'
      ? this.safeParse(this.data.reportedContent)
      : this.data.reportedContent;

    if (!raw) return;
    this.msg.set(raw);
    const { multimedia } = raw;

    const type = (multimedia?.type || 'undefined').toLowerCase();
    this.providerIcon.set(this.iconFor(type));
    this.providerLabel.set(this.labelFor(type));

    // Media Entscheidung
    switch (type) {
      case 'youtube': {
        const id = this.getYouTubeId(multimedia);
        if (id) {
          const url = `https://www.youtube.com/embed/${id}`;
          this.embedUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
          this.mediaKind.set('iframe');
        } else {
          this.mediaKind.set('none');
        }
        break;
      }
      case 'spotify': {
        const embed = this.buildSpotifyEmbed(multimedia);
        if (embed) {
          this.embedUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(embed));
          this.mediaKind.set('iframe');
        } else {
          this.mediaKind.set('none');
        }
        break;
      }
      case 'tiktok': {
        const id = this.getTikTokId(multimedia);
        if (id) {
          const url = `https://www.tiktok.com/embed/v2/${id}`;
          this.embedUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(url));
          this.mediaKind.set('iframe');
        } else {
          this.mediaKind.set('none');
        }
        break;
      }
      case 'tenor': {
        // GIF
        const url = multimedia.url || multimedia.sourceUrl;
        if (url) {
          this.imageUrl.set(url);
          this.mediaKind.set('image');
        } else {
          this.mediaKind.set('none');
        }
        break;
      }
      case 'image': {
        const url = multimedia.url || multimedia.sourceUrl;
        if (url) {
          this.imageUrl.set(url);
          this.mediaKind.set('image');
        } else {
          this.mediaKind.set('none');
        }
        break;
      }
      case 'undefined':
      default:
        this.mediaKind.set('none');
        break;
    }
  }

  close() { this.ref.close(); }

  openContentUrl() {
    const url = this.sourceUrl();
    if (url) window.open(url, '_blank', 'noopener');
  }

  // --- helpers ---
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
    // 1) contentId bevorzugen (kann '?si=' enthalten)
    if (mm.contentId) return mm.contentId.split('?')[0];
    // 2) aus oembed.html extrahieren
    const html = mm.oembed?.html as string | undefined;
    if (html) {
      const m = html.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
      if (m?.[1]) return m[1];
    }
    // 3) aus sourceUrl oder url extrahieren
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
    // Wenn contentId vorhanden: versuchen als track/episode/playlist zu nutzen
    if (mm.contentId) {
      // Simple Heuristik: Track-ID hat meist 22 Zeichen, wir bauen ein generisches Embed
      return `https://open.spotify.com/embed/${mm.contentId}`; // contentId darf 'track/XYZ' oder nur 'XYZ' sein
    }
    const src = mm.sourceUrl || mm.url;
    if (!src) return null;
    // Replace open -> embed
    if (src.includes('open.spotify.com')) {
      return src.replace('open.spotify.com/', 'open.spotify.com/embed/');
    }
    return null;
  }

  private getTikTokId(mm: Multimedia): string | null {
    const src = mm.sourceUrl || mm.url || '';
    // https://www.tiktok.com/@user/video/1234567890
    const m = src.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
    if (m?.[1]) return m[1];
    // Kurzform: https://vm.tiktok.com/XXXX/ (kein direkter ID-Zugriff) -> kein Embed
    return mm.contentId || null;
  }
}