import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { Location } from '../../interfaces/location';
import { Multimedia } from '../../interfaces/multimedia';
import { MapService } from '../../services/map.service';
import { SharedContentService } from '../../services/shared-content.service';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';

@Component({
  standalone: true,
  selector: 'app-shared-content',
  imports: [
    CommonModule,
    MatDialogContent,
    MatButtonModule,
    MatDialogTitle,
    MatDialogActions,
    MatDialogClose,
    ShowmultimediaComponent,
    MatDialogModule
  ],
  templateUrl: './shared-content.component.html',
  styleUrl: './shared-content.component.css'
})

export class SharedContentComponent implements OnInit {
  public objectFromUrl: Multimedia | Location | undefined = undefined;
  public multimedia: Multimedia | undefined = undefined;
  public location: Location | undefined = undefined;
  public countdown: number = 7;
  private countdownInterval: any;

  constructor(
    private mapService: MapService,
    private sharedContentService: SharedContentService,
    private dialogRef: MatDialogRef<SharedContentComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { multimedia: Multimedia | undefined, location: Location | undefined }
  ) {
    this.multimedia = data.multimedia;
    this.location = data.location;
  }

  public async ngOnInit(): Promise<void> {
    if (this.data.location) {
      this.countdown = 1;
      this.mapService.moveToWithZoom(this.data.location, 17);
    }

    /*this.countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(this.countdownInterval);
        this.dialogRef.close();
      }
    }, 1000);*/
  }

  public deleteSharedContent(): void {
    if (this.multimedia) {
      this.sharedContentService.deleteSharedContent('last');
      this.sharedContentService.deleteSharedContent('lastMultimedia');
    }
    this.dialogRef.close();
  }

  public deleteSharedLocation(): void {
    if (this.location) {
      this.sharedContentService.deleteSharedContent('last');
      this.sharedContentService.deleteSharedContent('lastLocation');
    }
  }

  public ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }
}