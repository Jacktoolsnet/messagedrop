import { A11yModule } from '@angular/cdk/a11y';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { IndexedDbService } from '../../../../services/indexed-db.service';
import { LocalImageService } from '../../../../services/local-image.service';
import { MapService } from '../../../../services/map.service';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { DisplayMessageService } from '../../../../services/display-message.service';
import { isQuotaExceededError } from '../../../../utils/storage-error.util';
import { LocalImage } from '../../../../interfaces/local-image';
import { TileImageEntry, TileSetting } from '../../../../interfaces/tile-settings';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';
import {
  TileDisplaySettingsDialogComponent,
  TileDisplaySettingsDialogData,
  TileDisplaySettingsDialogResult
} from '../../tile-display-settings-dialog/tile-display-settings-dialog.component';
import { ImageTileGalleryDialogComponent, ImageTileGalleryItem } from '../image-tile-gallery-dialog/image-tile-gallery-dialog.component';

interface ImageTileDialogData {
  tile: TileSetting;
  onTileCommit?: (updated: TileSetting) => void;
}

@Component({
  selector: 'app-image-tile-edit',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    ReactiveFormsModule,
    MatDialogModule,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIcon,
    A11yModule,
    CdkDrag,
    CdkDropList,
    CdkDragHandle,
    DatePipe,
    TranslocoPipe
  ],
  templateUrl: './image-tile-edit.component.html',
  styleUrl: './image-tile-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageTileEditComponent implements OnInit, OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<ImageTileEditComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly localImageService = inject(LocalImageService);
  private readonly indexedDbService = inject(IndexedDbService);
  private readonly mapService = inject(MapService);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly translation = inject(TranslationHelperService);
  readonly data = inject<ImageTileDialogData>(MAT_DIALOG_DATA);

  private readonly fallbackTitle = this.translation.t('common.tileTypes.image');
  private readonly initialEntries = this.normalizeImageEntries(this.data.tile.payload?.images);
  private readonly initialImageIds = new Set(this.initialEntries.map((image) => image.id));
  private readonly imageUrls = signal<Record<string, string>>({});

  readonly titleControl = new FormControl(
    this.data.tile.payload?.title ?? this.data.tile.label ?? this.fallbackTitle,
    { nonNullable: true }
  );
  readonly icon = signal<string | undefined>(this.data.tile.payload?.icon);
  readonly images = signal<LocalImage[]>([]);

  private initialImages: LocalImage[] = [];
  private saved = false;

  get headerTitle(): string {
    return this.titleControl.value.trim() || this.fallbackTitle;
  }

  get headerIcon(): string {
    return this.icon() || 'photo_library';
  }

  get hasImages(): boolean {
    return this.images().length > 0;
  }

  get previewItems(): { image: LocalImage; src?: string }[] {
    const urls = this.imageUrls();
    return this.images().map((image) => ({
      image,
      src: urls[image.id]
    }));
  }

  async ngOnInit(): Promise<void> {
    const storedImages = await this.localImageService.getImagesByIds(this.initialEntries.map((image) => image.id));
    this.initialImages = storedImages;
    this.images.set(storedImages);
    await this.refreshImageUrls(storedImages);
    this.cdr.markForCheck();
  }

  ngOnDestroy(): void {
    if (!this.saved) {
      void this.cleanupUnsavedImages();
    }
    this.localImageService.revokeAllImageUrls();
  }

  openDisplaySettings(): void {
    const ref = this.dialog.open<TileDisplaySettingsDialogComponent, TileDisplaySettingsDialogData, TileDisplaySettingsDialogResult | undefined>(
      TileDisplaySettingsDialogComponent,
      {
        width: '460px',
        maxWidth: '95vw',
        data: {
          title: this.headerTitle,
          icon: this.icon(),
          fallbackTitle: this.fallbackTitle,
          dialogTitleKey: 'common.tileEdit.displaySettingsTitle'
        },
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        disableClose: false,
      }
    );

    ref.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }
      this.titleControl.setValue(result.title);
      this.icon.set(result.icon);
      this.cdr.markForCheck();
      this.commitDisplaySettings();
    });
  }

  async addImages(): Promise<void> {
    if (!this.localImageService.isSupported()) {
      this.snackBar.open(this.translation.t('common.images.filePickerUnsupported'), undefined, { duration: 4000 });
      return;
    }

    let picked: LocalImage[] = [];
    try {
      picked = await this.localImageService.createImageEntries(this.mapService.getMapLocation());
    } catch (error) {
      const message = isQuotaExceededError(error)
        ? this.translation.t('common.images.storageFull')
        : this.translation.t('common.images.importFailed');
      this.snackBar.open(message, undefined, { duration: 4000 });
      return;
    }

    if (!picked.length) {
      const message = this.localImageService.lastErrorSignal();
      if (message) {
        this.snackBar.open(message, undefined, { duration: 4000 });
      }
      return;
    }

    const updated = this.normalizeImages([...this.images(), ...picked]);
    this.images.set(updated);
    await this.refreshImageUrls(updated);
    this.cdr.markForCheck();
  }

  async deleteImage(image: LocalImage): Promise<void> {
    this.images.set(this.images().filter((item) => item.id !== image.id));
    this.imageUrls.update((current) => {
      const next = { ...current };
      delete next[image.id];
      return next;
    });

    if (!this.initialImageIds.has(image.id)) {
      await this.localImageService.deleteImage(image);
    }
  }

  drop(event: CdkDragDrop<LocalImage[]>): void {
    const updated = [...this.images()];
    moveItemInArray(updated, event.previousIndex, event.currentIndex);
    this.images.set(updated);
  }

  openImage(): void {
    const items = this.buildGalleryItems();
    if (!items.length) {
      return;
    }

    this.dialog.open(ImageTileGalleryDialogComponent, {
      width: 'min(720px, 95vw)',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {
        title: this.headerTitle,
        images: items
      },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }

  handleImageError(image: LocalImage): void {
    void this.reloadSingle(image);
  }

  cancel(): void {
    this.dialogRef.close();
  }

  async save(): Promise<void> {
    const title = this.titleControl.value.trim() || this.fallbackTitle;
    const images = this.normalizeImages(this.images());
    const removedImages = this.initialImages.filter((initial) => !images.some((current) => current.id === initial.id));

    try {
      await Promise.all(images.map((image) => this.indexedDbService.saveImage(image)));
      await Promise.all(removedImages.map((image) => this.localImageService.deleteImage(image)));
    } catch (error) {
      console.error('Failed to persist tile images', error);
      const message = isQuotaExceededError(error)
        ? this.translation.t('common.images.storageFull')
        : this.translation.t('common.images.importFailed');
      this.snackBar.open(message, undefined, { duration: 4000 });
      return;
    }

    this.saved = true;

    const updated: TileSetting = {
      ...this.data.tile,
      label: title,
      payload: {
        ...this.data.tile.payload,
        title,
        icon: this.icon(),
        images: images.map((image, index) => ({
          id: image.id,
          fileName: image.fileName,
          mimeType: image.mimeType,
          width: image.width,
          height: image.height,
          exifCaptureDate: image.exifCaptureDate,
          addedAt: image.timestamp,
          order: index
        }))
      }
    };

    this.dialogRef.close(updated);
  }

  private async refreshImageUrls(images: LocalImage[]): Promise<void> {
    const urls = await Promise.all(images.map(async (image) => {
      const url = await this.loadUrlWithRetry(image);
      return [image.id, url] as const;
    }));
    this.imageUrls.set(Object.fromEntries(urls));
  }

  private async reloadSingle(image: LocalImage): Promise<void> {
    const url = await this.loadUrlWithRetry(image);
    this.imageUrls.update((current) => ({
      ...current,
      [image.id]: url
    }));
  }

  private async loadUrlWithRetry(image: LocalImage): Promise<string> {
    try {
      return await this.localImageService.getImageUrl(image);
    } catch {
      this.localImageService.revokeImageUrl(image);
      try {
        return await this.localImageService.getImageUrl(image);
      } catch {
        return 'NOT_FOUND';
      }
    }
  }

  private buildGalleryItems(): ImageTileGalleryItem[] {
    const urls = this.imageUrls();
    return this.images()
      .map((image) => ({
        id: image.id,
        src: urls[image.id],
        alt: image.fileName || this.translation.t('common.tiles.images.previewAlt')
      }))
      .filter((item) => Boolean(item.src) && item.src !== 'NOT_FOUND') as ImageTileGalleryItem[];
  }

  private normalizeImageEntries(images?: TileImageEntry[]): TileImageEntry[] {
    return (images ?? [])
      .map((image, index) => ({
        id: image.id,
        fileName: (image.fileName ?? '').trim(),
        mimeType: image.mimeType,
        width: Number.isFinite(image.width) ? image.width : undefined,
        height: Number.isFinite(image.height) ? image.height : undefined,
        exifCaptureDate: image.exifCaptureDate,
        addedAt: Number.isFinite(image.addedAt) ? image.addedAt : Date.now(),
        order: Number.isFinite(image.order) ? image.order : index
      }))
      .filter((image) => image.id)
      .sort((a, b) => a.order - b.order);
  }

  private normalizeImages(images: LocalImage[]): LocalImage[] {
    const seen = new Set<string>();
    return images.filter((image) => {
      if (!image.id || seen.has(image.id)) {
        return false;
      }
      seen.add(image.id);
      return true;
    });
  }

  private async cleanupUnsavedImages(): Promise<void> {
    const unsavedImages = this.images().filter((image) => !this.initialImageIds.has(image.id));
    await Promise.all(unsavedImages.map((image) => this.localImageService.deleteImage(image).catch(() => undefined)));
  }

  private commitDisplaySettings(): void {
    const title = this.titleControl.value.trim() || this.fallbackTitle;
    const updated: TileSetting = {
      ...this.data.tile,
      label: title,
      payload: {
        ...this.data.tile.payload,
        title,
        icon: this.icon()
      }
    };
    this.data.tile = updated;
    this.data.onTileCommit?.(updated);
  }
}
