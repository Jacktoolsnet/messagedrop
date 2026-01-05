import { Component, ViewChild, inject } from '@angular/core';
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
  readonly maxBytes = (this.data.maxSizeMb ?? 2) * 1024 * 1024;

  imageBase64 = '';
  croppedImage = '';
  isLoading = true;

  @ViewChild(ImageCropperComponent) private cropper?: ImageCropperComponent;

  constructor() {
    this.loadFile(this.data.file);
  }

  onImageCropped(event: ImageCroppedEvent): void {
    if (event.base64) {
      this.croppedImage = event.base64;
    }
  }

  onImageLoaded(): void {
    this.isLoading = false;
    this.ensureInitialCrop();
  }

  onCropperReady(): void {
    this.ensureInitialCrop();
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
    const image = this.croppedImage || this.cropper?.crop('base64')?.base64 || '';
    if (!image) {
      return;
    }
    if (this.isTooLarge(image)) {
      this.snackBar.open(
        this.translation.t('common.avatarCropper.tooLarge', { maxMb: this.data.maxSizeMb ?? 2 }),
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

  private ensureInitialCrop(): void {
    if (this.croppedImage || !this.cropper) {
      return;
    }
    const cropped = this.cropper.crop('base64');
    if (cropped?.base64) {
      this.croppedImage = cropped.base64;
    }
  }

  private isTooLarge(dataUrl: string): boolean {
    const base64 = dataUrl.split(',')[1] ?? '';
    const bytes = Math.floor((base64.length * 3) / 4);
    return bytes > this.maxBytes;
  }
}
