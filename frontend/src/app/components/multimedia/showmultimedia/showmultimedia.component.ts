
import { Component, Input, OnChanges, SimpleChanges, effect, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import { environment } from '../../../../environments/environment';
import { EXTERNAL_CONTENT_SETTINGS_KEYS, ExternalContentPlatform, isExternalContentPlatform } from '../../../interfaces/external-content-platform';
import { Multimedia } from '../../../interfaces/multimedia';
import { MultimediaType } from '../../../interfaces/multimedia-type';
import { AppService } from '../../../services/app.service';
import { OembedService } from '../../../services/oembed.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { ExternalContentComponent } from '../../legal/external-content/external-content.component';

@Component({
  selector: 'app-showmultimedia',
  imports: [
    MatButtonModule,
    TranslocoPipe
  ],
  templateUrl: './showmultimedia.component.html',
  styleUrl: './showmultimedia.component.css'
})
export class ShowmultimediaComponent implements OnChanges {
  @Input() multimedia: Multimedia | undefined;

  termsLinks?: { terms: string; privacy: string };

  safeHtml: SafeHtml | undefined;

  // Activation logic
  isPlatformEnabled = false;
  disabledReason = '';
  showExternalSettingsButton = false;

  private readonly sanitizer = inject(DomSanitizer);
  private readonly dialog = inject(MatDialog);
  private readonly appService = inject(AppService);
  private readonly oembedService = inject(OembedService);
  private readonly translation = inject(TranslationHelperService);
  private readonly settingsEffect = effect(() => {
    this.appService.settingsSet();
    this.updateFromMultimedia();
  });

  ngOnChanges(changes: SimpleChanges) {
    if ('multimedia' in changes) {
      this.updateFromMultimedia();
    }
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
      return;
    }

    this.safeHtml = this.isPlatformEnabled && this.isOembedAllowed()
      ? this.sanitizer.bypassSecurityTrustHtml(this.multimedia?.oembed?.html ?? '')
      : undefined;
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
    if (!this.multimedia) {
      return '';
    }
    if (this.multimedia.type === MultimediaType.STICKER && this.multimedia.contentId) {
      return `${environment.apiUrl}/stickers/render/${encodeURIComponent(this.multimedia.contentId)}?variant=chat`;
    }
    return this.multimedia.url || '';
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

}
