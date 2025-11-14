import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, OnChanges, OnInit, Output, inject } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { AppSettings } from '../../../interfaces/app-settings';
import { AppService } from '../../../services/app.service';

type PlatformKey = 'tenor' | 'youtube' | 'spotify' | 'tiktok' | 'pinterest';
type SettingsKey = 'enableTenorContent' | 'enableYoutubeContent' | 'enableSpotifyContent' | 'enableTikTokContent' | 'enablePinterestContent';

type PlatformMeta = {
  name: string;
  icon: string;
  settingsKey: SettingsKey;
  terms: string;
  privacy: string;
};

const PLATFORM_META: Record<PlatformKey, PlatformMeta> = {
  tenor: { name: 'Tenor', icon: 'gif_box', settingsKey: 'enableTenorContent', terms: 'https://policies.google.com/terms', privacy: 'https://policies.google.com/privacy' },
  youtube: { name: 'YouTube', icon: 'smart_display', settingsKey: 'enableYoutubeContent', terms: 'https://www.youtube.com/t/terms', privacy: 'https://policies.google.com/privacy' },
  spotify: { name: 'Spotify', icon: 'graphic_eq', settingsKey: 'enableSpotifyContent', terms: 'https://www.spotify.com/legal/end-user-agreement/', privacy: 'https://www.spotify.com/legal/privacy-policy/' },
  tiktok: { name: 'TikTok', icon: 'music_note', settingsKey: 'enableTikTokContent', terms: 'https://www.tiktok.com/legal/terms-of-service', privacy: 'https://www.tiktok.com/legal/privacy-policy' },
  pinterest: { name: 'Pinterest', icon: 'push_pin', settingsKey: 'enablePinterestContent', terms: 'https://policy.pinterest.com/terms-of-service', privacy: 'https://policy.pinterest.com/privacy-policy' }
};

@Component({
  selector: 'app-enable-external-content',
  standalone: true,
  imports: [CommonModule, MatSlideToggleModule, MatIconModule],
  templateUrl: './enable-external-content.component.html',
  styleUrl: './enable-external-content.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EnableExternalContentComponent implements OnInit, OnChanges {
  /** Required: which platform to enable */
  @Input({ required: true }) platform!: PlatformKey;

  /** Optional: start with toggle focused/checked style, defaults to current settings */
  @Input() checkedOverride?: boolean;

  /** Emits when the enabled state is changed (true/false) */
  @Output() enabledChange = new EventEmitter<boolean>();

  enabled = false;
  platformName = '';
  platformIcon = 'public';
  termsUrl = '';
  privacyUrl = '';
  private settingsKey!: SettingsKey;
  private readonly appService = inject(AppService);

  ngOnInit(): void { this.initFromSettings(); }
  ngOnChanges(): void { this.initFromSettings(); }

  private initFromSettings(): void {
    if (!this.platform) return;
    const meta = PLATFORM_META[this.platform];
    this.platformName = meta.name;
    this.platformIcon = meta.icon;
    this.settingsKey = meta.settingsKey;
    this.termsUrl = meta.terms;
    this.privacyUrl = meta.privacy;

    const settings = this.appService.getAppSettings();
    const current = Boolean((settings as AppSettings)[this.settingsKey]);
    this.enabled = this.checkedOverride ?? current;
  }

  async onToggle(enabled: boolean): Promise<void> {
    this.enabled = enabled;

    const current = this.appService.getAppSettings();
    const updated: AppSettings = { ...current, [this.settingsKey]: enabled } as AppSettings;
    await this.appService.setAppSettings(updated);

    this.enabledChange.emit(enabled);
  }

  // Robust: verhindert, dass Eltern-Container (z. B. Message-Karte) den Klick abfangen
  @HostListener('click', ['$event']) onClick(e: Event) { e.stopPropagation(); }
  @HostListener('mousedown', ['$event']) onMouseDown(e: Event) { e.stopPropagation(); }
  @HostListener('pointerdown', ['$event']) onPointerDown(e: Event) { e.stopPropagation(); }
  @HostListener('touchstart', ['$event']) onTouchStart(e: Event) { e.stopPropagation(); }
}
