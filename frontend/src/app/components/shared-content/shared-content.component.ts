import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { Location } from '../../interfaces/location';
import { Multimedia } from '../../interfaces/multimedia';
import { MapService } from '../../services/map.service';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';

@Component({
  standalone: true,
  selector: 'app-shared-content',
  imports: [
    CommonModule,
    MatDialogContent,
    ShowmultimediaComponent
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
    private dialogRef: MatDialogRef<SharedContentComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { multimedia: Multimedia | undefined, location: Location | undefined }
  ) {
    this.multimedia = data.multimedia;
    this.location = data.location;
  }

  public async ngOnInit(): Promise<void> {
    if (this.data.location) {
      this.countdown = 10;
      this.mapService.flyToWithZoom(this.data.location, 19);
    }

    this.countdownInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(this.countdownInterval);
        this.dialogRef.close();
      }
    }, 1000);
  }

  public ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }
}