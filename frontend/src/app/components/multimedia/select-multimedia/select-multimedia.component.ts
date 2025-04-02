import { Component, EventEmitter, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { Multimedia } from '../../../interfaces/multimedia';
import { TenorComponent } from '../../utils/tenor/tenor.component';
import { YoutubeComponent } from '../../utils/youtube/youtube.component';

@Component({
  selector: 'app-select-multimedia',
  imports: [
    MatButtonModule,
    MatIcon,
  ],
  templateUrl: './select-multimedia.component.html',
  styleUrl: './select-multimedia.component.css'
})
export class SelectMultimediaComponent {
  @Output() newMultimedia = new EventEmitter<Multimedia>();

  constructor(
    private tenorDialog: MatDialog,
    private youtubeDialog: MatDialog,
    public dialogRef: MatDialogRef<SelectMultimediaComponent>,
  ) { }

  public openTenorDialog(): void {
    const dialogRef = this.tenorDialog.open(TenorComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      width: '90vw',
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: '90vh',
      height: '90vh',
      maxHeight: '90vh',
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => { });

    dialogRef.afterClosed().subscribe((multimedia: Multimedia) => {
      if (undefined !== multimedia) {
        this.newMultimedia.emit(multimedia);
      }
    });
  }

  public openYoutubeDialog(): void {
    const dialogRef = this.youtubeDialog.open(YoutubeComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      width: '90vw',
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: '90vh',
      height: '90vh',
      maxHeight: '90vh',
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => { });

    dialogRef.afterClosed().subscribe((multimedia: Multimedia) => {
      if (undefined !== multimedia) {
        this.newMultimedia.emit(multimedia);
      }
    });
  }

}
