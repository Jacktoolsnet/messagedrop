
import { Component, computed, effect, inject, OnDestroy, OnInit, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { BoundingBox } from '../../interfaces/bounding-box';
import { LocalImage } from '../../interfaces/local-image';
import { Location } from '../../interfaces/location';
import { User } from '../../interfaces/user';
import { GeolocationService } from '../../services/geolocation.service';
import { IndexedDbService } from '../../services/indexed-db.service';
import { LocalImageService } from '../../services/local-image.service';
import { MapService } from '../../services/map.service';
import { SharedContentService } from '../../services/shared-content.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { isQuotaExceededError } from '../../utils/storage-error.util';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { DeleteImageComponent } from './delete-image/delete-image.component';
import { OverrideExifDataComponent } from './override-exif-data/override-exif-data.component';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { DisplayMessageService } from '../../services/display-message.service';
import { LocationPickerDialogComponent } from '../utils/location-picker-dialog/location-picker-dialog.component';
import { ImageGalleryDialogComponent, type ImageGalleryItem } from './image-gallery-dialog/image-gallery-dialog.component';

type ExifLocationChoice = 'image' | 'map' | 'custom';

interface ExifLocationDialogResult {
  choice?: ExifLocationChoice;
  useMap?: boolean;
  applyToAll?: boolean;
  customLocation?: Location;
}

interface RememberedExifLocationChoice {
  choice: ExifLocationChoice;
  customLocation?: Location;
}

interface ImageDialogData {
  location: Location;
  imagesSignal: WritableSignal<LocalImage[]>;
  boundingBox?: BoundingBox;
  skipExifOverride?: boolean;
}

@Component({
  selector: 'app-notelist',
  imports: [
    DialogHeaderComponent,
    MatBadgeModule,
    MatCardModule,
    FormsModule,
    MatButtonModule,
    MatDialogContent,
    MatDialogActions,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatMenuModule,
    MatInputModule,
    TranslocoPipe
  ],
  templateUrl: './imagelist.component.html',
  styleUrl: './imagelist.component.css',
  standalone: true
})
export class ImagelistComponent implements OnInit, OnDestroy {
  private readonly snackBar = inject(DisplayMessageService);
  private readonly indexedDbService = inject(IndexedDbService);
  private readonly dialogData = inject<ImageDialogData>(MAT_DIALOG_DATA);
  public readonly userService = inject(UserService);
  private readonly localImageService = inject(LocalImageService);
  private readonly mapService = inject(MapService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly sharedContentService = inject(SharedContentService);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  public readonly dialogRef = inject(MatDialogRef<ImagelistComponent>);
  public readonly dialog = inject(MatDialog);

  readonly hasNotes = computed(() => this.imagesSignal().length > 0);
  readonly sortedImages = computed(() =>
    [...this.imagesSignal()].sort((a, b) => this.getSortTime(b) - this.getSortTime(a))
  );
  public user: User | undefined = this.userService.getUser();
  public imagesSignal: WritableSignal<LocalImage[]> = this.dialogData.imagesSignal;
  private readonly imageUrls = signal<Record<string, string>>({});
  private previousImages = new Map<string, LocalImage>();

  async ngOnInit(): Promise<void> {
    if (this.dialogData?.boundingBox) {
      const images = await this.localImageService.getImagesInBoundingBox(this.dialogData.boundingBox);
      this.imagesSignal.set(images);
    }
  }

  constructor() {
    // keep dialogData in sync without reshuffling; sorting is read-only via computed
    effect(() => {
      if (this.dialogData.imagesSignal) {
        this.dialogData.imagesSignal.set(this.imagesSignal());
      }
    });

    effect(() => {
      const images = this.imagesSignal();

      // revoke URLs for removed images
      for (const [id, prev] of this.previousImages.entries()) {
        if (!images.some(img => img.id === id)) {
          this.localImageService.revokeImageUrl(prev);
          this.imageUrls.update(map => {
            const copy = { ...map };
            delete copy[id];
            return copy;
          });
        }
      }

      // load URLs for new images
      images.forEach(image => {
        if (!this.imageUrls()[image.id]) {
          this.localImageService
            .getImageUrl(image)
            .then(url => this.imageUrls.update(map => ({ ...map, [image.id]: url })))
            .catch(() => {
              this.imageUrls.update(map => ({ ...map, [image.id]: 'NOT_FOUND' }));
            });
        }
      });

      this.previousImages = new Map(images.map(img => [img.id, img]));
    });
  }

  goBack(): void {
    this.dialogRef.close();
  }

  flyTo(localImage: LocalImage) {
    const location = { ...localImage.location, plusCode: this.geolocationService.getPlusCode(localImage.location.latitude, localImage.location.longitude) };
    if (this.dialogData.boundingBox) {
      this.mapService.fitMapToBounds(this.dialogData.boundingBox);
    } else {
      this.mapService.flyToWithZoom(location, 17);
    }
    this.dialogRef.close();
  }

  navigateToNoteLocation(localImage: LocalImage) {
    this.localImageService.navigateToNoteLocation(this.userService.getUser(), localImage);
  }

  editLocation(image: LocalImage): void {
    const dialogRef = this.dialog.open(LocationPickerDialogComponent, {
      data: { location: image.location, markerType: 'note' },
      maxWidth: '95vw',
      maxHeight: '95vh',
      width: '95vw',
      height: '95vh',
      autoFocus: false,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false
    });

    dialogRef.afterClosed().subscribe(async (location?: Location) => {
      if (!location) {
        return;
      }
      const updatedImage: LocalImage = {
        ...image,
        location: { ...location },
        hasExifLocation: false
      };
      await this.indexedDbService.saveImage(updatedImage);
      this.imagesSignal.update(images =>
        images.map(item => item.id === image.id ? updatedImage : item)
      );
    });
  }

  deleteImage(image: LocalImage) {
    const dialogRef = this.dialog.open(DeleteImageComponent, {
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        await this.localImageService.deleteImage(image);
        const updatedNotes = this.imagesSignal().filter(n => n.id !== image.id);
        this.imagesSignal.set(updatedNotes);
      }
    });
  }

  openGallery(image: LocalImage): void {
    const galleryImages: ImageGalleryItem[] = this.sortedImages()
      .filter(item => this.getImageUrl(item.id) !== 'NOT_FOUND')
      .map(item => ({
        id: item.id,
        fileName: item.fileName,
        image: item
      }));

    const initialIndex = galleryImages.findIndex(item => item.id === image.id);
    if (initialIndex < 0) {
      return;
    }

    this.dialog.open(ImageGalleryDialogComponent, {
      data: { images: galleryImages, initialIndex },
      width: '95vw',
      height: '95vh',
      maxWidth: '95vw',
      maxHeight: '95vh',
      panelClass: 'image-gallery-dialog-panel',
      autoFocus: 'dialog',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false
    });
  }

  getImageUrl(imageId: string): string | undefined {
    return this.imageUrls()[imageId];
  }

  /**
   * Sort key: prefer EXIF/lastModified captureDate if available, otherwise import timestamp.
   */
  private getSortTime(image: LocalImage): number {
    const parsed = image.exifCaptureDate ? Date.parse(image.exifCaptureDate) : NaN;
    return Number.isFinite(parsed) ? parsed : image.timestamp;
  }

  ngOnDestroy(): void {
    this.previousImages.forEach(img => this.localImageService.revokeImageUrl(img));
  }

  async openAddImageDialog(): Promise<void> {
    if (!this.localImageService.isSupported()) {
      this.snackBar.open(this.translation.t('common.images.filePickerUnsupported'), undefined, { duration: 4000 });
      return;
    }

    const location = this.dialogData.location ? this.dialogData.location : this.mapService.getMapLocation();

    try {
      const entries = await this.localImageService.createImageEntries(location);

      if (!entries.length) {
        return;
      }

      const resolvedEntries = await this.resolveExifOverrides(entries);
      await Promise.all(resolvedEntries.map(entry => this.indexedDbService.saveImage(entry)));
      const updatedImages = [...resolvedEntries, ...this.imagesSignal()];
      this.imagesSignal.set(updatedImages);

      this.snackBar.open(this.translation.t('common.images.importSuccess'), undefined, { duration: 3000 });
    } catch (error) {
      console.error('Failed to add image', error);
      const message = isQuotaExceededError(error)
        ? this.translation.t('common.images.storageFull')
        : this.translation.t('common.images.importFailed');
      this.snackBar.open(message, undefined, { duration: 4000 });
    }
  }

  private async resolveExifOverrides(entries: LocalImage[]): Promise<LocalImage[]> {
    if (this.dialogData?.location && this.dialogData?.skipExifOverride) {
      return entries.map(entry => ({
        ...entry,
        location: this.dialogData.location,
        hasExifLocation: false
      }));
    }

    let rememberedChoice: RememberedExifLocationChoice | null = null;
    const result: LocalImage[] = [];

    for (const entry of entries) {
      if (entry.hasExifLocation && entry.location) {
        if (!rememberedChoice) {
          const previewUrl = await this.localImageService.getImageUrl(entry).catch(() => undefined);
          const dialogResult = await firstValueFrom(
            this.dialog.open<OverrideExifDataComponent, unknown, ExifLocationDialogResult | undefined>(OverrideExifDataComponent, {
              data: {
                fileName: entry.fileName,
                previewUrl,
                imageLocation: entry.location,
                mapLocation: this.mapService.getMapLocation()
              },
              autoFocus: false,
              hasBackdrop: true,
              backdropClass: 'dialog-backdrop',
              disableClose: false,
            }).afterClosed()
          );

          const choice = this.resolveExifLocationChoice(dialogResult);
          const customLocation = choice === 'custom'
            ? dialogResult?.customLocation ?? await this.pickCustomExifLocation(entry.location)
            : undefined;

          if (dialogResult?.applyToAll && (choice !== 'custom' || customLocation)) {
            rememberedChoice = { choice, customLocation };
          }

          this.applyExifLocationChoice(entry, choice, customLocation);
        } else {
          this.applyExifLocationChoice(entry, rememberedChoice.choice, rememberedChoice.customLocation);
        }
      }

      result.push(entry);
    }

    return result;
  }

  private resolveExifLocationChoice(dialogResult: ExifLocationDialogResult | undefined): ExifLocationChoice {
    if (dialogResult?.choice) {
      return dialogResult.choice;
    }
    return dialogResult?.useMap === true ? 'map' : 'image';
  }

  private async pickCustomExifLocation(fallbackLocation: Location): Promise<Location | undefined> {
    return firstValueFrom(
      this.dialog.open(LocationPickerDialogComponent, {
        data: { location: fallbackLocation, markerType: 'note' },
        maxWidth: '95vw',
        maxHeight: '95vh',
        width: '95vw',
        height: '95vh',
        autoFocus: false,
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        disableClose: false
      }).afterClosed()
    );
  }

  private applyExifLocationChoice(entry: LocalImage, choice: ExifLocationChoice, customLocation?: Location): void {
    if (choice === 'map') {
      entry.location = this.mapService.getMapLocation();
      entry.hasExifLocation = false;
      return;
    }

    if (choice === 'custom' && customLocation) {
      entry.location = { ...customLocation };
      entry.hasExifLocation = false;
    }
  }

}
