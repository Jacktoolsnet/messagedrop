import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AppSettings } from '../../../interfaces/app-settings';
import { Multimedia } from '../../../interfaces/multimedia';
import { AppService } from '../../../services/app.service';
import { OembedService } from '../../../services/oembed.service';

type PlatformKey = 'youtube' | 'spotify' | 'tiktok' | 'pinterest';
type SettingsKey =
  | 'allowYoutubeContent'
  | 'allowSpotifyContent'
  | 'allowTikTokContent'
  | 'allowPinterestContent';

interface Platform {
  key: PlatformKey;
  name: string;
  icon: string;     // Material Symbol
  enabled: boolean;
  settingsKey: SettingsKey;
}

@Component({
  selector: 'app-pinterest', // (optional) kannst du umbenennen, z.B. 'app-import-multimedia'
  standalone: true,
  imports: [
    CommonModule,
    MatDialogContent,
    MatButtonModule,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule
  ],
  templateUrl: './import-multimedia.component.html',
  styleUrl: './import-multimedia.component.css'
})
export class ImportMultimediaComponent {
  multimediaUrl: string = '';
  multimedia: Multimedia | undefined = undefined;
  urlInvalid: boolean = true;
  safeHtml: SafeHtml | undefined;
  disabledReason: string = '';

  platforms: Platform[] = [
    { key: 'youtube', name: 'YouTube', icon: 'smart_display', enabled: false, settingsKey: 'allowYoutubeContent' },
    { key: 'spotify', name: 'Spotify', icon: 'library_music', enabled: false, settingsKey: 'allowSpotifyContent' },
    { key: 'tiktok', name: 'TikTok', icon: 'music_video', enabled: false, settingsKey: 'allowTikTokContent' },
    { key: 'pinterest', name: 'Pinterest', icon: 'push_pin', enabled: false, settingsKey: 'allowPinterestContent' },
  ];

  constructor(
    public dialogRef: MatDialogRef<ImportMultimediaComponent>,
    private oembedService: OembedService,
    private sanitizer: DomSanitizer,
    private appService: AppService,
    @Inject(MAT_DIALOG_DATA) public data: {}
  ) {
    // einmalige Initialisierung aus AppSettings
    const s = this.appService.getAppSettings();
    this.platforms = this.platforms.map(p => ({ ...p, enabled: !!(s as any)[p.settingsKey] }));
  }

  private getPlatformFromUrl(url: string): PlatformKey | undefined {
    try {
      const u = new URL(url.toLowerCase());
      const h = u.hostname;
      if (h.includes('youtube.com') || h === 'youtu.be') return 'youtube';
      if (h.includes('spotify.com')) return 'spotify';
      if (h.includes('tiktok.com')) return 'tiktok';
      if (h.includes('pinterest.com') || h === 'pin.it') return 'pinterest';
    } catch { /* ignore parse errors */ }
    return undefined;
  }

  async validateUrl() {
    this.disabledReason = '';
    this.safeHtml = undefined;
    this.multimedia = undefined;

    const platform = this.getPlatformFromUrl(this.multimediaUrl);
    if (platform) {
      const p = this.platforms.find(x => x.key === platform)!;
      if (!p.enabled) {
        this.urlInvalid = true;
        this.disabledReason = `This platform (${p.name}) is currently disabled. Enable it below to continue.`;
        return;
      }
    }

    // OEmbed nur, wenn Plattform erlaubt (oder unbekannt)
    this.multimedia = await this.oembedService.getObjectFromUrl(this.multimediaUrl) as Multimedia;
    if (this.multimedia) {
      this.urlInvalid = false;
      this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(this.multimedia.oembed?.html ?? '');
    } else {
      this.urlInvalid = true;
    }
  }

  onTogglePlatform(p: Platform, enabled: boolean): void {
    p.enabled = enabled;

    const current = this.appService.getAppSettings();
    const updated: AppSettings = {
      ...current,
      [p.settingsKey]: enabled
    } as AppSettings;

    this.appService.setAppSettings(updated);

    // Falls der Nutzer zuerst URL eingibt und dann aktiviert:
    if (enabled && this.multimediaUrl) {
      this.validateUrl();
    }
  }

  clearContent(): void {
    this.urlInvalid = true;
    this.safeHtml = undefined;
    this.multimediaUrl = '';
    this.multimedia = undefined;
    this.disabledReason = '';
  }

  onApplyClick(): void {
    this.dialogRef.close(this.multimedia);
  }

  onCancelClick(): void {
    if (this.multimediaUrl !== '') {
      this.clearContent();
    } else {
      this.dialogRef.close();
    }
  }
}