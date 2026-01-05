import { ChangeDetectionStrategy, ChangeDetectorRef, Component, NgZone, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';


import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { Mode } from '../../../interfaces/mode';
import { Place } from '../../../interfaces/place';
import { TileSetting, normalizeTileSettings } from '../../../interfaces/tile-settings';
import { TranslationHelperService } from '../../../services/translation-helper.service';

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
  private readonly maxBackgroundBytes = 2 * 1024 * 1024; // 2MB
  private readonly maxBackgroundDimension = 1600;
  private oriName: string | undefined = undefined;
  private oriBase64Avatar: string | undefined = undefined;
  private oriBackgroundImage: string | undefined = undefined;
  private oriBackgroundTransparency: number | undefined = undefined;
  private oriIcon: string | undefined = undefined;
  private oriTileSettings: TileSetting[] | undefined = undefined;

  readonly dialogRef = inject(MatDialogRef<PlaceProfileComponent>);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  readonly data = inject<{ mode: Mode, place: Place }>(MAT_DIALOG_DATA);

  constructor() {
    this.oriName = this.data.place.name;
    this.oriBase64Avatar = this.data.place.base64Avatar;
    this.oriBackgroundImage = this.data.place.placeBackgroundImage;
    this.oriBackgroundTransparency = this.data.place.placeBackgroundTransparency;
    this.oriIcon = this.data.place.icon;
    const normalizedTileSettings = normalizeTileSettings(this.data.place.tileSettings);
    this.oriTileSettings = normalizedTileSettings.map((tile: TileSetting) => ({ ...tile }));
    this.data.place.tileSettings = normalizedTileSettings;
    if (this.data.place.placeBackgroundTransparency == null) {
      this.data.place.placeBackgroundTransparency = 40;
    }
  }

  onApplyClick(): void {
    this.dialogRef.close();
  }

  onAbortClick(): void {
    if (undefined != this.oriName) {
      this.data.place.name = this.oriName;
    }
    if (undefined != this.oriBase64Avatar) {
      this.data.place.base64Avatar = this.oriBase64Avatar;
    }
    this.data.place.placeBackgroundImage = this.oriBackgroundImage;
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

    if (file.size > this.maxFileSize) {
      this.snackBar.open(
        this.translation.t('common.placeSettings.imageTooLarge'),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      this.ngZone.run(() => {
        this.data.place.base64Avatar = (e.target as FileReader).result as string;
        this.cdr.markForCheck();
      });
    };
    reader.onerror = () => {
      this.ngZone.run(() => {
        this.snackBar.open(
          this.translation.t('common.placeSettings.imageReadError'),
          this.translation.t('common.actions.ok'),
          { duration: 2000 }
        );
      });
    };

    reader.readAsDataURL(file);
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
      .then((dataUrl) => {
        this.ngZone.run(() => {
          this.data.place.placeBackgroundImage = dataUrl;
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

  deleteAvatar() {
    this.data.place.base64Avatar = '';
    this.cdr.markForCheck();
  }

  deletePlaceBackground() {
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
