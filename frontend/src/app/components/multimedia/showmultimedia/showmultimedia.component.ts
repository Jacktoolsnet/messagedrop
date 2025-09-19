import { CommonModule } from '@angular/common';
import { Component, Input, SimpleChanges } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { AppSettings } from '../../../interfaces/app-settings';
import { Multimedia } from '../../../interfaces/multimedia';
import { AppService } from '../../../services/app.service';

type PlatformKey = 'tenor' | 'youtube' | 'spotify' | 'tiktok' | 'pinterest';
type SettingsKey =
  | 'allowTenorContent'
  | 'allowYoutubeContent'
  | 'allowSpotifyContent'
  | 'allowTikTokContent'
  | 'allowPinterestContent';

@Component({
  selector: 'app-showmultimedia',
  imports: [CommonModule, MatSlideToggleModule],
  templateUrl: './showmultimedia.component.html',
  styleUrl: './showmultimedia.component.css'
})
export class ShowmultimediaComponent {
  @Input() multimedia: Multimedia | undefined;

  safeUrl: SafeResourceUrl | undefined; // falls du mal iframe-URLs brauchst
  safeHtml: SafeHtml | undefined;

  // Aktivierungs-Logik
  isPlatformEnabled = true;
  platformKey?: PlatformKey;
  platformName = '';
  settingsKey?: SettingsKey;

  constructor(
    private sanitizer: DomSanitizer,
    private appService: AppService
  ) { }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['multimedia']) {
      this.detectPlatformAndStatus();
      // Nur rendern, wenn erlaubt
      if (this.isPlatformEnabled) {
        this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(
          this.multimedia?.oembed?.html ?? ''
        );
      } else {
        this.safeHtml = undefined;
      }
    }
  }

  private detectPlatformAndStatus(): void {
    this.platformKey = this.detectPlatform(this.multimedia);

    const map: Record<PlatformKey, { name: string; key: SettingsKey }> = {
      tenor: { name: 'Tenor', key: 'allowTenorContent' },
      youtube: { name: 'YouTube', key: 'allowYoutubeContent' },
      spotify: { name: 'Spotify', key: 'allowSpotifyContent' },
      tiktok: { name: 'TikTok', key: 'allowTikTokContent' },
      pinterest: { name: 'Pinterest', key: 'allowPinterestContent' },
    };

    if (this.platformKey) {
      const def = map[this.platformKey];
      this.platformName = def.name;
      this.settingsKey = def.key;

      const s = this.appService.getAppSettings();
      this.isPlatformEnabled = !!(s as any)[def.key];
    } else {
      // Unbekannte Plattformen nicht blocken
      this.isPlatformEnabled = true;
      this.platformName = '';
      this.settingsKey = undefined;
    }
  }

  private detectPlatform(m?: Multimedia): PlatformKey | undefined {
    if (!m) return undefined;
    if (m.type === 'tenor') return 'tenor';

    const raw = (m.sourceUrl || m.url || '').toLowerCase();
    try {
      const u = new URL(raw);
      const h = u.hostname;
      if (h.includes('youtube.com') || h === 'youtu.be') return 'youtube';
      if (h.includes('spotify.com')) return 'spotify';
      if (h.includes('tiktok.com')) return 'tiktok';
      if (h.includes('pinterest.com') || h === 'pin.it') return 'pinterest';
    } catch { /* ignore parse errors */ }
    return undefined;
  }

  onTogglePlatform(enabled: boolean): void {
    if (!enabled || !this.settingsKey) return;

    const current = this.appService.getAppSettings();
    const updated: AppSettings = { ...current, [this.settingsKey]: true } as AppSettings;

    this.appService.setAppSettings(updated);
    this.isPlatformEnabled = true;

    // Nach Aktivierung direkt rendern:
    this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(
      this.multimedia?.oembed?.html ?? ''
    );
  }
}