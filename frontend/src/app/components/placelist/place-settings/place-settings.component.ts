import { ChangeDetectionStrategy, ChangeDetectorRef, Component, NgZone, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';


import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { Mode } from '../../../interfaces/mode';
import { AvatarAttribution } from '../../../interfaces/avatar-attribution';
import { Place } from '../../../interfaces/place';
import { UnsplashPhoto } from '../../../interfaces/unsplash-response';
import { TileSetting, normalizeTileSettings } from '../../../interfaces/tile-settings';
import { AvatarStorageService } from '../../../services/avatar-storage.service';
import { LanguageService } from '../../../services/language.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { AvatarCropperComponent } from '../../utils/avatar-cropper/avatar-cropper.component';
import { AvatarSourceDialogComponent, AvatarSourceChoice } from '../../utils/avatar-source-dialog/avatar-source-dialog.component';
import { UnsplashComponent } from '../../utils/unsplash/unsplash.component';
import { UnsplashService } from '../../../services/unsplash.service';

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

  private readonly maxOriginalMb = 10;
  private readonly maxOriginalBytes = this.maxOriginalMb * 1024 * 1024;
  private readonly maxAvatarMb = 10;
  private readonly maxAvatarDimension = 256;
  private readonly maxBackgroundMb = 10;
  private readonly maxBackgroundDimension = 1600;
  private oriName: string | undefined = undefined;
  private oriBase64Avatar: string | undefined = undefined;
  private oriAvatarFileId: string | undefined = undefined;
  private oriAvatarOriginalFileId: string | undefined = undefined;
  private oriBackgroundImage: string | undefined = undefined;
  private oriBackgroundFileId: string | undefined = undefined;
  private oriBackgroundOriginalFileId: string | undefined = undefined;
  private oriBackgroundTransparency: number | undefined = undefined;
  private oriBackgroundAttribution: AvatarAttribution | undefined = undefined;
  private oriIcon: string | undefined = undefined;
  private oriTileSettings: TileSetting[] | undefined = undefined;
  private oriAvatarAttribution: AvatarAttribution | undefined = undefined;

  readonly dialogRef = inject(MatDialogRef<PlaceProfileComponent>);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly dialog = inject(MatDialog);
  private readonly avatarStorage = inject(AvatarStorageService);
  private readonly unsplashService = inject(UnsplashService);
  private readonly languageService = inject(LanguageService);
  readonly data = inject<{ mode: Mode, place: Place }>(MAT_DIALOG_DATA);

  constructor() {
    this.oriName = this.data.place.name;
    this.oriBase64Avatar = this.data.place.base64Avatar;
    this.oriAvatarFileId = this.data.place.avatarFileId;
    this.oriAvatarOriginalFileId = this.data.place.avatarOriginalFileId;
    this.oriBackgroundImage = this.data.place.placeBackgroundImage;
    this.oriBackgroundFileId = this.data.place.placeBackgroundFileId;
    this.oriBackgroundOriginalFileId = this.data.place.placeBackgroundOriginalFileId;
    this.oriBackgroundTransparency = this.data.place.placeBackgroundTransparency;
    this.oriBackgroundAttribution = this.data.place.placeBackgroundAttribution;
    this.oriIcon = this.data.place.icon;
    this.oriAvatarAttribution = this.data.place.avatarAttribution;
    const normalizedTileSettings = normalizeTileSettings(this.data.place.tileSettings);
    this.oriTileSettings = normalizedTileSettings.map((tile: TileSetting) => ({ ...tile }));
    this.data.place.tileSettings = normalizedTileSettings;
    if (this.data.place.placeBackgroundTransparency == null) {
      this.data.place.placeBackgroundTransparency = 40;
    }
  }

  async onApplyClick(): Promise<void> {
    if (this.oriAvatarFileId && this.oriAvatarFileId !== this.data.place.avatarFileId) {
      await this.avatarStorage.deleteImage(this.oriAvatarFileId);
    }
    if (this.oriAvatarOriginalFileId && this.oriAvatarOriginalFileId !== this.data.place.avatarOriginalFileId) {
      await this.avatarStorage.deleteImage(this.oriAvatarOriginalFileId);
    }
    if (this.oriBackgroundFileId && this.oriBackgroundFileId !== this.data.place.placeBackgroundFileId) {
      await this.avatarStorage.deleteImage(this.oriBackgroundFileId);
    }
    if (this.oriBackgroundOriginalFileId && this.oriBackgroundOriginalFileId !== this.data.place.placeBackgroundOriginalFileId) {
      await this.avatarStorage.deleteImage(this.oriBackgroundOriginalFileId);
    }
    this.dialogRef.close();
  }

  async onAbortClick(): Promise<void> {
    if (this.data.place.avatarFileId && this.data.place.avatarFileId !== this.oriAvatarFileId) {
      await this.avatarStorage.deleteImage(this.data.place.avatarFileId);
    }
    if (this.data.place.avatarOriginalFileId && this.data.place.avatarOriginalFileId !== this.oriAvatarOriginalFileId) {
      await this.avatarStorage.deleteImage(this.data.place.avatarOriginalFileId);
    }
    if (this.data.place.placeBackgroundFileId && this.data.place.placeBackgroundFileId !== this.oriBackgroundFileId) {
      await this.avatarStorage.deleteImage(this.data.place.placeBackgroundFileId);
    }
    if (this.data.place.placeBackgroundOriginalFileId && this.data.place.placeBackgroundOriginalFileId !== this.oriBackgroundOriginalFileId) {
      await this.avatarStorage.deleteImage(this.data.place.placeBackgroundOriginalFileId);
    }
    if (undefined != this.oriName) {
      this.data.place.name = this.oriName;
    }
    if (undefined != this.oriBase64Avatar) {
      this.data.place.base64Avatar = this.oriBase64Avatar;
    }
    this.data.place.avatarFileId = this.oriAvatarFileId;
    this.data.place.avatarOriginalFileId = this.oriAvatarOriginalFileId;
    this.data.place.avatarAttribution = this.oriAvatarAttribution;
    this.data.place.placeBackgroundImage = this.oriBackgroundImage;
    this.data.place.placeBackgroundFileId = this.oriBackgroundFileId;
    this.data.place.placeBackgroundOriginalFileId = this.oriBackgroundOriginalFileId;
    this.data.place.placeBackgroundTransparency = this.oriBackgroundTransparency;
    this.data.place.placeBackgroundAttribution = this.oriBackgroundAttribution;
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
      input.value = '';
      return;
    }

    if (file.size > this.maxOriginalBytes) {
      this.snackBar.open(
        this.translation.t('common.placeSettings.imageTooLarge', { maxMb: this.maxOriginalMb }),
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
        this.translation.t('common.placeSettings.imageInvalid'),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      input.value = '';
      return;
    }

    if (file.size > this.maxOriginalBytes) {
      this.snackBar.open(
        this.translation.t('common.placeSettings.backgroundTooLarge', { maxMb: this.maxOriginalMb }),
        this.translation.t('common.actions.ok'),
        { duration: 2000 }
      );
      input.value = '';
      return;
    }

    this.openBackgroundCropper(file, undefined, input);
  }

  async deleteAvatar() {
    if (this.data.place.avatarFileId && this.data.place.avatarFileId !== this.oriAvatarFileId) {
      await this.avatarStorage.deleteImage(this.data.place.avatarFileId);
    }
    if (this.data.place.avatarOriginalFileId && this.data.place.avatarOriginalFileId !== this.oriAvatarOriginalFileId) {
      await this.avatarStorage.deleteImage(this.data.place.avatarOriginalFileId);
    }
    this.data.place.avatarFileId = undefined;
    this.data.place.avatarOriginalFileId = undefined;
    this.data.place.base64Avatar = '';
    this.data.place.avatarAttribution = undefined;
    this.cdr.markForCheck();
  }

  async deletePlaceBackground() {
    if (this.data.place.placeBackgroundFileId && this.data.place.placeBackgroundFileId !== this.oriBackgroundFileId) {
      await this.avatarStorage.deleteImage(this.data.place.placeBackgroundFileId);
    }
    if (this.data.place.placeBackgroundOriginalFileId && this.data.place.placeBackgroundOriginalFileId !== this.oriBackgroundOriginalFileId) {
      await this.avatarStorage.deleteImage(this.data.place.placeBackgroundOriginalFileId);
    }
    this.data.place.placeBackgroundFileId = undefined;
    this.data.place.placeBackgroundOriginalFileId = undefined;
    this.data.place.placeBackgroundImage = '';
    this.data.place.placeBackgroundAttribution = undefined;
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

  private showStorageUnsupported(): void {
    this.snackBar.open(
      this.translation.t('common.media.storageUnsupported'),
      this.translation.t('common.actions.ok'),
      { duration: 2500 }
    );
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
    if (file.size > this.maxOriginalBytes) {
      this.snackBar.open(
        this.translation.t('common.placeSettings.imageTooLarge', { maxMb: this.maxOriginalMb }),
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
        this.translation.t('common.placeSettings.backgroundTooLarge', { maxMb: this.maxOriginalMb }),
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
      width: '520px'
    });

    dialogRef.afterClosed().subscribe(async (croppedImage?: string) => {
      if (input) {
        input.value = '';
      }
      if (!croppedImage) {
        return;
      }
      this.ngZone.run(async () => {
        if (!this.avatarStorage.isSupported()) {
          this.showStorageUnsupported();
          return;
        }
        let savedOriginalId = originalId;
        if (!savedOriginalId) {
          const existingOriginalId = this.data.place.placeBackgroundOriginalFileId;
          if (existingOriginalId && existingOriginalId !== this.oriBackgroundOriginalFileId) {
            await this.avatarStorage.deleteImage(existingOriginalId);
          }
          const savedOriginal = await this.saveOriginalImage(file, 'background-original');
          if (!savedOriginal) {
            this.showStorageUnsupported();
            return;
          }
          savedOriginalId = savedOriginal.id;
        }
        if (this.data.place.placeBackgroundFileId && this.data.place.placeBackgroundFileId !== this.oriBackgroundFileId) {
          await this.avatarStorage.deleteImage(this.data.place.placeBackgroundFileId);
        }
        const saved = await this.avatarStorage.saveImageFromDataUrl('background', croppedImage);
        if (!saved) {
          if (!originalId && savedOriginalId) {
            await this.avatarStorage.deleteImage(savedOriginalId);
          }
          this.showStorageUnsupported();
          return;
        }
        this.data.place.placeBackgroundFileId = saved.id;
        this.data.place.placeBackgroundOriginalFileId = savedOriginalId;
        this.data.place.placeBackgroundImage = saved.url;
        this.data.place.placeBackgroundAttribution = attribution;
        if (this.data.place.placeBackgroundTransparency == null) {
          this.data.place.placeBackgroundTransparency = 40;
        }
        this.cdr.markForCheck();
      });
    });
  }

  async editAvatar(): Promise<void> {
    const file = await this.loadStoredImageFile(
      this.data.place.avatarOriginalFileId ?? this.data.place.avatarFileId,
      this.data.place.base64Avatar,
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
    this.openAvatarCropper(file, this.data.place.avatarAttribution, undefined, this.data.place.avatarOriginalFileId);
  }

  async editPlaceBackground(): Promise<void> {
    const file = await this.loadStoredImageFile(
      this.data.place.placeBackgroundOriginalFileId ?? this.data.place.placeBackgroundFileId,
      this.data.place.placeBackgroundImage,
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
    this.openBackgroundCropper(file, this.data.place.placeBackgroundAttribution, undefined, this.data.place.placeBackgroundOriginalFileId);
  }

  private openAvatarCropper(file: File, attribution?: AvatarAttribution, input?: HTMLInputElement, originalId?: string): void {
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
      this.ngZone.run(async () => {
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
          const existingOriginalId = this.data.place.avatarOriginalFileId;
          if (existingOriginalId && existingOriginalId !== this.oriAvatarOriginalFileId) {
            await this.avatarStorage.deleteImage(existingOriginalId);
          }
          const savedOriginal = await this.saveOriginalImage(file, 'avatar-original');
          if (!savedOriginal) {
            this.showStorageUnsupported();
            return;
          }
          savedOriginalId = savedOriginal.id;
        }
        if (this.data.place.avatarFileId && this.data.place.avatarFileId !== this.oriAvatarFileId) {
          await this.avatarStorage.deleteImage(this.data.place.avatarFileId);
        }
        const saved = await this.avatarStorage.saveImageFromDataUrl('avatar', croppedImage);
        if (!saved) {
          if (!originalId && savedOriginalId) {
            await this.avatarStorage.deleteImage(savedOriginalId);
          }
          this.showStorageUnsupported();
          return;
        }
        this.data.place.avatarFileId = saved.id;
        this.data.place.avatarOriginalFileId = savedOriginalId;
        this.data.place.base64Avatar = saved.url;
        this.data.place.avatarAttribution = attribution;
        this.cdr.markForCheck();
      });
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

  public showPolicy() {
    this.snackBar.open(
      this.translation.t('common.placeSettings.savePolicy'),
      this.translation.t('common.actions.ok'),
      {}
    );
  }

}
