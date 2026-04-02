import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';

export interface ImageTileGalleryItem {
  id: string;
  src: string;
  alt: string;
}

interface ImageTileGalleryDialogData {
  title: string;
  images: ImageTileGalleryItem[];
}

@Component({
  selector: 'app-image-tile-gallery-dialog',
  imports: [
    DialogHeaderComponent,
    MatDialogContent,
    MatDialogActions,
    MatIcon,
    TranslocoPipe
  ],
  templateUrl: './image-tile-gallery-dialog.component.html',
  styleUrl: './image-tile-gallery-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ImageTileGalleryDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<ImageTileGalleryDialogComponent>);
  readonly data = inject<ImageTileGalleryDialogData>(MAT_DIALOG_DATA);

  close(): void {
    this.dialogRef.close();
  }
}
