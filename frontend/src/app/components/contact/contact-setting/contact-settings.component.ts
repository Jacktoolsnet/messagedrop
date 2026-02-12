
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AvatarAttribution } from '../../../interfaces/avatar-attribution';
import { Contact } from '../../../interfaces/contact';
import { UnsplashPhoto } from '../../../interfaces/unsplash-response';
import { AvatarStorageService } from '../../../services/avatar-storage.service';
import { LanguageService } from '../../../services/language.service';
import { SocketioService } from '../../../services/socketio.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { UnsplashService } from '../../../services/unsplash.service';
import { AvatarCropperComponent } from '../../utils/avatar-cropper/avatar-cropper.component';
import { AvatarSourceChoice, AvatarSourceDialogComponent } from '../../utils/avatar-source-dialog/avatar-source-dialog.component';
import { HelpDialogService } from '../../utils/help-dialog/help-dialog.service';
import { UnsplashComponent } from '../../utils/unsplash/unsplash.component';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
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
  private readonly languageService = inject(LanguageService);
  private readonly dialog = inject(MatDialog);
  readonly help = inject(HelpDialogService);
  readonly dialogRef = inject(MatDialogRef<ContactSettingsComponent>);
  readonly data = inject<{ contact: Contact }>(MAT_DIALOG_DATA);

  public contact: Contact = this.data.contact;
  readonly joinedUserRoom = this.socketioService.joinedUserRoom;
  private readonly maxOriginalMb = 10;
  private readonly maxOriginalBytes = this.maxOriginalMb * 1024 * 1024;
  private readonly maxAvatarMb = 10;
  private readonly maxAvatarDimension = 256;
  private readonly maxBackgroundMb = 10;
  private readonly maxBackgroundDimension = 1600;
  private readonly oriContact: Contact = structuredClone(this.contact);
  private readonly originalAvatarFileId = this.oriContact.avatarFileId;
  private readonly originalBackgroundFileId = this.oriContact.chatBackgroundFileId;
  private readonly originalAvatarOriginalFileId = this.oriContact.avatarOriginalFileId;
  private readonly originalBackgroundOriginalFileId = this.oriContact.chatBackgroundOriginalFileId;

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

  openBackgroundSourceDialog(fileInput: HTMLInputElement): void {
    const dialogRef = this.dialog.open(AvatarSourceDialogComponent, {
      panelClass: '',
      closeOnNavigation: true,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
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
      input.value = '';
      return;
    }

    if (file.size > this.maxOriginalBytes) {
      this.snackBar.open(
        this.translation.t('common.contact.profile.imageTooLarge', { maxMb: this.maxOriginalMb }),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      input.value = '';
      return;
    }

    this.openAvatarCropper(file, undefined, input);
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
      input.value = '';
      return;
    }

    if (file.size > this.maxOriginalBytes) {
      this.snackBar.open(
        this.translation.t('common.contact.profile.imageTooLarge', { maxMb: this.maxOriginalMb }),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      input.value = '';
      return;
    }

    this.openBackgroundCropper(file, undefined, input);
  }

  async deleteAvatar(): Promise<void> {
    if (this.contact.avatarFileId && this.contact.avatarFileId !== this.originalAvatarFileId) {
      await this.avatarStorage.deleteImage(this.contact.avatarFileId);
    }
    if (this.contact.avatarOriginalFileId && this.contact.avatarOriginalFileId !== this.originalAvatarOriginalFileId) {
      await this.avatarStorage.deleteImage(this.contact.avatarOriginalFileId);
    }
    this.contact.avatarFileId = undefined;
    this.contact.avatarOriginalFileId = undefined;
    this.contact.base64Avatar = undefined;
    this.contact.avatarAttribution = undefined;
  }

  async deleteChatBackground(): Promise<void> {
    if (this.contact.chatBackgroundFileId && this.contact.chatBackgroundFileId !== this.originalBackgroundFileId) {
      await this.avatarStorage.deleteImage(this.contact.chatBackgroundFileId);
    }
    if (this.contact.chatBackgroundOriginalFileId && this.contact.chatBackgroundOriginalFileId !== this.originalBackgroundOriginalFileId) {
      await this.avatarStorage.deleteImage(this.contact.chatBackgroundOriginalFileId);
    }
    this.contact.chatBackgroundFileId = undefined;
    this.contact.chatBackgroundOriginalFileId = undefined;
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

  formatPercentLabel(value: number): string {
    const numeric = Number.isFinite(value) ? Math.round(value) : 0;
    return `${numeric}%`;
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

  private openUnsplashBackground(): void {
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
    if (file.size > this.maxOriginalBytes) {
      this.snackBar.open(
        this.translation.t('common.contact.profile.imageTooLarge', { maxMb: this.maxOriginalMb }),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      return;
    }
    this.openAvatarCropper(file, this.buildUnsplashAttribution(photo));
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
    if (file.size > this.maxOriginalBytes) {
      this.snackBar.open(
        this.translation.t('common.contact.profile.imageTooLarge', { maxMb: this.maxOriginalMb }),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      return;
    }
    this.openBackgroundCropper(file, this.buildUnsplashAttribution(photo));
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

  private openBackgroundCropper(file: File, attribution?: AvatarAttribution, input?: HTMLInputElement, originalId?: string): void {
    const dialogRef = this.dialog.open(AvatarCropperComponent, {
      data: {
        file,
        maxSizeMb: this.maxBackgroundMb,
        resizeToWidth: this.maxBackgroundDimension,
        maintainAspectRatio: false,
        containWithinAspectRatio: false,
        titleKey: 'common.backgroundCropper.title',
        hintKey: 'common.backgroundCropper.hint'
      },
      maxWidth: '95vw',
      width: '520px',
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
      if (!this.avatarStorage.isSupported()) {
        this.showStorageUnsupported();
        return;
      }
      let savedOriginalId = originalId;
      if (!savedOriginalId) {
        const existingOriginalId = this.contact.chatBackgroundOriginalFileId;
        if (existingOriginalId && existingOriginalId !== this.originalBackgroundOriginalFileId) {
          await this.avatarStorage.deleteImage(existingOriginalId);
        }
        const savedOriginal = await this.saveOriginalImage(file, 'background-original');
        if (!savedOriginal) {
          this.showStorageUnsupported();
          return;
        }
        savedOriginalId = savedOriginal.id;
      }
      if (this.contact.chatBackgroundFileId && this.contact.chatBackgroundFileId !== this.originalBackgroundFileId) {
        await this.avatarStorage.deleteImage(this.contact.chatBackgroundFileId);
      }
      const saved = await this.avatarStorage.saveImageFromDataUrl('background', croppedImage);
      if (!saved) {
        if (!originalId && savedOriginalId) {
          await this.avatarStorage.deleteImage(savedOriginalId);
        }
        this.showStorageUnsupported();
        return;
      }
      this.contact.chatBackgroundFileId = saved.id;
      this.contact.chatBackgroundOriginalFileId = savedOriginalId;
      this.contact.chatBackgroundImage = saved.url;
      this.contact.chatBackgroundAttribution = attribution;
      if (this.contact.chatBackgroundTransparency == null) {
        this.contact.chatBackgroundTransparency = 40;
      }
    });
  }

  async editAvatar(): Promise<void> {
    const file = await this.loadStoredImageFile(
      this.contact.avatarOriginalFileId ?? this.contact.avatarFileId,
      this.contact.base64Avatar,
      'avatar-edit.jpg'
    );
    if (!file) {
      this.snackBar.open(
        this.translation.t('common.avatarCropper.loadFailed'),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      return;
    }
    this.openAvatarCropper(file, this.contact.avatarAttribution, undefined, this.contact.avatarOriginalFileId);
  }

  async editChatBackground(): Promise<void> {
    const file = await this.loadStoredImageFile(
      this.contact.chatBackgroundOriginalFileId ?? this.contact.chatBackgroundFileId,
      this.contact.chatBackgroundImage,
      'background-edit.jpg'
    );
    if (!file) {
      this.snackBar.open(
        this.translation.t('common.avatarCropper.loadFailed'),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      return;
    }
    this.openBackgroundCropper(file, this.contact.chatBackgroundAttribution, undefined, this.contact.chatBackgroundOriginalFileId);
  }

  private openAvatarCropper(file: File, attribution?: AvatarAttribution, input?: HTMLInputElement, originalId?: string): void {
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
      if (!this.avatarStorage.isSupported()) {
        this.showStorageUnsupported();
        return;
      }
      let savedOriginalId = originalId;
      if (!savedOriginalId) {
        const existingOriginalId = this.contact.avatarOriginalFileId;
        if (existingOriginalId && existingOriginalId !== this.originalAvatarOriginalFileId) {
          await this.avatarStorage.deleteImage(existingOriginalId);
        }
        const savedOriginal = await this.saveOriginalImage(file, 'avatar-original');
        if (!savedOriginal) {
          this.showStorageUnsupported();
          return;
        }
        savedOriginalId = savedOriginal.id;
      }
      if (this.contact.avatarFileId && this.contact.avatarFileId !== this.originalAvatarFileId) {
        await this.avatarStorage.deleteImage(this.contact.avatarFileId);
      }
      const saved = await this.avatarStorage.saveImageFromDataUrl('avatar', croppedImage);
      if (!saved) {
        if (!originalId && savedOriginalId) {
          await this.avatarStorage.deleteImage(savedOriginalId);
        }
        this.showStorageUnsupported();
        return;
      }
      this.contact.avatarFileId = saved.id;
      this.contact.avatarOriginalFileId = savedOriginalId;
      this.contact.base64Avatar = saved.url;
      this.contact.avatarAttribution = attribution;
    });
  }

  private saveOriginalImage(
    file: File,
    kind: 'avatar-original' | 'background-original'
  ): Promise<{ id: string; url: string } | null> {
    return this.avatarStorage.saveImageFromFile(kind, file);
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
    if (this.contact.avatarOriginalFileId && this.contact.avatarOriginalFileId !== this.originalAvatarOriginalFileId) {
      await this.avatarStorage.deleteImage(this.contact.avatarOriginalFileId);
    }
    if (this.contact.chatBackgroundFileId && this.contact.chatBackgroundFileId !== this.originalBackgroundFileId) {
      await this.avatarStorage.deleteImage(this.contact.chatBackgroundFileId);
    }
    if (this.contact.chatBackgroundOriginalFileId && this.contact.chatBackgroundOriginalFileId !== this.originalBackgroundOriginalFileId) {
      await this.avatarStorage.deleteImage(this.contact.chatBackgroundOriginalFileId);
    }
    Object.assign(this.data.contact, this.oriContact);
    this.dialogRef.close();
  }

  async onApplyClick() {
    if (this.originalAvatarFileId && this.originalAvatarFileId !== this.contact.avatarFileId) {
      await this.avatarStorage.deleteImage(this.originalAvatarFileId);
    }
    if (this.originalAvatarOriginalFileId && this.originalAvatarOriginalFileId !== this.contact.avatarOriginalFileId) {
      await this.avatarStorage.deleteImage(this.originalAvatarOriginalFileId);
    }
    if (this.originalBackgroundFileId && this.originalBackgroundFileId !== this.contact.chatBackgroundFileId) {
      await this.avatarStorage.deleteImage(this.originalBackgroundFileId);
    }
    if (this.originalBackgroundOriginalFileId && this.originalBackgroundOriginalFileId !== this.contact.chatBackgroundOriginalFileId) {
      await this.avatarStorage.deleteImage(this.originalBackgroundOriginalFileId);
    }
    this.dialogRef.close();
  }
}
