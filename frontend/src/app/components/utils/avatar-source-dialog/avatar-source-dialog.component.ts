import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppSettings } from '../../../interfaces/app-settings';
import { AppService } from '../../../services/app.service';
import { EnableExternalContentComponent } from '../enable-external-content/enable-external-content.component';
import { HelpDialogService } from '../help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../dialog-header/dialog-header.component';
import { StickerPickerComponent } from '../sticker-picker/sticker-picker.component';
import { Multimedia } from '../../../interfaces/multimedia';

export type AvatarSourceChoice = 'file' | 'unsplash' | 'camera';
export type AvatarSourceResult = AvatarSourceChoice | { stickerId: string };

export interface AvatarSourceDialogData {
  titleKey?: string;
  icon?: string;
  fileLabelKey?: string;
  unsplashLabelKey?: string;
  showCamera?: boolean;
  showSticker?: boolean;
  cameraLabelKey?: string;
}

@Component({
  selector: 'app-avatar-source-dialog',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    MatButtonModule,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatIcon,
    TranslocoPipe,
    EnableExternalContentComponent
  ],
  templateUrl: './avatar-source-dialog.component.html',
  styleUrl: './avatar-source-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AvatarSourceDialogComponent {
  private readonly appService = inject(AppService);
  private readonly dialog = inject(MatDialog);
  readonly help = inject(HelpDialogService);
  private readonly dialogRef = inject(MatDialogRef<AvatarSourceDialogComponent, AvatarSourceResult | undefined>);
  private readonly data = inject<AvatarSourceDialogData | null>(MAT_DIALOG_DATA, { optional: true });

  readonly titleKey = this.data?.titleKey ?? 'common.avatarSource.title';
  readonly icon = this.data?.icon ?? 'account_circle';
  readonly fileLabelKey = this.data?.fileLabelKey ?? 'common.avatarSource.file';
  readonly unsplashLabelKey = this.data?.unsplashLabelKey ?? 'common.avatarSource.unsplash';
  readonly cameraLabelKey = this.data?.cameraLabelKey ?? 'common.avatarSource.camera';
  readonly showCamera = !!this.data?.showCamera && this.hasCameraSupport();
  readonly showSticker = this.data?.showSticker !== false;

  showUnsplash = this.appService.getAppSettings().enableUnsplashContent;

  chooseFile(): void {
    this.dialogRef.close('file');
  }

  chooseUnsplash(): void {
    this.dialogRef.close('unsplash');
  }

  chooseCamera(): void {
    this.dialogRef.close('camera');
  }

  chooseSticker(): void {
    const stickerDialogRef = this.dialog.open(StickerPickerComponent, {
      closeOnNavigation: true,
      width: 'min(920px, 95vw)',
      maxWidth: '95vw',
      maxHeight: '95vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
    stickerDialogRef.afterClosed().subscribe((multimedia?: Multimedia | null) => {
      const stickerId = multimedia?.contentId?.trim();
      if (stickerId) this.dialogRef.close({ stickerId });
    });
  }

  onEnabledChange(enabled: boolean): void {
    const current = this.appService.getAppSettings();
    const updated: AppSettings = { ...current, enableUnsplashContent: enabled };
    this.appService.setAppSettings(updated);
    this.showUnsplash = enabled;
  }

  private hasCameraSupport(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }
}
