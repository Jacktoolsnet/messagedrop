import { Component, computed, effect, inject, OnDestroy, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { LocalImage } from '../../../interfaces/local-image';
import { LocalImageService } from '../../../services/local-image.service';

export interface ImageGalleryItem {
  id: string;
  fileName: string;
  image: LocalImage;
}

export interface ImageGalleryDialogData {
  images: ImageGalleryItem[];
  initialIndex: number;
}

@Component({
  selector: 'app-image-gallery-dialog',
  imports: [MatButtonModule, MatIcon, TranslocoPipe],
  templateUrl: './image-gallery-dialog.component.html',
  styleUrl: './image-gallery-dialog.component.css',
  host: {
    '(document:keydown)': 'onDocumentKeydown($event)'
  }
})
export class ImageGalleryDialogComponent implements OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<ImageGalleryDialogComponent>);
  private readonly localImageService = inject(LocalImageService);
  readonly data = inject<ImageGalleryDialogData>(MAT_DIALOG_DATA);

  private readonly loadingIds = new Set<string>();
  readonly imageUrls = signal<Record<string, string>>({});
  readonly currentIndex = signal(this.normalizeInitialIndex(this.data.initialIndex));
  readonly currentImage = computed(() => this.data.images[this.currentIndex()]);
  readonly hasMultipleImages = computed(() => this.data.images.length > 1);
  readonly previousImage = computed(() => this.getImageAtOffset(-1));
  readonly nextImage = computed(() => this.getImageAtOffset(1));
  readonly currentImageUrl = computed(() => this.imageUrls()[this.currentImage().id]);
  readonly previousImageUrl = computed(() => {
    const image = this.previousImage();
    return image ? this.imageUrls()[image.id] : undefined;
  });
  readonly nextImageUrl = computed(() => {
    const image = this.nextImage();
    return image ? this.imageUrls()[image.id] : undefined;
  });
  readonly positionText = computed(() => `${this.currentIndex() + 1} / ${this.data.images.length}`);

  constructor() {
    effect(() => {
      this.ensureUrl(this.currentImage());
      this.ensureUrl(this.previousImage());
      this.ensureUrl(this.nextImage());
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  previous(): void {
    if (!this.hasMultipleImages()) {
      return;
    }
    this.currentIndex.update(index => index === 0 ? this.data.images.length - 1 : index - 1);
  }

  next(): void {
    if (!this.hasMultipleImages()) {
      return;
    }
    this.currentIndex.update(index => index === this.data.images.length - 1 ? 0 : index + 1);
  }

  onDocumentKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.previous();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.next();
    }
  }

  ngOnDestroy(): void {
    for (const url of Object.values(this.imageUrls())) {
      URL.revokeObjectURL(url);
    }
  }

  private ensureUrl(item: ImageGalleryItem | undefined): void {
    if (!item || this.imageUrls()[item.id] || this.loadingIds.has(item.id)) {
      return;
    }

    this.loadingIds.add(item.id);
    this.localImageService.createTemporaryImageUrl(item.image)
      .then(url => {
        this.imageUrls.update(urls => ({ ...urls, [item.id]: url }));
      })
      .catch(error => {
        console.error('Failed to create gallery image URL', error);
      })
      .finally(() => this.loadingIds.delete(item.id));
  }

  private getImageAtOffset(offset: number): ImageGalleryItem | undefined {
    if (!this.hasMultipleImages()) {
      return undefined;
    }

    const length = this.data.images.length;
    const index = (this.currentIndex() + offset + length) % length;
    return this.data.images[index];
  }

  private normalizeInitialIndex(index: number): number {
    if (!this.data.images.length) {
      return 0;
    }
    return Math.min(Math.max(index, 0), this.data.images.length - 1);
  }
}
