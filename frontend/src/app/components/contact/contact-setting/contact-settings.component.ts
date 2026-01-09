
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { AvatarAttribution } from '../../../interfaces/avatar-attribution';
import { Contact } from '../../../interfaces/contact';
import { UnsplashPhoto } from '../../../interfaces/unsplash-response';
import { AvatarStorageService } from '../../../services/avatar-storage.service';
import { SocketioService } from '../../../services/socketio.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
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
    MatDialogClose,
    MatIconModule,
    MatSliderModule,
    TranslocoPipe
  ],
  templateUrl: './contact-settings.component.html',
  styleUrl: './contact-settings.component.css'
})
export class ContactSettingsComponent {
  private readonly socketioService = inject(SocketioService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  private readonly avatarStorage = inject(AvatarStorageService);
  private readonly unsplashService = inject(UnsplashService);
  private readonly dialog = inject(MatDialog);
  readonly dialogRef = inject(MatDialogRef<ContactSettingsComponent>);
  readonly data = inject<{ contact: Contact }>(MAT_DIALOG_DATA);

  public contact: Contact = this.data.contact;
  readonly joinedUserRoom = this.socketioService.joinedUserRoom;
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB
  private readonly maxAvatarMb = 2;
  private readonly maxAvatarDimension = 256;
  private readonly maxBackgroundBytes = 2 * 1024 * 1024; // 2MB
  private readonly maxBackgroundDimension = 1600;
  private readonly oriContact: Contact = structuredClone(this.contact);
  private readonly originalAvatarFileId = this.oriContact.avatarFileId;
  private readonly originalBackgroundFileId = this.oriContact.chatBackgroundFileId;

  constructor() {
    if (this.contact.chatBackgroundTransparency == null) {
      this.contact.chatBackgroundTransparency = 40;
    }
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

  openBackgroundSourceDialog(fileInput: HTMLInputElement): void {
    const dialogRef = this.dialog.open(AvatarSourceDialogComponent, {
      panelClass: '',
      closeOnNavigation: true,
      hasBackdrop: true,
      autoFocus: false,
      data: {
        titleKey: 'common.backgroundSource.title',
        icon: 'wallpaper'
      }
    });

    dialogRef.afterClosed().subscribe((choice?: AvatarSourceChoice) => {
      if (choice === 'file') {
        fileInput.click();
        return;
      }
      if (choice === 'unsplash') {
        this.openUnsplashBackground();
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.snackBar.open(
        this.translation.t('common.contact.profile.imageInvalid'),
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
        input.value = '';
        return;
      }
      if (!this.avatarStorage.isSupported()) {
        this.showStorageUnsupported();
        input.value = '';
        return;
      }
      if (this.contact.avatarFileId && this.contact.avatarFileId !== this.originalAvatarFileId) {
        await this.avatarStorage.deleteImage(this.contact.avatarFileId);
      }
      const saved = await this.avatarStorage.saveImageFromDataUrl('avatar', croppedImage);
      if (!saved) {
        this.showStorageUnsupported();
        input.value = '';
        return;
      }
      this.contact.avatarFileId = saved.id;
      this.contact.base64Avatar = saved.url;
      this.contact.avatarAttribution = undefined;
      input.value = '';
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
        this.translation.t('common.contact.profile.imageInvalid'),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      return;
    }

    if (file.size > this.maxFileSize) {
      this.snackBar.open(
        this.translation.t('common.contact.profile.imageTooLarge', { maxMb: 5 }),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      return;
    }

    this.resizeAndCompressImage(file, this.maxBackgroundDimension, this.maxBackgroundBytes)
      .then(async (dataUrl) => {
        if (!this.avatarStorage.isSupported()) {
          this.showStorageUnsupported();
          input.value = '';
          return;
        }
        if (this.contact.chatBackgroundFileId && this.contact.chatBackgroundFileId !== this.originalBackgroundFileId) {
          await this.avatarStorage.deleteImage(this.contact.chatBackgroundFileId);
        }
        const saved = await this.avatarStorage.saveImageFromDataUrl('background', dataUrl);
        if (!saved) {
          this.showStorageUnsupported();
          input.value = '';
          return;
        }
        this.contact.chatBackgroundFileId = saved.id;
        this.contact.chatBackgroundImage = saved.url;
        this.contact.chatBackgroundAttribution = undefined;
        if (this.contact.chatBackgroundTransparency == null) {
          this.contact.chatBackgroundTransparency = 40;
        }
        input.value = '';
      })
      .catch((error: Error) => {
        if (error.message === 'too_large') {
          this.snackBar.open(
            this.translation.t('common.contact.profile.imageTooLarge', { maxMb: 2 }),
            this.translation.t('common.actions.ok'),
            { duration: 2000 }
          );
          return;
        }
        this.snackBar.open(
          this.translation.t('common.contact.profile.fileReadError'),
          this.translation.t('common.actions.ok'),
          { duration: 2000 }
        );
      });
  }

  async deleteAvatar(): Promise<void> {
    if (this.contact.avatarFileId && this.contact.avatarFileId !== this.originalAvatarFileId) {
      await this.avatarStorage.deleteImage(this.contact.avatarFileId);
    }
    this.contact.avatarFileId = undefined;
    this.contact.base64Avatar = undefined;
    this.contact.avatarAttribution = undefined;
  }

  async deleteChatBackground(): Promise<void> {
    if (this.contact.chatBackgroundFileId && this.contact.chatBackgroundFileId !== this.originalBackgroundFileId) {
      await this.avatarStorage.deleteImage(this.contact.chatBackgroundFileId);
    }
    this.contact.chatBackgroundFileId = undefined;
    this.contact.chatBackgroundImage = '';
    this.contact.chatBackgroundAttribution = undefined;
  }

  getChatBackgroundPreviewImage(): string {
    return this.contact.chatBackgroundImage ? `url(${this.contact.chatBackgroundImage})` : 'none';
  }

  getChatBackgroundPreviewOpacity(): number {
    const transparency = this.contact.chatBackgroundTransparency ?? 40;
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

  private openUnsplashBackground(): void {
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
      void this.applyUnsplashBackground(photo);
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
      if (this.contact.avatarFileId && this.contact.avatarFileId !== this.originalAvatarFileId) {
        await this.avatarStorage.deleteImage(this.contact.avatarFileId);
      }
      const saved = await this.avatarStorage.saveImageFromDataUrl('avatar', croppedImage);
      if (!saved) {
        this.showStorageUnsupported();
        return;
      }
      this.contact.avatarFileId = saved.id;
      this.contact.base64Avatar = saved.url;
      this.contact.avatarAttribution = this.buildUnsplashAttribution(photo);
    });
  }

  private async applyUnsplashBackground(photo: UnsplashPhoto): Promise<void> {
    const file = await this.loadUnsplashFile(photo);
    if (!file) {
      this.snackBar.open(
        this.translation.t('common.avatarCropper.loadFailed'),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      return;
    }

    try {
      const dataUrl = await this.resizeAndCompressImage(file, this.maxBackgroundDimension, this.maxBackgroundBytes);
      if (!this.avatarStorage.isSupported()) {
        this.showStorageUnsupported();
        return;
      }
      if (this.contact.chatBackgroundFileId && this.contact.chatBackgroundFileId !== this.originalBackgroundFileId) {
        await this.avatarStorage.deleteImage(this.contact.chatBackgroundFileId);
      }
      const saved = await this.avatarStorage.saveImageFromDataUrl('background', dataUrl);
      if (!saved) {
        this.showStorageUnsupported();
        return;
      }
      this.contact.chatBackgroundFileId = saved.id;
      this.contact.chatBackgroundImage = saved.url;
      this.contact.chatBackgroundAttribution = this.buildUnsplashAttribution(photo);
      if (this.contact.chatBackgroundTransparency == null) {
        this.contact.chatBackgroundTransparency = 40;
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'too_large') {
        this.snackBar.open(
          this.translation.t('common.contact.profile.imageTooLarge', { maxMb: 2 }),
          this.translation.t('common.actions.ok'),
          { duration: 2000 }
        );
        return;
      }
      this.snackBar.open(
        this.translation.t('common.contact.profile.fileReadError'),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
    }
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

  showPolicy(): void {
    this.snackBar.open(
      this.translation.t('common.contact.profile.policy'),
      this.translation.t('common.actions.ok'),
      { duration: 4000 }
    );
  }

  getProfileFromContact(contact: Contact): void {
    if (!this.joinedUserRoom()) {
      this.socketioService.initUserSocketEvents();
    }
    this.socketioService.receiveProfileForContactEvent(contact);
    this.socketioService.getSocket().emit('contact:requestProfile', contact);
    this.dialogRef.close();

    this.snackBar.open(this.translation.t('common.contact.profile.requestSent'), '', {
      duration: 1500,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }

  async onAbortClick() {
    if (this.contact.avatarFileId && this.contact.avatarFileId !== this.originalAvatarFileId) {
      await this.avatarStorage.deleteImage(this.contact.avatarFileId);
    }
    if (this.contact.chatBackgroundFileId && this.contact.chatBackgroundFileId !== this.originalBackgroundFileId) {
      await this.avatarStorage.deleteImage(this.contact.chatBackgroundFileId);
    }
    Object.assign(this.data.contact, this.oriContact);
    this.dialogRef.close();
  }

  async onApplyClick() {
    if (this.originalAvatarFileId && this.originalAvatarFileId !== this.contact.avatarFileId) {
      await this.avatarStorage.deleteImage(this.originalAvatarFileId);
    }
    if (this.originalBackgroundFileId && this.originalBackgroundFileId !== this.contact.chatBackgroundFileId) {
      await this.avatarStorage.deleteImage(this.originalBackgroundFileId);
    }
    this.dialogRef.close();
  }
}
