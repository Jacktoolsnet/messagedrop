import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AvatarAttribution } from '../../../../interfaces/avatar-attribution';
import { ShoppingCategory } from '../../../../interfaces/tile-settings';
import { UnsplashPhoto } from '../../../../interfaces/unsplash-response';
import { DisplayMessageService } from '../../../../services/display-message.service';
import { LanguageService } from '../../../../services/language.service';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { UnsplashService } from '../../../../services/unsplash.service';
import { AvatarCropperComponent } from '../../../utils/avatar-cropper/avatar-cropper.component';
import { AvatarSourceChoice, AvatarSourceDialogComponent } from '../../../utils/avatar-source-dialog/avatar-source-dialog.component';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../../../utils/help-dialog/help-dialog.service';
import { UnsplashComponent } from '../../../utils/unsplash/unsplash.component';
import { createShoppingId, normalizeShoppingList } from '../shopping-list.util';

export interface ShoppingCategoryEditData {
  category?: ShoppingCategory;
}

type CategoryImageKind = 'avatar' | 'background';

@Component({
  selector: 'app-shopping-category-edit',
  standalone: true,
  imports: [
    A11yModule,
    DialogHeaderComponent,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatFormFieldModule,
    MatIcon,
    MatInputModule,
    MatSliderModule,
    TranslocoPipe
  ],
  templateUrl: './shopping-category-edit.component.html',
  styleUrl: './shopping-category-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShoppingCategoryEditComponent {
  private readonly dialogRef = inject(MatDialogRef<ShoppingCategoryEditComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly translation = inject(TranslationHelperService);
  private readonly language = inject(LanguageService);
  private readonly unsplash = inject(UnsplashService);
  private readonly messages = inject(DisplayMessageService);
  readonly help = inject(HelpDialogService);
  readonly data = inject<ShoppingCategoryEditData>(MAT_DIALOG_DATA);

  private readonly source = this.data.category;
  readonly nameControl = new FormControl(this.source?.name ?? '', { nonNullable: true });
  readonly image = signal<string | undefined>(this.source?.image);
  readonly imageAttribution = signal<AvatarAttribution | undefined>(this.source?.imageAttribution);
  readonly backgroundImage = signal<string | undefined>(this.source?.backgroundImage);
  readonly backgroundAttribution = signal<AvatarAttribution | undefined>(this.source?.backgroundAttribution);
  backgroundTransparency = this.source?.backgroundTransparency ?? 40;

  get dialogTitle(): string {
    return this.source
      ? this.translation.t('common.tiles.shopping.editCategory')
      : this.translation.t('common.tiles.shopping.addCategory');
  }

  openSourceDialog(input: HTMLInputElement, kind: CategoryImageKind): void {
    const ref = this.dialog.open(AvatarSourceDialogComponent, {
      autoFocus: false,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      data: kind === 'background' ? {
        titleKey: 'common.backgroundSource.title',
        icon: 'wallpaper'
      } : undefined
    });
    ref.afterClosed().subscribe((choice?: AvatarSourceChoice) => {
      if (choice === 'file') input.click();
      if (choice === 'unsplash') this.openUnsplash(kind);
    });
  }

  onFileSelected(event: Event, kind: CategoryImageKind): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    this.openCropper(file, kind);
  }

  async editImage(kind: CategoryImageKind): Promise<void> {
    const source = kind === 'avatar' ? this.image() : this.backgroundImage();
    if (!source) return;
    try {
      const response = await fetch(source);
      const blob = await response.blob();
      const file = new File([blob], `shopping-category-${kind}.jpg`, { type: blob.type || 'image/jpeg' });
      const attribution = kind === 'avatar' ? this.imageAttribution() : this.backgroundAttribution();
      this.openCropper(file, kind, attribution);
    } catch {
      this.showImageError();
    }
  }

  removeImage(kind: CategoryImageKind): void {
    if (kind === 'avatar') {
      this.image.set(undefined);
      this.imageAttribution.set(undefined);
      return;
    }
    this.backgroundImage.set(undefined);
    this.backgroundAttribution.set(undefined);
  }

  backgroundPreview(): string {
    return this.backgroundImage() ? `url(${this.backgroundImage()})` : 'none';
  }

  backgroundOpacity(): number {
    return 1 - Math.min(100, Math.max(0, this.backgroundTransparency)) / 100;
  }

  formatPercentLabel(value: number): string {
    return `${Math.round(value)}%`;
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    const name = this.nameControl.value.trim();
    if (!name) return;
    const category: ShoppingCategory = {
      id: this.source?.id ?? createShoppingId('category'),
      name,
      image: this.image(),
      imageAttribution: this.imageAttribution(),
      backgroundImage: this.backgroundImage(),
      backgroundAttribution: this.backgroundAttribution(),
      backgroundTransparency: this.backgroundTransparency,
      order: this.source?.order ?? 0,
      products: this.source?.products ?? []
    };
    this.dialogRef.close(normalizeShoppingList({ categories: [category], currency: 'EUR' }).categories[0]);
  }

  private openUnsplash(kind: CategoryImageKind): void {
    const ref = this.dialog.open(UnsplashComponent, {
      data: { returnType: 'photo' },
      maxWidth: '95vw',
      maxHeight: '90vh',
      autoFocus: false,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false
    });
    ref.afterClosed().subscribe((photo?: UnsplashPhoto) => {
      if (photo) void this.applyUnsplash(photo, kind);
    });
  }

  private async applyUnsplash(photo: UnsplashPhoto, kind: CategoryImageKind): Promise<void> {
    try {
      if (photo.links?.download_location) {
        this.unsplash.trackDownload(photo.links.download_location).subscribe({ error: () => undefined });
      }
      const blob = await firstValueFrom(this.unsplash.downloadPhoto(photo.urls.regular));
      const file = new File([blob], `unsplash-${photo.id}.jpg`, { type: blob.type || 'image/jpeg' });
      this.openCropper(file, kind, this.buildAttribution(photo));
    } catch {
      this.showImageError();
    }
  }

  private openCropper(file: File, kind: CategoryImageKind, attribution?: AvatarAttribution): void {
    const background = kind === 'background';
    const ref = this.dialog.open(AvatarCropperComponent, {
      data: {
        file,
        maxSizeMb: background ? 1 : 0.5,
        resizeToWidth: background ? 900 : 256,
        maintainAspectRatio: !background,
        containWithinAspectRatio: !background,
        titleKey: background ? 'common.backgroundCropper.title' : 'common.tiles.shopping.categoryImageTitle',
        hintKey: background ? 'common.backgroundCropper.hint' : 'common.tiles.shopping.categoryImageHint'
      },
      width: background ? '520px' : '420px',
      maxWidth: '95vw',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false
    });
    ref.afterClosed().subscribe((cropped?: string) => {
      if (!cropped) return;
      if (background) {
        this.backgroundImage.set(cropped);
        this.backgroundAttribution.set(attribution);
        return;
      }
      this.image.set(cropped);
      this.imageAttribution.set(attribution);
    });
  }

  private buildAttribution(photo: UnsplashPhoto): AvatarAttribution {
    const locale = this.language.effectiveLanguage();
    const unsplashBase = `https://unsplash.com/${locale}`;
    const photoUrl = new URL(photo.links?.html ?? `https://unsplash.com/photos/${photo.id}`);
    photoUrl.searchParams.set('utm_source', 'messagedrop');
    photoUrl.searchParams.set('utm_medium', 'referral');
    const authorUrl = photo.user?.username ? new URL(`${unsplashBase}/@${encodeURIComponent(photo.user.username)}`) : undefined;
    authorUrl?.searchParams.set('utm_source', 'messagedrop');
    authorUrl?.searchParams.set('utm_medium', 'referral');
    const unsplashUrl = new URL(`${unsplashBase}/`);
    unsplashUrl.searchParams.set('utm_source', 'messagedrop');
    unsplashUrl.searchParams.set('utm_medium', 'referral');
    return {
      source: 'unsplash',
      authorName: photo.user?.name || photo.user?.username || 'Unsplash',
      authorUrl: authorUrl?.toString(),
      unsplashUrl: unsplashUrl.toString(),
      photoUrl: photoUrl.toString()
    };
  }

  private showImageError(): void {
    this.messages.open(
      this.translation.t('common.avatarCropper.loadFailed'),
      this.translation.t('common.actions.ok'),
      { duration: 2500 }
    );
  }
}
