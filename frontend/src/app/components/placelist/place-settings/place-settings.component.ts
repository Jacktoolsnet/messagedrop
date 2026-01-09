import { ChangeDetectionStrategy, ChangeDetectorRef, Component, NgZone, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';


import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { Mode } from '../../../interfaces/mode';
import { AvatarAttribution } from '../../../interfaces/avatar-attribution';
import { Place } from '../../../interfaces/place';
import { UnsplashPhoto } from '../../../interfaces/unsplash-response';
import { TileSetting, normalizeTileSettings } from '../../../interfaces/tile-settings';
import { AvatarStorageService } from '../../../services/avatar-storage.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { AvatarCropperComponent } from '../../utils/avatar-cropper/avatar-cropper.component';
import { AvatarSourceDialogComponent, AvatarSourceChoice } from '../../utils/avatar-source-dialog/avatar-source-dialog.component';
import { UnsplashComponent } from '../../utils/unsplash/unsplash.component';

@Component({
  selector: 'app-place',
  imports: [
    FormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogClose,
    MatDialogTitle,
    MatDialogContent,
    MatDialogModule,
    MatIcon,
    MatFormFieldModule,
    MatInputModule,
    MatSliderModule,
    TranslocoPipe
  ],
  templateUrl: './place-settings.component.html',
  styleUrl: './place-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaceProfileComponent {

  private maxFileSize = 5 * 1024 * 1024; // 5MB
  private readonly maxAvatarMb = 2;
  private readonly maxAvatarDimension = 256;
  private readonly maxBackgroundBytes = 2 * 1024 * 1024; // 2MB
  private readonly maxBackgroundDimension = 1600;
  private oriName: string | undefined = undefined;
  private oriBase64Avatar: string | undefined = undefined;
  private oriAvatarFileId: string | undefined = undefined;
  private oriBackgroundImage: string | undefined = undefined;
  private oriBackgroundFileId: string | undefined = undefined;
  private oriBackgroundTransparency: number | undefined = undefined;
  private oriIcon: string | undefined = undefined;
  private oriTileSettings: TileSetting[] | undefined = undefined;
  private oriAvatarAttribution: AvatarAttribution | undefined = undefined;

  readonly dialogRef = inject(MatDialogRef<PlaceProfileComponent>);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly dialog = inject(MatDialog);
  private readonly avatarStorage = inject(AvatarStorageService);
  readonly data = inject<{ mode: Mode, place: Place }>(MAT_DIALOG_DATA);

  constructor() {
    this.oriName = this.data.place.name;
    this.oriBase64Avatar = this.data.place.base64Avatar;
    this.oriAvatarFileId = this.data.place.avatarFileId;
    this.oriBackgroundImage = this.data.place.placeBackgroundImage;
    this.oriBackgroundFileId = this.data.place.placeBackgroundFileId;
    this.oriBackgroundTransparency = this.data.place.placeBackgroundTransparency;
    this.oriIcon = this.data.place.icon;
    this.oriAvatarAttribution = this.data.place.avatarAttribution;
    const normalizedTileSettings = normalizeTileSettings(this.data.place.tileSettings);
    this.oriTileSettings = normalizedTileSettings.map((tile: TileSetting) => ({ ...tile }));
    this.data.place.tileSettings = normalizedTileSettings;
    if (this.data.place.placeBackgroundTransparency == null) {
      this.data.place.placeBackgroundTransparency = 40;
    }
  }

  async onApplyClick(): Promise<void> {
    if (this.oriAvatarFileId && this.oriAvatarFileId !== this.data.place.avatarFileId) {
      await this.avatarStorage.deleteImage(this.oriAvatarFileId);
    }
    if (this.oriBackgroundFileId && this.oriBackgroundFileId !== this.data.place.placeBackgroundFileId) {
      await this.avatarStorage.deleteImage(this.oriBackgroundFileId);
    }
    this.dialogRef.close();
  }

  async onAbortClick(): Promise<void> {
    if (this.data.place.avatarFileId && this.data.place.avatarFileId !== this.oriAvatarFileId) {
      await this.avatarStorage.deleteImage(this.data.place.avatarFileId);
    }
    if (this.data.place.placeBackgroundFileId && this.data.place.placeBackgroundFileId !== this.oriBackgroundFileId) {
      await this.avatarStorage.deleteImage(this.data.place.placeBackgroundFileId);
    }
    if (undefined != this.oriName) {
      this.data.place.name = this.oriName;
    }
    if (undefined != this.oriBase64Avatar) {
      this.data.place.base64Avatar = this.oriBase64Avatar;
    }
    this.data.place.avatarFileId = this.oriAvatarFileId;
    this.data.place.avatarAttribution = this.oriAvatarAttribution;
    this.data.place.placeBackgroundImage = this.oriBackgroundImage;
    this.data.place.placeBackgroundFileId = this.oriBackgroundFileId;
    this.data.place.placeBackgroundTransparency = this.oriBackgroundTransparency;
    if (undefined != this.oriIcon) {
      this.data.place.icon = this.oriIcon;
    }
    if (this.oriTileSettings) {
      this.data.place.tileSettings = this.oriTileSettings.map(tile => ({ ...tile }));
    }
    this.dialogRef.close();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.snackBar.open(
        this.translation.t('common.placeSettings.imageInvalid'),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      return;
    }

    const dialogRef = this.dialog.open(AvatarCropperComponent, {
      data: {
        file,
        maxSizeMb: this.maxAvatarMb,
        resizeToWidth: this.maxAvatarDimension
      },
      maxWidth: '95vw',
      width: '420px'
    });

    dialogRef.afterClosed().subscribe(async (croppedImage?: string) => {
      this.ngZone.run(async () => {
        if (!croppedImage) {
          input.value = '';
          return;
        }
        if (!this.avatarStorage.isSupported()) {
          this.showStorageUnsupported();
          input.value = '';
          return;
        }
        if (this.data.place.avatarFileId && this.data.place.avatarFileId !== this.oriAvatarFileId) {
          await this.avatarStorage.deleteImage(this.data.place.avatarFileId);
        }
        const saved = await this.avatarStorage.saveImageFromDataUrl('avatar', croppedImage);
        if (!saved) {
          this.showStorageUnsupported();
          input.value = '';
          return;
        }
        this.data.place.avatarFileId = saved.id;
        this.data.place.base64Avatar = saved.url;
        this.data.place.avatarAttribution = undefined;
        this.cdr.markForCheck();
        input.value = '';
      });
    });
  }

  onBackgroundFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.snackBar.open(
        this.translation.t('common.placeSettings.imageInvalid'),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      return;
    }

    if (file.size > this.maxFileSize) {
      this.snackBar.open(
        this.translation.t('common.placeSettings.backgroundTooLarge', { maxMb: 5 }),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      return;
    }

    this.resizeAndCompressImage(file, this.maxBackgroundDimension, this.maxBackgroundBytes)
      .then(async (dataUrl) => {
        this.ngZone.run(async () => {
          if (!this.avatarStorage.isSupported()) {
            this.showStorageUnsupported();
            input.value = '';
            return;
          }
          if (this.data.place.placeBackgroundFileId && this.data.place.placeBackgroundFileId !== this.oriBackgroundFileId) {
            await this.avatarStorage.deleteImage(this.data.place.placeBackgroundFileId);
          }
          const saved = await this.avatarStorage.saveImageFromDataUrl('background', dataUrl);
          if (!saved) {
            this.showStorageUnsupported();
            input.value = '';
            return;
          }
          this.data.place.placeBackgroundFileId = saved.id;
          this.data.place.placeBackgroundImage = saved.url;
          if (this.data.place.placeBackgroundTransparency == null) {
            this.data.place.placeBackgroundTransparency = 40;
          }
          this.cdr.markForCheck();
          input.value = '';
        });
      })
      .catch((error: Error) => {
        this.ngZone.run(() => {
          if (error.message === 'too_large') {
            this.snackBar.open(
              this.translation.t('common.placeSettings.backgroundTooLarge', { maxMb: 2 }),
              this.translation.t('common.actions.ok'),
              { duration: 2000 }
            );
            return;
          }
          this.snackBar.open(
            this.translation.t('common.placeSettings.imageReadError'),
            this.translation.t('common.actions.ok'),
            { duration: 2000 }
          );
        });
      });
  }

  async deleteAvatar() {
    if (this.data.place.avatarFileId && this.data.place.avatarFileId !== this.oriAvatarFileId) {
      await this.avatarStorage.deleteImage(this.data.place.avatarFileId);
    }
    this.data.place.avatarFileId = undefined;
    this.data.place.base64Avatar = '';
    this.data.place.avatarAttribution = undefined;
    this.cdr.markForCheck();
  }

  async deletePlaceBackground() {
    if (this.data.place.placeBackgroundFileId && this.data.place.placeBackgroundFileId !== this.oriBackgroundFileId) {
      await this.avatarStorage.deleteImage(this.data.place.placeBackgroundFileId);
    }
    this.data.place.placeBackgroundFileId = undefined;
    this.data.place.placeBackgroundImage = '';
    this.cdr.markForCheck();
  }

  getPlaceBackgroundPreviewImage(): string {
    return this.data.place.placeBackgroundImage ? `url(${this.data.place.placeBackgroundImage})` : 'none';
  }

  getPlaceBackgroundPreviewOpacity(): number {
    const transparency = this.data.place.placeBackgroundTransparency ?? 40;
    const clamped = Math.min(Math.max(transparency, 0), 100);
    return 1 - clamped / 100;
  }

  private showStorageUnsupported(): void {
    this.snackBar.open(
      this.translation.t('common.media.storageUnsupported'),
      this.translation.t('common.actions.ok'),
      { duration: 2500 }
    );
  }

  private async resizeAndCompressImage(file: File, maxDimension: number, maxBytes: number): Promise<string> {
    const image = await this.loadImage(file);
    const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
    const targetWidth = Math.max(1, Math.round(image.width * scale));
    const targetHeight = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('canvas');
    }

    ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

    let quality = 0.86;
    let dataUrl = canvas.toDataURL('image/jpeg', quality);
    let bytes = this.estimateDataUrlBytes(dataUrl);

    while (bytes > maxBytes && quality > 0.6) {
      quality = Math.max(quality - 0.08, 0.6);
      dataUrl = canvas.toDataURL('image/jpeg', quality);
      bytes = this.estimateDataUrlBytes(dataUrl);
    }

    if (bytes > maxBytes) {
      throw new Error('too_large');
    }

    return dataUrl;
  }

  openAvatarSourceDialog(fileInput: HTMLInputElement): void {
    const dialogRef = this.dialog.open(AvatarSourceDialogComponent, {
      panelClass: '',
      closeOnNavigation: true,
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((choice?: AvatarSourceChoice) => {
      if (choice === 'file') {
        fileInput.click();
        return;
      }
      if (choice === 'unsplash') {
        this.openUnsplashAvatar();
      }
    });
  }

  private openUnsplashAvatar(): void {
    const dialogRef = this.dialog.open(UnsplashComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { returnType: 'photo' },
      maxWidth: '95vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((photo?: UnsplashPhoto) => {
      if (!photo) {
        return;
      }
      void this.applyUnsplashPhoto(photo);
    });
  }

  private async applyUnsplashPhoto(photo: UnsplashPhoto): Promise<void> {
    const file = await this.loadUnsplashFile(photo);
    if (!file) {
      this.snackBar.open(
        this.translation.t('common.avatarCropper.loadFailed'),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      return;
    }

    const dialogRef = this.dialog.open(AvatarCropperComponent, {
      data: {
        file,
        maxSizeMb: this.maxAvatarMb,
        resizeToWidth: this.maxAvatarDimension
      },
      maxWidth: '95vw',
      width: '420px'
    });

    dialogRef.afterClosed().subscribe(async (croppedImage?: string) => {
      if (!croppedImage) {
        return;
      }
      if (!this.avatarStorage.isSupported()) {
        this.showStorageUnsupported();
        return;
      }
      if (this.data.place.avatarFileId && this.data.place.avatarFileId !== this.oriAvatarFileId) {
        await this.avatarStorage.deleteImage(this.data.place.avatarFileId);
      }
      const saved = await this.avatarStorage.saveImageFromDataUrl('avatar', croppedImage);
      if (!saved) {
        this.showStorageUnsupported();
        return;
      }
      this.data.place.avatarFileId = saved.id;
      this.data.place.base64Avatar = saved.url;
      this.data.place.avatarAttribution = this.buildUnsplashAttribution(photo);
      this.cdr.markForCheck();
    });
  }

  private async loadUnsplashFile(photo: UnsplashPhoto): Promise<File | null> {
    try {
      const response = await fetch(photo.urls.regular);
      if (!response.ok) {
        return null;
      }
      const blob = await response.blob();
      return new File([blob], `unsplash-${photo.id}.jpg`, { type: blob.type || 'image/jpeg' });
    } catch {
      return null;
    }
  }

  private buildUnsplashAttribution(photo: UnsplashPhoto): AvatarAttribution {
    const authorName = photo.user?.name || photo.user?.username || 'Unsplash';
    const baseUrl = photo.links?.html ?? `https://unsplash.com/photos/${photo.id}`;
    const url = new URL(baseUrl);
    url.searchParams.set('utm_source', 'messagedrop');
    url.searchParams.set('utm_medium', 'referral');
    return {
      source: 'unsplash',
      authorName,
      photoUrl: url.toString()
    };
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('load_failed'));
      };
      image.src = url;
    });
  }

  private estimateDataUrlBytes(dataUrl: string): number {
    const base64 = dataUrl.split(',')[1] ?? '';
    return Math.floor((base64.length * 3) / 4);
  }

  public showPolicy() {
    this.snackBar.open(
      this.translation.t('common.placeSettings.savePolicy'),
      this.translation.t('common.actions.ok'),
      {}
    );
  }

}
