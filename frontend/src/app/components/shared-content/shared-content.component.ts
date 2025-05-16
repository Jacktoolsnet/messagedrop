import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { Multimedia } from '../../interfaces/multimedia';
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
  public multimedia: Multimedia | undefined;
  public sharedContent: string = '';
  public countdown: number = 7;
  private countdownInterval: any;

  constructor(
    private oembedService: OembedService,
    private sharedContentService: SharedContentService,
    private dialogRef: MatDialogRef<SharedContentComponent>
  ) { }

  public async ngOnInit(): Promise<void> {
    const lastContent = await this.sharedContentService.getLast();

    if (lastContent?.url) {
      this.multimedia = await this.oembedService.getMultimediaFromUrl(lastContent.url);
      if (this.multimedia) {
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