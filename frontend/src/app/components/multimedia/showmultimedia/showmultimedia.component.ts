import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { AppSettings } from '../../../interfaces/app-settings';
import { Multimedia } from '../../../interfaces/multimedia';
import { AppService } from '../../../services/app.service';

type PlatformKey = 'tenor' | 'youtube' | 'spotify' | 'tiktok' | 'pinterest' | 'notsupported';
type SettingsKey =
  | 'allowTenorContent'
  | 'allowYoutubeContent'
  | 'allowSpotifyContent'
  | 'allowTikTokContent'
  | 'allowPinterestContent'
  | 'notSupported';

@Component({
  selector: 'app-showmultimedia',
  imports: [
    CommonModule,
    MatSlideToggleModule
  ],
  templateUrl: './showmultimedia.component.html',
  styleUrl: './showmultimedia.component.css'
})
export class ShowmultimediaComponent implements OnInit, OnChanges {
  @Input() multimedia: Multimedia | undefined;

  termsLinks?: { terms: string; privacy: string };

  safeUrl: SafeResourceUrl | undefined; // falls du mal iframe-URLs brauchst
  safeHtml: SafeHtml | undefined;

  // Aktivierungs-Logik
  isPlatformEnabled = false;
  platformKey: PlatformKey = 'notsupported';
  platformName = '';
  settingsKey: SettingsKey = 'notSupported';

  constructor(
    private sanitizer: DomSanitizer,
    private appService: AppService
  ) { }

  ngOnInit(): void {
    this.detectPlatformAndStatus();
  }

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
    this.termsLinks = this.getTermsLinks(this.platformKey);

    const map: Record<PlatformKey, { name: string; key: SettingsKey }> = {
      tenor: { name: 'Tenor', key: 'allowTenorContent' },
      youtube: { name: 'YouTube', key: 'allowYoutubeContent' },
      spotify: { name: 'Spotify', key: 'allowSpotifyContent' },
      tiktok: { name: 'TikTok', key: 'allowTikTokContent' },
      pinterest: { name: 'Pinterest', key: 'allowPinterestContent' },
      notsupported: { name: 'not supported', key: 'notSupported' }
    };

    if (this.platformKey) {
      const def = map[this.platformKey];
      this.platformName = def.name;
      this.settingsKey = def.key;

      const s = this.appService.getAppSettings();
      this.isPlatformEnabled = !!(s as any)[def.key];
    } else {
      // Unbekannte Plattformen nicht blocken
      this.isPlatformEnabled = false;
      this.platformName = '';
      this.settingsKey = 'notSupported';
    }
  }

  private detectPlatform(m?: Multimedia): PlatformKey {
    if (!m) return 'notsupported';
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
    return 'notsupported';
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

  private getTermsLinks(p: PlatformKey): { terms: string; privacy: string } {
    switch (p) {
      case 'youtube':
        return {
          terms: 'https://www.youtube.com/t/terms',
          privacy: 'https://policies.google.com/privacy'
        };
      case 'spotify':
        return {
          terms: 'https://www.spotify.com/legal/end-user-agreement/',
          privacy: 'https://www.spotify.com/legal/privacy-policy/'
        };
      case 'tiktok':
        return {
          terms: 'https://www.tiktok.com/legal/terms-of-service',
          privacy: 'https://www.tiktok.com/legal/privacy-policy'
        };
      case 'pinterest':
        return {
          terms: 'https://policy.pinterest.com/terms-of-service',
          privacy: 'https://policy.pinterest.com/privacy-policy'
        };
      case 'tenor':
        // Tenor gehört zu Google – allgemeine Google-Policies nutzen:
        return {
          terms: 'https://policies.google.com/terms',
          privacy: 'https://policies.google.com/privacy'
        };
      default:
        return { terms: '', privacy: '' };
    }
  }
}