import { Component, EventEmitter, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { AppSettings } from '../../../interfaces/app-settings';
import { Multimedia } from '../../../interfaces/multimedia';
import { AppService } from '../../../services/app.service';
import { EnableExternalContentComponent } from "../../utils/enable-external-content/enable-external-content.component";
import { ImportMultimediaComponent } from '../../utils/import-multimedia/import-multimedia.component';
import { TenorComponent } from '../../utils/tenor/tenor.component';

@Component({
  selector: 'app-select-multimedia',
  imports: [
    MatButtonModule,
    EnableExternalContentComponent
  ],
  templateUrl: './select-multimedia.component.html',
  styleUrl: './select-multimedia.component.css'
})
export class SelectMultimediaComponent {
  @Output() newMultimedia = new EventEmitter<Multimedia>();

  public showTenor = false;

  constructor(
    private appService: AppService,
    private tenorDialog: MatDialog,
    private multimediaDialog: MatDialog,
    public dialogRef: MatDialogRef<SelectMultimediaComponent>,
  ) {
    this.showTenor = this.appService.getAppSettings().enableTenorContent;
  }

  public openTenorDialog(): void {
    const dialogRef = this.tenorDialog.open(TenorComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(e => { });

    dialogRef.afterClosed().subscribe((multimedia: Multimedia) => {
      if (undefined !== multimedia) {
        this.newMultimedia.emit(multimedia);
      }
    });
  }

  public openImportMultimediaDialog(): void {
    const dialogRef = this.multimediaDialog.open(ImportMultimediaComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(e => { });

    dialogRef.afterClosed().subscribe((multimedia: Multimedia) => {
      if (undefined !== multimedia) {
        this.newMultimedia.emit(multimedia);
      }
    });
  }

  onEnabledChange(enabled: boolean): void {
    const current = this.appService.getAppSettings();
    const updated: AppSettings = { ...current, enableTenorContent: enabled };
    this.appService.setAppSettings(updated);
    this.showTenor = enabled;
  }

}
