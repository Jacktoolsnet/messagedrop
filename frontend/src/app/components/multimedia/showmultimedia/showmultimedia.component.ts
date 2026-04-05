import { Component, Input, OnChanges, OnDestroy, SimpleChanges, effect, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import { EXTERNAL_CONTENT_SETTINGS_KEYS, ExternalContentPlatform, isExternalContentPlatform } from '../../../interfaces/external-content-platform';
import { Multimedia } from '../../../interfaces/multimedia';
import { MultimediaType } from '../../../interfaces/multimedia-type';
import { AppService } from '../../../services/app.service';
import { OembedService } from '../../../services/oembed.service';
import { StickerService } from '../../../services/sticker.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { ExternalContentComponent } from '../../legal/external-content/external-content.component';

@Component({
  selector: 'app-showmultimedia',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe
  ],
  templateUrl: './showmultimedia.component.html',
  styleUrl: './showmultimedia.component.css'
})
export class ShowmultimediaComponent implements OnChanges, OnDestroy {
  @Input() multimedia: Multimedia | undefined;
  readonly stickerProtectionOverlayUrl = 'assets/images/sticker-protection-overlay.svg';

  termsLinks?: { terms: string; privacy: string };

  safeHtml: SafeHtml | undefined;
  renderableImageUrl = '';
  stickerImageLoading = false;
  stickerImageError = false;

  // Activation logic
  isPlatformEnabled = false;
  disabledReason = '';
  showExternalSettingsButton = false;

  private readonly sanitizer = inject(DomSanitizer);
  private readonly dialog = inject(MatDialog);
  private readonly appService = inject(AppService);
  private readonly oembedService = inject(OembedService);
  private readonly stickerService = inject(StickerService);
  private readonly translation = inject(TranslationHelperService);
  private stickerRequestToken = 0;
  private currentStickerRenderKey = '';
  private stickerObjectUrl: string | null = null;
  private readonly settingsEffect = effect(() => {
    this.appService.settingsSet();
    this.updateFromMultimedia();
  });

  ngOnChanges(changes: SimpleChanges) {
    if ('multimedia' in changes) {
      this.updateFromMultimedia();
    }
  }

  ngOnDestroy(): void {
    this.stickerRequestToken += 1;
    this.currentStickerRenderKey = '';
    this.clearStickerObjectUrl();
  }

  private updateFromMultimedia(): void {
    const settings = this.appService.getAppSettings();
    const platform = this.getCurrentPlatform();

    this.disabledReason = '';
    this.showExternalSettingsButton = false;
    this.isPlatformEnabled = platform
      ? settings[EXTERNAL_CONTENT_SETTINGS_KEYS[platform]]
      : true;

    if (platform && !this.isPlatformEnabled) {
      this.disabledReason = this.translation.t('common.multimedia.platformDisabled', {
        platform: this.getPlatformLabel(platform)
      });
      this.showExternalSettingsButton = true;
      this.safeHtml = undefined;
      void this.updateStickerImageUrl();
      return;
    }

    this.safeHtml = this.isPlatformEnabled && this.isOembedAllowed()
      ? this.sanitizer.bypassSecurityTrustHtml(this.multimedia?.oembed?.html ?? '')
      : undefined;

    void this.updateStickerImageUrl();
  }

  openExternalContentSettings(): void {
    const platform = this.getCurrentPlatform();
    const dialogWidth = platform ? 'min(440px, 90vw)' : 'min(700px, 90vw)';
    const dialogRef = this.dialog.open(ExternalContentComponent, {
      data: {
        appSettings: this.appService.getAppSettings(),
        visiblePlatforms: platform ? [platform] : undefined
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      width: dialogWidth,
      height: 'auto',
      autoFocus: false,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe(() => {
      this.updateFromMultimedia();
    });
  }

  getRenderableImageUrl(): string {
    return this.renderableImageUrl;
  }

  onStickerImageLoaded(): void {
    this.stickerImageLoading = false;
  }

  onStickerImageError(): void {
    this.stickerImageLoading = false;
    this.stickerImageError = true;
    this.currentStickerRenderKey = '';
    this.renderableImageUrl = '';
    this.clearStickerObjectUrl();
  }

  private isOembedAllowed(): boolean {
    return this.oembedService.isAllowedOembedSource(
      this.multimedia?.sourceUrl,
      this.multimedia?.oembed?.provider_url
    );
  }

  private getCurrentPlatform(): ExternalContentPlatform | undefined {
    return isExternalContentPlatform(this.multimedia?.type) ? this.multimedia.type : undefined;
  }

  private getPlatformLabel(platform: ExternalContentPlatform): string {
    switch (platform) {
      case 'youtube':
        return 'YouTube';
      case 'spotify':
        return 'Spotify';
      case 'tiktok':
        return 'TikTok';
      case 'pinterest':
        return 'Pinterest';
      case 'tenor':
        return 'Tenor';
      case 'unsplash':
        return 'Unsplash';
      default:
        return this.translation.t('common.legal.externalContent.title');
    }
  }

  private async updateStickerImageUrl(): Promise<void> {
    const multimedia = this.multimedia;
    if (multimedia?.type !== MultimediaType.STICKER) {
      this.currentStickerRenderKey = '';
      this.stickerImageLoading = false;
      this.stickerImageError = false;
      this.clearStickerObjectUrl();
      this.renderableImageUrl = multimedia?.url || '';
      return;
    }

    const stickerId = this.stickerService.resolveStickerId(multimedia);
    if (!stickerId) {
      this.currentStickerRenderKey = '';
      this.stickerImageLoading = false;
      this.stickerImageError = true;
      this.clearStickerObjectUrl();
      this.renderableImageUrl = '';
      return;
    }

    const renderKey = `${stickerId}:preview`;
    if (renderKey === this.currentStickerRenderKey && (this.renderableImageUrl || this.stickerImageLoading)) {
      return;
    }

    this.currentStickerRenderKey = renderKey;
    const requestToken = ++this.stickerRequestToken;
    this.stickerImageLoading = true;
    this.stickerImageError = false;
    this.clearStickerObjectUrl();
    this.renderableImageUrl = '';

    const objectUrl = await this.stickerService.fetchRenderObjectUrl(stickerId, 'preview');
    if (requestToken !== this.stickerRequestToken) {
      if (objectUrl) {
        window.URL.revokeObjectURL(objectUrl);
      }
      return;
    }

    if (!objectUrl) {
      this.stickerImageLoading = false;
      this.stickerImageError = true;
      this.currentStickerRenderKey = '';
      return;
    }

    this.stickerObjectUrl = objectUrl;
    this.renderableImageUrl = objectUrl;
  }

  private clearStickerObjectUrl(): void {
    if (!this.stickerObjectUrl) {
      return;
    }

    window.URL.revokeObjectURL(this.stickerObjectUrl);
    this.stickerObjectUrl = null;
  }

}
