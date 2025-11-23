import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, Input, OnDestroy, OnInit, signal, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { LocalImage } from '../../../interfaces/local-image';
import { Place } from '../../../interfaces/place';
import { GeolocationService } from '../../../services/geolocation.service';
import { LocalImageService } from '../../../services/local-image.service';
import { ImagelistComponent } from '../../imagelist/imagelist.component';

@Component({
  selector: 'app-image-tile',
  imports: [
    CommonModule,
    MatIcon,
    MatButtonModule
  ],
  templateUrl: './image-tile.component.html',
  styleUrl: './image-tile.component.css'
})
export class ImageTileComponent implements OnInit, OnDestroy {
  @Input() place!: Place;

  readonly allPlaceImages: WritableSignal<LocalImage[]> = signal<LocalImage[]>([]);
  readonly previewImages = computed(() => this.sortImages(this.allPlaceImages()).slice(0, 4));
  readonly previewUrls = signal<string[]>([]);

  private readonly localImageService = inject(LocalImageService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly matDialog = inject(MatDialog);

  ngOnInit(): void {
    this.loadImages();
    effect(() => {
      const top = this.previewImages();
      void this.refreshPreviewUrls(top);
    });
  }

  ngOnDestroy(): void {
    this.previewUrls().forEach(url => {
      if (url && url !== 'NOT_FOUND') {
        URL.revokeObjectURL(url);
      }
    });
  }

  private async loadImages(): Promise<void> {
    if (!this.place?.boundingBox) {
      return;
    }
    const images = await this.localImageService.getImagesInBoundingBox(this.place.boundingBox);
    const sorted = this.sortImages(images);
    this.allPlaceImages.set(sorted);
  }

  private async refreshPreviewUrls(images: LocalImage[]): Promise<void> {
    const urls = await Promise.all(
      images.map(img =>
        this.localImageService
          .getImageUrl(img)
          .catch(() => 'NOT_FOUND')
      )
    );
    this.previewUrls.set(urls);
  }

  private sortImages(images: LocalImage[]): LocalImage[] {
    return [...images].sort((a, b) => this.getSortTime(b) - this.getSortTime(a));
  }

  private getSortTime(image: LocalImage): number {
    const parsed = image.exifCaptureDate ? Date.parse(image.exifCaptureDate) : NaN;
    return Number.isFinite(parsed) ? parsed : image.timestamp;
  }

  openImageDialog(): void {
    this.matDialog.open(ImagelistComponent, {
      panelClass: 'ImageListDialog',
      closeOnNavigation: true,
      data: {
        location: this.place.location,
        imagesSignal: this.allPlaceImages,
        skipExifOverride: true
      },
      minWidth: '20vw',
      maxWidth: '95vw',
      width: 'auto',
      maxHeight: 'none',
      height: 'auto',
      hasBackdrop: true,
      autoFocus: false
    });
  }
}
