
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { Profile } from '../../../interfaces/profile';
import { TranslationHelperService } from '../../../services/translation-helper.service';

@Component({
  selector: 'app-edit-user',
  imports: [
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatIcon,
    TranslocoPipe
],
  templateUrl: './message-profile.component.html',
  styleUrl: './message-profile.component.css'
})
export class MessageProfileComponent {
  private readonly maxAvatarMb = 2;
  private readonly maxAvatarBytes = this.maxAvatarMb * 1024 * 1024;
  private readonly maxAvatarDimension = 256;
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  readonly dialogRef = inject(MatDialogRef<MessageProfileComponent>);
  readonly data = inject<{ profile: Profile; userId: string }>(MAT_DIALOG_DATA);

  public profile: Profile;
  public userId: string;
  private readonly oriProfile: Profile;

  constructor() {
    this.profile = this.data.profile ?? { name: '', base64Avatar: '' };
    this.oriProfile = structuredClone(this.profile);
    this.userId = this.data.userId;
  }

  onAbortClick(): void {
    Object.assign(this.profile, this.oriProfile);
    this.dialogRef.close();
  }

  onApplyClick(): void {
    Object.assign(this.data.profile, this.profile);
    this.dialogRef.close();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.snackBar.open(
        this.translation.t('common.messageProfile.fileTypeInvalid'),
        this.translation.t('common.actions.ok'),
        { duration: 2500 }
      );
      return;
    }

    if (file.size > this.maxAvatarBytes) {
      this.snackBar.open(
        this.translation.t('common.messageProfile.fileTooLarge', { maxMb: this.maxAvatarMb }),
        this.translation.t('common.actions.ok'),
        { duration: 2500 }
      );
      return;
    }

    this.resizeAndCompressImage(file, this.maxAvatarDimension, this.maxAvatarBytes)
      .then((dataUrl) => {
        this.profile.base64Avatar = dataUrl;
        if (input) {
          input.value = '';
        }
      })
      .catch((error: Error) => {
        if (error.message === 'too_large') {
          this.snackBar.open(
            this.translation.t('common.messageProfile.fileTooLarge', { maxMb: this.maxAvatarMb }),
            this.translation.t('common.actions.ok'),
            { duration: 2500 }
          );
          return;
        }
        this.handleFileError();
      });
  }

  handleFileError(): void {
    this.snackBar.open(
      this.translation.t('common.messageProfile.fileReadFailed'),
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

    let quality = 0.9;
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

  deleteAvatar() {
    this.profile.base64Avatar = '';
  }

  public showPolicy() {
    this.snackBar.open(
      this.translation.t('common.messageProfile.policy'),
      this.translation.t('common.actions.ok'),
      {}
    );
  }
}
