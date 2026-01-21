
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AvatarAttribution } from '../../../interfaces/avatar-attribution';
import { Profile } from '../../../interfaces/profile';
import { UnsplashPhoto } from '../../../interfaces/unsplash-response';
import { AvatarStorageService } from '../../../services/avatar-storage.service';
import { LanguageService } from '../../../services/language.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { UnsplashService } from '../../../services/unsplash.service';
import { AvatarCropperComponent } from '../../utils/avatar-cropper/avatar-cropper.component';
import { AvatarSourceChoice, AvatarSourceDialogComponent } from '../../utils/avatar-source-dialog/avatar-source-dialog.component';
import { HelpDialogService } from '../../utils/help-dialog/help-dialog.service';
import { UnsplashComponent } from '../../utils/unsplash/unsplash.component';

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
  private readonly maxAvatarMb = 10;
  private readonly maxAvatarBytes = this.maxAvatarMb * 1024 * 1024;
  private readonly maxAvatarDimension = 256;
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  private readonly dialog = inject(MatDialog);
  private readonly avatarStorage = inject(AvatarStorageService);
  private readonly unsplashService = inject(UnsplashService);
  private readonly languageService = inject(LanguageService);
  readonly help = inject(HelpDialogService);
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

  async onAbortClick(): Promise<void> {
    const currentId = this.profile.avatarFileId;
    if (currentId && currentId !== this.oriProfile.avatarFileId) {
      await this.avatarStorage.deleteImage(currentId);
    }
    Object.assign(this.profile, this.oriProfile);
    this.dialogRef.close();
  }

  async onApplyClick(): Promise<void> {
    const originalId = this.oriProfile.avatarFileId;
    const currentId = this.profile.avatarFileId;
    if (originalId && originalId !== currentId) {
      await this.avatarStorage.deleteImage(originalId);
    }
    Object.assign(this.data.profile, this.profile);
    this.dialogRef.close();
  }

  openAvatarSourceDialog(fileInput: HTMLInputElement): void {
    const dialogRef = this.dialog.open(AvatarSourceDialogComponent, {
      panelClass: '',
      closeOnNavigation: true,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
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

    this.openAvatarCropper(file, undefined, input);
  }

  async deleteAvatar() {
    const currentId = this.profile.avatarFileId;
    if (currentId && currentId !== this.oriProfile.avatarFileId) {
      await this.avatarStorage.deleteImage(currentId);
    }
    this.profile.avatarFileId = undefined;
    this.profile.base64Avatar = '';
    this.profile.avatarAttribution = undefined;
  }

  public showPolicy() {
    this.snackBar.open(
      this.translation.t('common.messageProfile.policy'),
      this.translation.t('common.actions.ok'),
      {}
    );
  }

  private showStorageUnsupported(): void {
    this.snackBar.open(
      this.translation.t('common.media.storageUnsupported'),
      this.translation.t('common.actions.ok'),
      { duration: 2500 }
    );
  }

  private openUnsplashAvatar(): void {
    const dialogRef = this.dialog.open(UnsplashComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { returnType: 'photo' },
      maxWidth: '95vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
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
    if (file.size > this.maxAvatarBytes) {
      this.snackBar.open(
        this.translation.t('common.messageProfile.fileTooLarge', { maxMb: this.maxAvatarMb }),
        this.translation.t('common.actions.ok'),
        { duration: 2500 }
      );
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
      const blob = await firstValueFrom(this.unsplashService.downloadPhoto(photo.urls.regular));
      return new File([blob], `unsplash-${photo.id}.jpg`, { type: blob.type || 'image/jpeg' });
    } catch {
      return null;
    }
  }

  private buildUnsplashAttribution(photo: UnsplashPhoto): AvatarAttribution {
    const authorName = photo.user?.name || photo.user?.username || 'Unsplash';
    const lang = this.languageService.effectiveLanguage();
    const localeSegment = lang ? `/${lang}` : '';
    const unsplashBase = `https://unsplash.com${localeSegment}`;
    const baseUrl = photo.links?.html ?? `https://unsplash.com/photos/${photo.id}`;
    const url = new URL(baseUrl);
    url.searchParams.set('utm_source', 'messagedrop');
    url.searchParams.set('utm_medium', 'referral');
    const authorUsername = photo.user?.username;
    let authorUrl: string | undefined;
    if (authorUsername) {
      const profileUrl = new URL(`${unsplashBase}/@${encodeURIComponent(authorUsername)}`);
      profileUrl.searchParams.set('utm_source', 'messagedrop');
      profileUrl.searchParams.set('utm_medium', 'referral');
      authorUrl = profileUrl.toString();
    }
    const unsplashUrl = new URL(`${unsplashBase}/`);
    unsplashUrl.searchParams.set('utm_source', 'messagedrop');
    unsplashUrl.searchParams.set('utm_medium', 'referral');
    return {
      source: 'unsplash',
      authorName,
      authorUrl,
      unsplashUrl: unsplashUrl.toString(),
      photoUrl: url.toString()
    };
  }

  private openAvatarCropper(file: File, attribution?: AvatarAttribution, input?: HTMLInputElement): void {
    if (!this.avatarStorage.isSupported()) {
      this.showStorageUnsupported();
      if (input) {
        input.value = '';
      }
      return;
    }

    const dialogRef = this.dialog.open(AvatarCropperComponent, {
      data: {
        file,
        maxSizeMb: this.maxAvatarMb,
        resizeToWidth: this.maxAvatarDimension
      },
      maxWidth: '95vw',
      width: '420px',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe(async (croppedImage?: string) => {
      if (input) {
        input.value = '';
      }
      if (!croppedImage) {
        return;
      }
      const currentId = this.profile.avatarFileId;
      if (currentId && currentId !== this.oriProfile.avatarFileId) {
        await this.avatarStorage.deleteImage(currentId);
      }
      const saved = await this.avatarStorage.saveImageFromDataUrl('avatar', croppedImage);
      if (!saved) {
        this.showStorageUnsupported();
        return;
      }
      this.profile.avatarFileId = saved.id;
      this.profile.base64Avatar = saved.url;
      this.profile.avatarAttribution = attribution;
    });
  }
}
