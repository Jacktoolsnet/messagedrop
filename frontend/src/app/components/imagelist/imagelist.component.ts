import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, OnDestroy, OnInit, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { MasonryItemDirective } from '../../directives/masonry-item.directive';
import { BoundingBox } from '../../interfaces/bounding-box';
import { LocalImage } from '../../interfaces/local-image';
import { Location } from '../../interfaces/location';
import { User } from '../../interfaces/user';
import { GeolocationService } from '../../services/geolocation.service';
import { IndexedDbService } from '../../services/indexed-db.service';
import { LocalImageService } from '../../services/local-image.service';
import { MapService } from '../../services/map.service';
import { SharedContentService } from '../../services/shared-content.service';
import { UserService } from '../../services/user.service';
import { DeleteImageComponent } from './delete-image/delete-image.component';
import { OverrideExifDataComponent } from './override-exif-data/override-exif-data.component';

type ImageDialogData = {
  location: Location;
  imagesSignal: WritableSignal<LocalImage[]>;
  boundingBox?: BoundingBox;
  skipExifOverride?: boolean;
};

@Component({
  selector: 'app-notelist',
  imports: [
    MatBadgeModule,
    MatCardModule,
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatMenuModule,
    MatInputModule,
    MasonryItemDirective
  ],
  templateUrl: './imagelist.component.html',
  styleUrl: './imagelist.component.css',
  standalone: true
})
export class ImagelistComponent implements OnInit, OnDestroy {
  private readonly snackBar = inject(MatSnackBar);
  private readonly indexedDbService = inject(IndexedDbService);
  private readonly dialogData = inject<ImageDialogData>(MAT_DIALOG_DATA);
  public readonly userService = inject(UserService);
  private readonly localImageService = inject(LocalImageService);
  private readonly mapService = inject(MapService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly sharedContentService = inject(SharedContentService);
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
    this.mapService.setCircleMarker();
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

  deleteImage(image: LocalImage) {
    const dialogRef = this.dialog.open(DeleteImageComponent);
    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        await this.localImageService.deleteImage(image);
        const updatedNotes = this.imagesSignal().filter(n => n.id !== image.id);
        this.imagesSignal.set(updatedNotes);
      }
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
      this.snackBar.open('File picker is not supported in this browser.', undefined, { duration: 4000 });
      return;
    }

    const location = this.dialogData.location ? this.dialogData.location : this.mapService.getMapLocation();

    try {
      const entries = await this.localImageService.createImageEntries(location);

      if (!entries.length) {
        return;
      }

      if (this.dialogData.skipExifOverride) {
        await Promise.all(entries.map(entry => this.indexedDbService.saveImage(entry)));
        const updatedImages = [...entries, ...this.imagesSignal()];
        this.imagesSignal.set(updatedImages);
      } else {
        const resolvedEntries = await this.resolveExifOverrides(entries);
        await Promise.all(resolvedEntries.map(entry => this.indexedDbService.saveImage(entry)));
        const updatedImages = [...resolvedEntries, ...this.imagesSignal()];
        this.imagesSignal.set(updatedImages);
      }
      this.snackBar.open('Image(s) imported locally.', undefined, { duration: 3000 });
    } catch (error) {
      console.error('Failed to add image', error);
      this.snackBar.open('Unable to import the image.', undefined, { duration: 4000 });
    }
  }

  private async resolveExifOverrides(entries: LocalImage[]): Promise<LocalImage[]> {
    if (this.dialogData?.skipExifOverride) {
      return entries.map(entry => ({
        ...entry,
        location: this.dialogData.location ? this.dialogData.location : this.mapService.getMapLocation(),
        hasExifLocation: false
      }));
    }

    let rememberedChoice: boolean | null = null; // null = ask; true = use map; false = keep exif
    const result: LocalImage[] = [];

    for (const entry of entries) {
      if (entry.hasExifLocation && entry.location && rememberedChoice === null) {
        const previewUrl = await this.localImageService.getImageUrl(entry).catch(() => undefined);
        const dialogResult = await firstValueFrom(
          this.dialog.open(OverrideExifDataComponent, {
            data: { fileName: entry.fileName, previewUrl },
            autoFocus: true,
          }).afterClosed()
        );

        const useMap = dialogResult?.useMap === true;
        if (dialogResult?.applyToAll) {
          rememberedChoice = useMap;
        }

        if (useMap) {
          entry.location = this.mapService.getMapLocation();
          entry.hasExifLocation = false;
        }
      } else if (entry.hasExifLocation && entry.location && rememberedChoice === true) {
        entry.location = this.mapService.getMapLocation();
        entry.hasExifLocation = false;
      }

      result.push(entry);
    }

    return result;
  }

}
