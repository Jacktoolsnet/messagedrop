import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, OnDestroy, effect, inject, signal, untracked } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Contact } from '../../../interfaces/contact';
import { ExperienceTileContext } from '../../../interfaces/experience-tile-context';
import { BoundingBox } from '../../../interfaces/bounding-box';
import { LocalImage } from '../../../interfaces/local-image';
import { Place } from '../../../interfaces/place';
import { TileImageEntry, TileSetting } from '../../../interfaces/tile-settings';
import { ContactService } from '../../../services/contact.service';
import { ExperienceBookmarkService } from '../../../services/experience-bookmark.service';
import { LocalImageService } from '../../../services/local-image.service';
import { PlaceService } from '../../../services/place.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { ImageTileEditComponent } from './image-tile-edit/image-tile-edit.component';
import { ImageTileGalleryDialogComponent, ImageTileGalleryItem } from './image-tile-gallery-dialog/image-tile-gallery-dialog.component';

interface ImageTilePreviewItem {
  entry: TileImageEntry;
  image?: LocalImage;
  src?: string;
  missing: boolean;
}

@Component({
  selector: 'app-image-tile',
  standalone: true,
  imports: [MatIcon, TranslocoPipe],
  templateUrl: './image-tile.component.html',
  styleUrl: './image-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageTileComponent implements OnChanges, OnDestroy {
  @Input() tile!: TileSetting;
  @Input() place?: Place;
  @Input() contact?: Contact;
  @Input() experience?: ExperienceTileContext;

  private readonly dialog = inject(MatDialog);
  private readonly placeService = inject(PlaceService);
  private readonly contactService = inject(ContactService);
  private readonly experienceBookmarkService = inject(ExperienceBookmarkService);
  private readonly localImageService = inject(LocalImageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translation = inject(TranslationHelperService);

  readonly currentTile = signal<TileSetting | null>(null);
  readonly localPlaceImages = signal<LocalImage[]>([]);
  readonly resolvedImages = signal<LocalImage[]>([]);
  readonly previewUrls = signal<Record<string, string>>({});

  private loadVersion = 0;
  private lastTileStateKey = '';
  private lastLocalImageLoadKey = '';

  constructor() {
    effect(() => {
      this.localImageService.getImagesSignal()();
      this.refreshLocalPlaceImagesFromSignal();
    });
  }

  ngOnChanges(): void {
    const tileStateKey = this.getTileStateKey();
    const tileChanged = tileStateKey !== this.lastTileStateKey;
    if (tileChanged) {
      this.lastTileStateKey = tileStateKey;
      this.currentTile.set(this.tile);
    }

    const localImageLoadKey = this.getLocalImageLoadKey();
    if (localImageLoadKey !== this.lastLocalImageLoadKey) {
      this.lastLocalImageLoadKey = localImageLoadKey;
      if (this.place?.boundingBox) {
        void this.loadLocalPlaceImages();
        return;
      }
    }

    if (tileChanged) {
      void this.loadImages();
    }
  }

  private getTileStateKey(): string {
    const payload = this.tile?.payload;
    return JSON.stringify({
      id: this.tile?.id,
      type: this.tile?.type,
      label: this.tile?.label,
      title: payload?.title,
      icon: payload?.icon,
      images: this.place ? [] : payload?.images
    });
  }

  private getLocalImageLoadKey(): string {
    const boundingBox = this.place?.boundingBox;
    if (!boundingBox) {
      return 'none';
    }

    return `${this.place?.id ?? ''}:${boundingBox.latMin}:${boundingBox.latMax}:${boundingBox.lonMin}:${boundingBox.lonMax}`;
  }

  ngOnDestroy(): void {
    this.previewUrls.set({});
    this.localImageService.revokeAllImageUrls();
  }

  get title(): string {
    const tile = this.currentTile();
    const fallback = this.translation.t('common.tileTypes.image');
    return tile?.payload?.title?.trim() || tile?.label || fallback;
  }

  get icon(): string {
    return this.currentTile()?.payload?.icon || 'photo_library';
  }

  get imageEntries(): TileImageEntry[] {
    const tileEntries = this.place
      ? []
      : this.normalizeImageEntries(this.currentTile()?.payload?.images);
    return this.mergeImageEntries(
      tileEntries,
      this.localPlaceImages().map((image, index) => this.localImageToTileEntry(image, index))
    );
  }

  get hasImages(): boolean {
    return this.imageEntries.length > 0;
  }

  get previewItems(): ImageTilePreviewItem[] {
    const imageMap = new Map(this.resolvedImages().map((image) => [image.id, image]));
    const urlMap = this.previewUrls();

    return this.imageEntries.map((entry) => {
      const image = imageMap.get(entry.id);
      const src = urlMap[entry.id];
      return {
        entry,
        image,
        src,
        missing: !image || !src || src === 'NOT_FOUND'
      };
    });
  }

  openEditor(): void {
    const tile = this.currentTile();
    if (!tile) return;

    const dialogRef = this.dialog.open(ImageTileEditComponent, {
      width: '560px',
      maxWidth: '95vw',
      maxHeight: '98vh',
      data: {
        tile,
        location: this.place?.location,
        initialImages: this.place ? this.localPlaceImages() : undefined,
        persistAsLocalImages: Boolean(this.place),
        showImagesOnMap: !this.contact,
        onTileCommit: (updated: TileSetting) => this.applyTileUpdate(updated)
      },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe((updated?: TileSetting) => {
      if (!updated) return;
      this.applyTileUpdate(updated);
    });
  }

  openGallery(event: Event): void {
    event.stopPropagation();
    const images = this.buildGalleryItems();
    if (!images.length) {
      return;
    }

    this.dialog.open(ImageTileGalleryDialogComponent, {
      width: 'min(720px, 95vw)',
      maxWidth: '95vw',
      maxHeight: '90vh',
      data: {
        title: this.title,
        images
      },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }

  handleImageError(image: LocalImage, event: Event): void {
    event.stopPropagation();
    void this.reloadSingle(image);
  }

  getImageAria(item: ImageTilePreviewItem): string {
    return item.entry.fileName?.trim() || this.translation.t('common.tiles.images.previewAlt');
  }

  private async loadLocalPlaceImages(): Promise<void> {
    const boundingBox = this.place?.boundingBox;
    if (!boundingBox) {
      this.localPlaceImages.set([]);
      return;
    }

    const images = await this.localImageService.getImagesInBoundingBox(boundingBox);
    this.localPlaceImages.set(images);
    void this.loadImages();
  }

  private refreshLocalPlaceImagesFromSignal(): void {
    const boundingBox = this.place?.boundingBox;
    if (!boundingBox) {
      this.localPlaceImages.set([]);
      return;
    }

    this.localPlaceImages.set(
      this.localImageService.getImagesSignal()()
        .filter((image) => this.isInBoundingBox(image.location.latitude, image.location.longitude, boundingBox))
        .sort((a, b) => this.getSortTime(b) - this.getSortTime(a))
    );
    untracked(() => void this.loadImages());
  }

  private async loadImages(): Promise<void> {
    const version = ++this.loadVersion;
    const entries = this.imageEntries;

    if (!entries.length) {
      this.resolvedImages.set([]);
      this.previewUrls.set({});
      this.cdr.markForCheck();
      return;
    }

    const localImages = this.localPlaceImages();
    const localImageIds = new Set(localImages.map((image) => image.id));
    const storedImages = await this.localImageService.getImagesByIds(
      entries.map((entry) => entry.id).filter((id) => !localImageIds.has(id))
    );
    if (version !== this.loadVersion) {
      return;
    }

    const images = this.mergeImages(localImages, storedImages);
    this.resolvedImages.set(images);

    const urls = await Promise.all(entries.map(async (entry) => {
      const image = images.find((candidate) => candidate.id === entry.id);
      if (!image) {
        return [entry.id, 'NOT_FOUND'] as const;
      }

      const url = await this.loadUrlWithRetry(image);
      return [entry.id, url] as const;
    }));

    if (version !== this.loadVersion) {
      return;
    }

    this.previewUrls.set(Object.fromEntries(urls));
    this.cdr.markForCheck();
  }

  private async reloadSingle(image: LocalImage): Promise<void> {
    const url = await this.loadUrlWithRetry(image);
    this.previewUrls.update((current) => ({
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
    const urlMap = this.previewUrls();
    return this.imageEntries
      .map((entry) => ({
        id: entry.id,
        src: urlMap[entry.id],
        alt: entry.fileName?.trim() || this.translation.t('common.tiles.images.previewAlt')
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

  private applyTileUpdate(updated: TileSetting): void {
    if (this.place) {
      const tiles = this.upsertTile(this.place.tileSettings, updated);
      const updatedPlace = { ...this.place, tileSettings: tiles };
      this.place = updatedPlace;
      this.currentTile.set(updated);
      this.placeService.saveAdditionalPlaceInfos(updatedPlace);
    } else if (this.contact) {
      const tiles = this.upsertTile(this.contact.tileSettings, updated);
      this.contact = { ...this.contact, tileSettings: tiles };
      this.currentTile.set(updated);
      this.contactService.saveContactTileSettings(this.contact);
      this.contactService.refreshContact(this.contact.id);
    } else if (this.experience?.productCode) {
      const tiles = this.upsertTile(this.experience.tileSettings, updated);
      this.experience = { ...this.experience, tileSettings: tiles };
      this.currentTile.set(updated);
      void this.experienceBookmarkService.saveTileSettings(this.experience.productCode, tiles);
    }

    this.cdr.markForCheck();
    void this.loadImages();
  }

  private mergeImageEntries(tileEntries: TileImageEntry[], localEntries: TileImageEntry[]): TileImageEntry[] {
    const seen = new Set<string>();
    return [...localEntries, ...tileEntries]
      .filter((entry) => {
        if (!entry.id || seen.has(entry.id)) {
          return false;
        }
        seen.add(entry.id);
        return true;
      })
      .map((entry, index) => ({ ...entry, order: index }));
  }

  private localImageToTileEntry(image: LocalImage, index: number): TileImageEntry {
    return {
      id: image.id,
      fileName: image.fileName,
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      exifCaptureDate: image.exifCaptureDate,
      addedAt: image.timestamp,
      order: index
    };
  }

  private mergeImages(primary: LocalImage[], secondary: LocalImage[]): LocalImage[] {
    const seen = new Set<string>();
    return [...primary, ...secondary].filter((image) => {
      if (seen.has(image.id)) {
        return false;
      }
      seen.add(image.id);
      return true;
    });
  }

  private getSortTime(image: LocalImage): number {
    const parsed = image.exifCaptureDate ? Date.parse(image.exifCaptureDate) : NaN;
    return Number.isFinite(parsed) ? parsed : image.timestamp;
  }

  private isInBoundingBox(latitude: number, longitude: number, boundingBox: BoundingBox): boolean {
    const latMin = Math.min(boundingBox.latMin, boundingBox.latMax);
    const latMax = Math.max(boundingBox.latMin, boundingBox.latMax);
    const lon = this.normalizeLongitude(longitude);
    const lonMin = this.normalizeLongitude(boundingBox.lonMin);
    const lonMax = this.normalizeLongitude(boundingBox.lonMax);

    return latitude >= latMin
      && latitude <= latMax
      && (lonMin <= lonMax ? lon >= lonMin && lon <= lonMax : lon >= lonMin || lon <= lonMax);
  }

  private normalizeLongitude(longitude: number): number {
    return ((longitude + 180) % 360 + 360) % 360 - 180;
  }

  private upsertTile(tileSettings: TileSetting[] | undefined, updated: TileSetting): TileSetting[] {
    const tiles = tileSettings ?? [];
    const matchedById = tiles.some((tile) => tile.id === updated.id);
    if (matchedById) {
      return tiles.map((tile) => tile.id === updated.id ? { ...tile, ...updated } : tile);
    }

    const matchedByType = tiles.some((tile) => tile.type === updated.type);
    if (matchedByType) {
      return tiles.map((tile) => tile.type === updated.type ? { ...tile, ...updated, id: tile.id } : tile);
    }

    return [...tiles, updated].map((tile, index) => ({ ...tile, order: Number.isFinite(tile.order) ? tile.order : index }));
  }
}
