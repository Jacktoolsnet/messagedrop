import { Component, EventEmitter, Output, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { Multimedia } from '../../../interfaces/multimedia';
import { ImportMultimediaComponent } from '../../utils/import-multimedia/import-multimedia.component';
import { StickerPickerComponent } from '../../utils/sticker-picker/sticker-picker.component';
import { TenorSearchComponent } from '../../utils/tenor-search/tenor-search.component';

@Component({
  selector: 'app-select-multimedia',
  imports: [
    MatButtonModule,
    TranslocoPipe
  ],
  templateUrl: './select-multimedia.component.html',
  styleUrl: './select-multimedia.component.css'
})
export class SelectMultimediaComponent {
  @Output() newMultimedia = new EventEmitter<Multimedia>();

  private readonly matDialog = inject(MatDialog);
  readonly dialogRef = inject(MatDialogRef<SelectMultimediaComponent>);

  public openStickerDialog(): void {
    const dialogRef = this.matDialog.open(StickerPickerComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((multimedia?: Multimedia | null) => {
      if (multimedia) {
        this.newMultimedia.emit(multimedia);
      }
    });
  }

  public openTenorDialog(): void {
    const dialogRef = this.matDialog.open(TenorSearchComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((multimedia?: Multimedia) => {
      if (multimedia) {
        this.newMultimedia.emit(multimedia);
      }
    });
  }

  public openImportMultimediaDialog(): void {
    const dialogRef = this.matDialog.open(ImportMultimediaComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((multimedia?: Multimedia) => {
      if (multimedia) {
        this.newMultimedia.emit(multimedia);
      }
    });
  }

}
