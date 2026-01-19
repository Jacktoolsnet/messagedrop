import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { ImageCroppedEvent, ImageCropperComponent } from 'ngx-image-cropper';
import { TranslationHelperService } from '../../../services/translation-helper.service';

export interface AvatarCropperData {
  file: File;
  maxSizeMb?: number;
  resizeToWidth?: number;
  maintainAspectRatio?: boolean;
  aspectRatio?: number;
  containWithinAspectRatio?: boolean;
  titleKey?: string;
  hintKey?: string;
}

@Component({
  selector: 'app-avatar-cropper',
  standalone: true,
  imports: [
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatIcon,
    TranslocoPipe,
    ImageCropperComponent
  ],
  templateUrl: './avatar-cropper.component.html',
  styleUrl: './avatar-cropper.component.css'
})
export class AvatarCropperComponent {
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  readonly dialogRef = inject(MatDialogRef<AvatarCropperComponent>);
  readonly data = inject<AvatarCropperData>(MAT_DIALOG_DATA);

  readonly resizeToWidth = this.data.resizeToWidth ?? 256;
  readonly maxBytes = (this.data.maxSizeMb ?? 10) * 1024 * 1024;
  readonly maintainAspectRatio = this.data.maintainAspectRatio ?? true;
  readonly aspectRatio = this.data.aspectRatio ?? 1;
  readonly containWithinAspectRatio = this.data.containWithinAspectRatio ?? true;
  readonly titleKey = this.data.titleKey ?? 'common.avatarCropper.title';
  readonly hintKey = this.data.hintKey ?? 'common.avatarCropper.hint';

  imageBase64 = '';
  croppedImage = '';
  isLoading = true;

  constructor() {
    this.loadFile(this.data.file);
  }

  onImageCropped(event: ImageCroppedEvent): void {
    if (event.base64) {
      this.croppedImage = event.base64;
      this.isLoading = false;
    }
  }

  onImageLoaded(): void {
    this.isLoading = false;
  }

  onLoadImageFailed(): void {
    this.snackBar.open(
      this.translation.t('common.avatarCropper.loadFailed'),
      this.translation.t('common.actions.ok'),
      { duration: 2500 }
    );
    this.dialogRef.close();
  }

  onAbort(): void {
    this.dialogRef.close();
  }

  onApply(): void {
    const image = this.croppedImage;
    if (!image) {
      return;
    }
    if (this.isTooLarge(image)) {
      this.snackBar.open(
        this.translation.t('common.avatarCropper.tooLarge', { maxMb: this.data.maxSizeMb ?? 10 }),
        this.translation.t('common.actions.ok'),
        { duration: 2500 }
      );
      return;
    }
    this.dialogRef.close(image);
  }

  private loadFile(file: File): void {
    const reader = new FileReader();
    reader.onload = () => {
      this.imageBase64 = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.onerror = () => {
      this.onLoadImageFailed();
    };
    reader.readAsDataURL(file);
  }

  private isTooLarge(dataUrl: string): boolean {
    const base64 = dataUrl.split(',')[1] ?? '';
    const bytes = Math.floor((base64.length * 3) / 4);
    return bytes > this.maxBytes;
  }
}
