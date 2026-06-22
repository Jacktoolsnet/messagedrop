import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AvatarAttribution } from '../../../../interfaces/avatar-attribution';
import { ShoppingProduct, ShoppingUnit } from '../../../../interfaces/tile-settings';
import { UnsplashPhoto } from '../../../../interfaces/unsplash-response';
import { DisplayMessageService } from '../../../../services/display-message.service';
import { LanguageService } from '../../../../services/language.service';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { UnsplashService } from '../../../../services/unsplash.service';
import { ShoppingImageStorageService } from '../../../../services/shopping-image-storage.service';
import { AvatarCropperComponent } from '../../../utils/avatar-cropper/avatar-cropper.component';
import { AvatarSourceChoice, AvatarSourceDialogComponent } from '../../../utils/avatar-source-dialog/avatar-source-dialog.component';
import { CameraCaptureDialogComponent } from '../../../utils/camera-capture-dialog/camera-capture-dialog.component';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';
import { UnsplashComponent } from '../../../utils/unsplash/unsplash.component';
import { saveDialogOnImplicitDismiss } from '../../../utils/dialog-auto-save.util';
import { createShoppingId, SHOPPING_UNITS } from '../shopping-list.util';

@Component({
  selector: 'app-shopping-product-edit',
  standalone: true,
  imports: [A11yModule, DialogHeaderComponent, ReactiveFormsModule, MatButtonModule, MatDialogActions, MatDialogContent, MatFormFieldModule, MatIcon, MatInputModule, MatSelectModule, TranslocoPipe],
  templateUrl: './shopping-product-edit.component.html',
  styleUrl: './shopping-product-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShoppingProductEditComponent {
  private readonly dialogRef = inject(MatDialogRef<ShoppingProductEditComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly translation = inject(TranslationHelperService);
  private readonly language = inject(LanguageService);
  private readonly unsplash = inject(UnsplashService);
  private readonly messages = inject(DisplayMessageService);
  private readonly imageStorage = inject(ShoppingImageStorageService);
  readonly product = inject<{ product?: ShoppingProduct }>(MAT_DIALOG_DATA).product;
  readonly nameControl = new FormControl(this.product?.name ?? '', { nonNullable: true });
  readonly notesControl = new FormControl(this.product?.notes ?? '', { nonNullable: true });
  readonly quantityControl = new FormControl(this.product?.quantity ?? 1, { nonNullable: true });
  readonly unitControl = new FormControl<ShoppingUnit>(this.product?.unit ?? 'piece', { nonNullable: true });
  readonly priceControl = new FormControl<number | null>(this.product?.price ?? null);
  readonly image = signal<string | undefined>(this.product?.image);
  readonly imageAttribution = signal<AvatarAttribution | undefined>(this.product?.imageAttribution);
  private readonly imageRemoved = signal(false);
  readonly units = SHOPPING_UNITS;

  constructor() {
    saveDialogOnImplicitDismiss(this.dialogRef, () => this.save());
    if (this.product) {
      void this.imageStorage.hydrateProduct(this.product).then(product => {
        if (!this.image() && !this.imageRemoved()) this.image.set(product.image);
      });
    }
  }

  get title(): string {
    return this.translation.t(this.product ? 'common.tiles.shopping.editProduct' : 'common.tiles.shopping.addProduct');
  }

  openImageSource(fileInput: HTMLInputElement): void {
    const ref = this.dialog.open(AvatarSourceDialogComponent, {
      autoFocus: false,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      data: { showCamera: true }
    });
    ref.afterClosed().subscribe((choice?: AvatarSourceChoice) => {
      if (choice === 'file') fileInput.click();
      if (choice === 'camera') this.openCamera();
      if (choice === 'unsplash') this.openUnsplash();
    });
  }

  private openCamera(): void {
    const ref = this.dialog.open(CameraCaptureDialogComponent, {
      width: '420px',
      maxWidth: '95vw',
      autoFocus: false,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false
    });
    ref.afterClosed().subscribe((file?: File) => {
      if (file) this.openCropper(file);
    });
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file?.type.startsWith('image/')) this.openCropper(file);
  }

  async editImage(): Promise<void> {
    const source = this.image();
    if (!source) return;
    try {
      const response = await fetch(source);
      const blob = await response.blob();
      this.openCropper(
        new File([blob], 'shopping-product.jpg', { type: blob.type || 'image/jpeg' }),
        this.imageAttribution()
      );
    } catch {
      this.showImageError();
    }
  }

  removeImage(): void {
    this.imageRemoved.set(true);
    this.image.set(undefined);
    this.imageAttribution.set(undefined);
  }

  close(): void {
    this.dialogRef.close();
  }

  save(): void {
    const name = this.nameControl.value.trim();
    if (!name) return;
    const priceValue = this.priceControl.value;
    const price = priceValue === null || !Number.isFinite(Number(priceValue)) || Number(priceValue) < 0
      ? undefined
      : Number(priceValue);
    this.dialogRef.close({
      id: this.product?.id ?? createShoppingId('product'),
      name,
      notes: this.notesControl.value.trim() || undefined,
      image: this.image(),
      imageFileId: !this.imageRemoved() && !this.image()?.startsWith('data:image/') ? this.product?.imageFileId : undefined,
      imageAttribution: this.imageAttribution(),
      quantity: Math.max(0.01, Number(this.quantityControl.value) || 1),
      unit: this.unitControl.value,
      price,
      needed: this.product?.needed ?? false,
      done: this.product?.done ?? false,
      order: this.product?.order ?? 0
    } satisfies ShoppingProduct);
  }

  private openUnsplash(): void {
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
      if (photo) void this.applyUnsplash(photo);
    });
  }

  private async applyUnsplash(photo: UnsplashPhoto): Promise<void> {
    try {
      if (photo.links?.download_location) {
        this.unsplash.trackDownload(photo.links.download_location).subscribe({ error: () => undefined });
      }
      const blob = await firstValueFrom(this.unsplash.downloadPhoto(photo.urls.regular));
      this.openCropper(
        new File([blob], `unsplash-${photo.id}.jpg`, { type: blob.type || 'image/jpeg' }),
        this.buildAttribution(photo)
      );
    } catch {
      this.showImageError();
    }
  }

  private openCropper(file: File, attribution?: AvatarAttribution): void {
    const ref = this.dialog.open(AvatarCropperComponent, {
      data: {
        file,
        maxSizeMb: 0.5,
        resizeToWidth: 256,
        titleKey: 'common.tiles.shopping.productImageTitle',
        hintKey: 'common.tiles.shopping.categoryImageHint'
      },
      width: '420px',
      maxWidth: '95vw',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false
    });
    ref.afterClosed().subscribe((image?: string) => {
      if (!image) return;
      this.imageRemoved.set(false);
      this.image.set(image);
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
