import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Multimedia } from '../../../interfaces/multimedia';
import { AppService } from '../../../services/app.service';
import { OembedService } from '../../../services/oembed.service';
import { EnableExternalContentComponent } from '../enable-external-content/enable-external-content.component';

type PlatformKey = 'youtube' | 'spotify' | 'tiktok' | 'pinterest';
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
    EnableExternalContentComponent
  ],
  templateUrl: './import-multimedia.component.html',
  styleUrl: './import-multimedia.component.css'
})
export class ImportMultimediaComponent {
  multimediaUrl = '';
  multimedia?: Multimedia;
  urlInvalid = true;
  safeHtml?: SafeHtml;
  disabledReason = '';

  readonly dialogRef = inject(MatDialogRef<ImportMultimediaComponent>);
  private readonly oembedService = inject(OembedService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly appService = inject(AppService);

  private getPlatformFromUrl(url: string): PlatformKey | undefined {
    try {
      const u = new URL(url.toLowerCase());
      const h = u.hostname;
      if (h.includes('youtube.com') || h.includes('youtu.be')) return 'youtube';
      if (h.includes('spotify.com')) return 'spotify';
      if (h.includes('tiktok.com')) return 'tiktok';
      if (h.includes('pinterest.com') || h.includes('pin.it')) return 'pinterest';
    } catch { /* ignore parse errors */ }
    return undefined;
  }

  async validateUrl(): Promise<void> {
    this.disabledReason = '';
    this.safeHtml = undefined;
    this.multimedia = undefined;

    const platform = this.getPlatformFromUrl(this.multimediaUrl);
    let platformEnabled = false;

    switch (platform) {
      case 'pinterest':
        platformEnabled = this.appService.getAppSettings().enablePinterestContent;
        break;
      case 'spotify':
        platformEnabled = this.appService.getAppSettings().enableSpotifyContent;
        break;
      case 'tiktok':
        platformEnabled = this.appService.getAppSettings().enableTikTokContent;
        break;
      case 'youtube':
        platformEnabled = this.appService.getAppSettings().enableYoutubeContent;
        break;
    }

    if (platform && !platformEnabled) {
      this.urlInvalid = true;
      this.safeHtml = undefined;
      this.disabledReason = `This platform (${platform}) is currently disabled. Enable it below to continue.`;
      return;
    }

    // OEmbed nur, wenn Plattform erlaubt (oder unbekannt)
    this.multimedia = await this.oembedService.getObjectFromUrl(this.multimediaUrl) as Multimedia;
    if (this.multimedia) {
      this.disabledReason = '';
      this.urlInvalid = false;
      this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(this.multimedia.oembed?.html ?? '');
    } else {
      this.urlInvalid = true;
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

  async onEnabledChange(enabled: boolean): Promise<void> {
    void enabled;
    await this.validateUrl();
  }
}
