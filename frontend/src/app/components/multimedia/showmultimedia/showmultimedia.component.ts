
import { Component, Input, OnChanges, SimpleChanges, effect, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { Multimedia } from '../../../interfaces/multimedia';
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

  safeHtml: string | undefined;

  // Activation logic
  isPlatformEnabled = false;
  disabledReason = '';
  showExternalSettingsButton = false;

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
    this.disabledReason = '';
    this.showExternalSettingsButton = false;
    switch (this.multimedia?.type) {
      case 'youtube':
        this.isPlatformEnabled = settings.enableYoutubeContent;
        break;
      case 'spotify':
        this.isPlatformEnabled = settings.enableSpotifyContent;
        break;
      case 'pinterest':
        this.isPlatformEnabled = settings.enablePinterestContent;
        break;
      case 'tiktok':
        this.isPlatformEnabled = settings.enableTikTokContent;
        break;
      case 'tenor':
        this.isPlatformEnabled = settings.enableTenorContent;
        break;
      case 'unsplash':
        this.isPlatformEnabled = settings.enableUnsplashContent;
        break;
      default:
        this.isPlatformEnabled = true; // Unknown -> do not block.
        break;
    }

    if (this.multimedia?.type && !this.isPlatformEnabled) {
      this.disabledReason = this.translation.t('common.multimedia.platformDisabled', {
        platform: this.getPlatformLabel(this.multimedia.type)
      });
      this.showExternalSettingsButton = true;
      this.safeHtml = undefined;
      return;
    }

    this.safeHtml = this.isPlatformEnabled && this.isOembedAllowed()
      ? (this.multimedia?.oembed?.html ?? '')
      : undefined;
  }

  openExternalContentSettings(): void {
    const dialogRef = this.dialog.open(ExternalContentComponent, {
      data: { appSettings: this.appService.getAppSettings() },
      maxWidth: '90vw',
      maxHeight: '90vh',
      width: 'min(700px, 90vw)',
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

  private isOembedAllowed(): boolean {
    return this.oembedService.isAllowedOembedSource(
      this.multimedia?.sourceUrl,
      this.multimedia?.oembed?.provider_url
    );
  }

  private getPlatformLabel(type: string): string {
    switch (type) {
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
