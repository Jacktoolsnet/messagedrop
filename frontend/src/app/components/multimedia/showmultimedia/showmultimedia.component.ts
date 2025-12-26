
import { Component, Input, OnChanges, SimpleChanges, inject } from '@angular/core';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import { Multimedia } from '../../../interfaces/multimedia';
import { AppService } from '../../../services/app.service';
import { EnableExternalContentComponent } from '../../utils/enable-external-content/enable-external-content.component';

@Component({
  selector: 'app-showmultimedia',
  imports: [
    MatSlideToggleModule,
    EnableExternalContentComponent,
    TranslocoPipe
],
  templateUrl: './showmultimedia.component.html',
  styleUrl: './showmultimedia.component.css'
})
export class ShowmultimediaComponent implements OnChanges {
  @Input() multimedia: Multimedia | undefined;

  termsLinks?: { terms: string; privacy: string };

  safeUrl: SafeResourceUrl | undefined; // for iframe URLs if needed later
  safeHtml: SafeHtml | undefined;

  // Activation logic
  isPlatformEnabled = false;

  private readonly sanitizer = inject(DomSanitizer);
  private readonly appService = inject(AppService);

  ngOnChanges(changes: SimpleChanges) {
    if ('multimedia' in changes) {
      this.updateFromMultimedia();
    }
  }

  private updateFromMultimedia(): void {
    const settings = this.appService.getAppSettings();
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
      default:
        this.isPlatformEnabled = true; // Unknown -> do not block.
        break;
    }

    this.safeHtml = this.isPlatformEnabled
      ? this.sanitizer.bypassSecurityTrustHtml(this.multimedia?.oembed?.html ?? '')
      : undefined;
  }

  onEnabledChange(enabled: boolean) {
    this.isPlatformEnabled = enabled;
    if (enabled) {
      this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(this.multimedia?.oembed?.html ?? '');
    }
  }

}
