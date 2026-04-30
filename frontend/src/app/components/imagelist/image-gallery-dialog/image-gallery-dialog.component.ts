import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

export interface ImageGalleryItem {
  id: string;
  fileName: string;
  url: string;
}

export interface ImageGalleryDialogData {
  images: ImageGalleryItem[];
  initialIndex: number;
}

@Component({
  selector: 'app-image-gallery-dialog',
  imports: [MatButtonModule, MatIcon, TranslocoPipe],
  templateUrl: './image-gallery-dialog.component.html',
  styleUrl: './image-gallery-dialog.component.css'
})
export class ImageGalleryDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ImageGalleryDialogComponent>);
  readonly data = inject<ImageGalleryDialogData>(MAT_DIALOG_DATA);

  readonly currentIndex = signal(this.normalizeInitialIndex(this.data.initialIndex));
  readonly currentImage = computed(() => this.data.images[this.currentIndex()]);
  readonly hasMultipleImages = computed(() => this.data.images.length > 1);
  readonly positionText = computed(() => `${this.currentIndex() + 1} / ${this.data.images.length}`);

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

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.previous();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.next();
    }
  }

  private normalizeInitialIndex(index: number): number {
    if (!this.data.images.length) {
      return 0;
    }
    return Math.min(Math.max(index, 0), this.data.images.length - 1);
  }
}
