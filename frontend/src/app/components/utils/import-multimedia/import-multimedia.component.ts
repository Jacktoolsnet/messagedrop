
import { Component, ElementRef, ViewChild, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import { Multimedia } from '../../../interfaces/multimedia';
import { AppService } from '../../../services/app.service';
import { OembedService } from '../../../services/oembed.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { ExternalContentComponent } from '../../legal/external-content/external-content.component';
import { HelpDialogService } from '../help-dialog/help-dialog.service';

type PlatformKey = 'youtube' | 'spotify' | 'tiktok' | 'pinterest';
@Component({
  selector: 'app-pinterest', // (optional) kannst du umbenennen, z.B. 'app-import-multimedia'
  standalone: true,
  imports: [
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    MatButtonModule,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe
  ],
  templateUrl: './import-multimedia.component.html',
  styleUrl: './import-multimedia.component.css'
})
export class ImportMultimediaComponent {
  @ViewChild('urlInput') private urlInput?: ElementRef<HTMLInputElement>;

  multimediaUrl = '';
  multimedia?: Multimedia;
  urlInvalid = true;
  safeHtml?: SafeHtml;
  disabledReason = '';
  showExternalSettingsButton = false;
  isPasting = false;

  readonly dialogRef = inject(MatDialogRef<ImportMultimediaComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly oembedService = inject(OembedService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly appService = inject(AppService);
  private readonly translation = inject(TranslationHelperService);
  private readonly snackBar = inject(MatSnackBar);
  readonly help = inject(HelpDialogService);
  private readonly youtubeHosts = ['youtube.com', 'youtu.be'];
  private readonly spotifyHosts = ['open.spotify.com'];
  private readonly tiktokHosts = ['tiktok.com', 'vm.tiktok.com'];
  private readonly pinterestHosts = ['pinterest.com', 'pin.it'];
  private readonly settingsEffect = effect(() => {
    this.appService.settingsSet();
    if (this.multimediaUrl.trim()) {
      void this.validateUrl();
    }
  });

  private getPlatformFromUrl(url: string): PlatformKey | undefined {
    const host = this.getHostname(url);
    if (!host) {
      return undefined;
    }
    if (this.isAllowedHost(host, this.youtubeHosts)) return 'youtube';
    if (this.isAllowedHost(host, this.spotifyHosts)) return 'spotify';
    if (this.isAllowedHost(host, this.tiktokHosts)) return 'tiktok';
    if (this.isAllowedHost(host, this.pinterestHosts)) return 'pinterest';
    return undefined;
  }

  private getHostname(url: string): string | undefined {
    try {
      return new URL(url).hostname.toLowerCase();
    } catch {
      return undefined;
    }
  }

  private isAllowedHost(host: string, allowedHosts: string[]): boolean {
    return allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  }

  private getPlatformLabel(platform: PlatformKey): string {
    switch (platform) {
      case 'youtube':
        return 'YouTube';
      case 'spotify':
        return 'Spotify';
      case 'tiktok':
        return 'TikTok';
      case 'pinterest':
        return 'Pinterest';
    }
  }

  async validateUrl(): Promise<void> {
    this.disabledReason = '';
    this.showExternalSettingsButton = false;
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
      this.disabledReason = this.translation.t('common.multimedia.platformDisabled', {
        platform: this.getPlatformLabel(platform)
      });
      this.showExternalSettingsButton = true;
      return;
    }

    // OEmbed nur, wenn Plattform erlaubt (oder unbekannt)
    this.multimedia = await this.oembedService.getObjectFromUrl(this.multimediaUrl) as Multimedia;
    if (this.multimedia) {
      const isAllowed = this.oembedService.isAllowedOembedSource(
        this.multimedia.sourceUrl,
        this.multimedia.oembed?.provider_url
      );
      if (!isAllowed) {
        this.urlInvalid = true;
        this.safeHtml = undefined;
        this.disabledReason = this.translation.t('common.multimedia.urlNotAllowed');
        return;
      }
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

  async onPasteFromClipboard(event?: MouseEvent): Promise<void> {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
    if (!navigator?.clipboard) {
      this.snackBar.open(this.translation.t('common.clipboard.unavailable'), this.translation.t('common.actions.ok'), {
        panelClass: ['snack-warning'],
        duration: 3000
      });
      return;
    }
    if (this.isPasting) return;
    this.isPasting = true;
    try {
      this.urlInput?.nativeElement?.blur();
      const text = await navigator.clipboard.readText();
      this.multimediaUrl = text.trim();
      void this.validateUrl();
      queueMicrotask(() => this.urlInput?.nativeElement?.focus());
    } catch (err) {
      console.error('Failed to read clipboard', err);
      this.snackBar.open(this.translation.t('common.clipboard.readFailed'), this.translation.t('common.actions.ok'), {
        panelClass: ['snack-warning'],
        duration: 3000
      });
    } finally {
      this.isPasting = false;
    }
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
      void this.validateUrl();
    });
  }
}
