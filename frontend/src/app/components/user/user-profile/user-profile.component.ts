
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
import { AvatarAttribution } from '../../../interfaces/avatar-attribution';
import { UnsplashPhoto } from '../../../interfaces/unsplash-response';
import { AvatarCropperComponent } from '../../utils/avatar-cropper/avatar-cropper.component';
import { AvatarSourceDialogComponent, AvatarSourceChoice } from '../../utils/avatar-source-dialog/avatar-source-dialog.component';
import { UnsplashComponent } from '../../utils/unsplash/unsplash.component';
import { UnsplashService } from '../../../services/unsplash.service';

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
  private readonly maxAvatarDimension = 256;
  private oriProfile: Profile;

  readonly userService = inject(UserService);
  private readonly styleService = inject(StyleService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  private readonly dialog = inject(MatDialog);
  private readonly avatarStorage = inject(AvatarStorageService);
  private readonly unsplashService = inject(UnsplashService);
  readonly dialogRef = inject(MatDialogRef<UserProfileComponent>);

  constructor() {
    this.oriProfile = structuredClone(this.userService.getProfile());
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

    this.openAvatarCropper(file, undefined, input);
  }

  async deleteAvatar(): Promise<void> {
    const currentId = this.userService.getProfile().avatarFileId;
    if (currentId && currentId !== this.oriProfile.avatarFileId) {
      await this.avatarStorage.deleteImage(currentId);
    }
    this.userService.getProfile().avatarFileId = undefined;
    this.userService.getProfile().base64Avatar = '';
    this.userService.getProfile().avatarAttribution = undefined;
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
      this.snackBar.open(this.translation.t('common.avatarCropper.loadFailed'), this.translation.t('common.actions.ok'), {
        duration: 2000
      });
      return;
    }
    this.openAvatarCropper(file, this.buildUnsplashAttribution(photo));
  }

  private async loadUnsplashFile(photo: UnsplashPhoto): Promise<File | null> {
    try {
      const downloadLocation = photo.links?.download_location;
      if (downloadLocation) {
        this.unsplashService.trackDownload(downloadLocation).subscribe({
          error: () => undefined
        });
      }
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

  async editAvatar(): Promise<void> {
    const profile = this.userService.getProfile();
    const file = await this.loadStoredImageFile(profile.avatarFileId, profile.base64Avatar, 'avatar-edit.jpg');
    if (!file) {
      this.snackBar.open(this.translation.t('common.avatarCropper.loadFailed'), this.translation.t('common.actions.ok'), {
        duration: 2000
      });
      return;
    }
    this.openAvatarCropper(file, profile.avatarAttribution);
  }

  private openAvatarCropper(file: File, attribution?: AvatarAttribution, input?: HTMLInputElement): void {
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
      if (input) {
        input.value = '';
      }
      if (!croppedImage) {
        return;
      }
      if (!this.avatarStorage.isSupported()) {
        this.showStorageUnsupported();
        return;
      }
      const currentId = this.userService.getProfile().avatarFileId;
      if (currentId && currentId !== this.oriProfile.avatarFileId) {
        await this.avatarStorage.deleteImage(currentId);
      }
      const saved = await this.avatarStorage.saveImageFromDataUrl('avatar', croppedImage);
      if (!saved) {
        this.showStorageUnsupported();
        return;
      }
      const profile = this.userService.getProfile();
      profile.avatarFileId = saved.id;
      profile.base64Avatar = saved.url;
      profile.avatarAttribution = attribution;
      this.userService.notifyProfileChanged();
    });
  }

  private async loadStoredImageFile(fileId?: string | null, fallbackUrl?: string | null, name = 'image.jpg'): Promise<File | null> {
    try {
      let sourceUrl = '';
      if (fileId && this.avatarStorage.isSupported()) {
        const dataUrl = await this.avatarStorage.getImageBase64(fileId);
        if (dataUrl) {
          sourceUrl = dataUrl;
        }
      }
      if (!sourceUrl && fallbackUrl) {
        sourceUrl = fallbackUrl;
      }
      if (!sourceUrl) {
        return null;
      }
      const response = await fetch(sourceUrl);
      if (!response.ok) {
        return null;
      }
      const blob = await response.blob();
      return new File([blob], name, { type: blob.type || 'image/jpeg' });
    } catch {
      return null;
    }
  }

  private showStorageUnsupported(): void {
    this.snackBar.open(this.translation.t('common.media.storageUnsupported'), this.translation.t('common.actions.ok'), {
      duration: 2500
    });
  }
}
