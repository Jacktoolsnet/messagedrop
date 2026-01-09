
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { Profile } from '../../../interfaces/profile';
import { AvatarStorageService } from '../../../services/avatar-storage.service';
import { StyleService } from '../../../services/style.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { UserService } from '../../../services/user.service';
import { AvatarCropperComponent } from '../../utils/avatar-cropper/avatar-cropper.component';

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
  private readonly dialog = inject(MatDialog);
  private readonly avatarStorage = inject(AvatarStorageService);
  readonly dialogRef = inject(MatDialogRef<UserProfileComponent>);

  constructor() {
    this.oriProfile = structuredClone(this.userService.getProfile());
  }

  async onAbortClick(): Promise<void> {
    const currentId = this.userService.getProfile().avatarFileId;
    if (currentId && currentId !== this.oriProfile.avatarFileId) {
      await this.avatarStorage.deleteImage(currentId);
    }
    Object.assign(this.userService.getProfile(), this.oriProfile);
    this.userService.notifyProfileChanged();
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

    if (!this.avatarStorage.isSupported()) {
      this.showStorageUnsupported();
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
        input.value = '';
        return;
      }
      const currentId = this.userService.getProfile().avatarFileId;
      if (currentId && currentId !== this.oriProfile.avatarFileId) {
        await this.avatarStorage.deleteImage(currentId);
      }
      const saved = await this.avatarStorage.saveImageFromDataUrl('avatar', croppedImage);
      if (!saved) {
        this.showStorageUnsupported();
        input.value = '';
        return;
      }
      this.userService.getProfile().avatarFileId = saved.id;
      this.userService.getProfile().base64Avatar = saved.url;
      this.userService.notifyProfileChanged();
      input.value = '';
    });
  }

  async deleteAvatar(): Promise<void> {
    const currentId = this.userService.getProfile().avatarFileId;
    if (currentId && currentId !== this.oriProfile.avatarFileId) {
      await this.avatarStorage.deleteImage(currentId);
    }
    this.userService.getProfile().avatarFileId = undefined;
    this.userService.getProfile().base64Avatar = '';
    this.userService.notifyProfileChanged();
  }

  async onApplyClick(): Promise<void> {
    const originalId = this.oriProfile.avatarFileId;
    const currentId = this.userService.getProfile().avatarFileId;
    if (originalId && originalId !== currentId) {
      await this.avatarStorage.deleteImage(originalId);
    }
    this.userService.notifyProfileChanged();
    this.dialogRef.close(this.userService.getProfile());
  }

  showPolicy(): void {
    this.snackBar.open(this.translation.t('common.user.profile.policyHint'), this.translation.t('common.actions.ok'), {
      duration: 4000
    });
  }

  changeDefaultStyle(): void {
    this.userService.getProfile().defaultStyle = this.styleService.getRandomStyle();
    this.userService.notifyProfileChanged();
  }

  private showStorageUnsupported(): void {
    this.snackBar.open(this.translation.t('common.media.storageUnsupported'), this.translation.t('common.actions.ok'), {
      duration: 2500
    });
  }
}
