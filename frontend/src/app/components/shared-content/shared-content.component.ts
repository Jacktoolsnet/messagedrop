import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { Location } from '../../interfaces/location';
import { Multimedia } from '../../interfaces/multimedia';
import { MapService } from '../../services/map.service';
import { OembedService } from '../../services/oembed.service';
import { SharedContentService } from '../../services/shared-content.service';
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
  public sharedContent: string = '';
  public countdown: number = 7;
  private countdownInterval: any;

  constructor(
    private oembedService: OembedService,
    private mapService: MapService,
    private sharedContentService: SharedContentService,
    private dialogRef: MatDialogRef<SharedContentComponent>
  ) { }

  public async ngOnInit(): Promise<void> {
    const lastContent = await this.sharedContentService.getLast();

    if (lastContent?.url) {
      this.objectFromUrl = await this.oembedService.getObjectFromUrl(lastContent.url);
      if (this.objectFromUrl && this.oembedService.isMultimedia(this.objectFromUrl)) {
        this.multimedia = this.objectFromUrl as Multimedia;
        this.countdownInterval = setInterval(() => {
          this.countdown--;
          if (this.countdown <= 0) {
            clearInterval(this.countdownInterval);
            this.dialogRef.close();
          }
        }, 1000);
      } else if (this.objectFromUrl && this.oembedService.isLocation(this.objectFromUrl)) {
        this.location = this.objectFromUrl as Location;
        this.mapService.flyToWithZoom(this.location, 17);
        this.countdownInterval = setInterval(() => {
          this.countdown--;
          if (this.countdown <= 0) {
            clearInterval(this.countdownInterval);
            this.dialogRef.close();
          }
        }, 1000);
      } else {
        this.sharedContent = JSON.stringify(lastContent, null, 2);
      }
    }
  }

  public ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
  }
}