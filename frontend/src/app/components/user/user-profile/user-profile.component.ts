
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { Profile } from '../../../interfaces/profile';
import { StyleService } from '../../../services/style.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { UserService } from '../../../services/user.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    TranslocoPipe
  ],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.css'
})
export class UserProfileComponent {
  private readonly maxAvatarMb = 2;
  private readonly maxAvatarBytes = this.maxAvatarMb * 1024 * 1024;
  private readonly maxAvatarDimension = 256;
  private oriProfile: Profile;

  readonly userService = inject(UserService);
  private readonly styleService = inject(StyleService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  readonly dialogRef = inject(MatDialogRef<UserProfileComponent>);

  constructor() {
    this.oriProfile = structuredClone(this.userService.getProfile());
  }

  onAbortClick(): void {
    Object.assign(this.userService.getProfile(), this.oriProfile);
    this.dialogRef.close();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.snackBar.open(this.translation.t('common.user.profile.fileTypeInvalid'), this.translation.t('common.actions.ok'), {
        duration: 2000
      });
      return;
    }

    if (file.size > this.maxAvatarBytes) {
      this.snackBar.open(
        this.translation.t('common.user.profile.fileTooLarge', { maxSizeMb: this.maxAvatarMb }),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      return;
    }

    this.resizeAndCompressImage(file, this.maxAvatarDimension, this.maxAvatarBytes)
      .then((dataUrl) => {
        this.userService.getProfile().base64Avatar = dataUrl;
        input.value = '';
      })
      .catch((error: Error) => {
        if (error.message === 'too_large') {
          this.snackBar.open(
            this.translation.t('common.user.profile.fileTooLarge', { maxSizeMb: this.maxAvatarMb }),
            this.translation.t('common.actions.ok'),
            { duration: 2000 }
          );
          return;
        }
        this.snackBar.open(this.translation.t('common.user.profile.fileReadError'), this.translation.t('common.actions.ok'), {
          duration: 2000
        });
      });
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

  deleteAvatar(): void {
    this.userService.getProfile().base64Avatar = '';
  }

  showPolicy(): void {
    this.snackBar.open(this.translation.t('common.user.profile.policyHint'), this.translation.t('common.actions.ok'), {
      duration: 4000
    });
  }

  changeDefaultStyle(): void {
    this.userService.getProfile().defaultStyle = this.styleService.getRandomStyle();
  }
}
