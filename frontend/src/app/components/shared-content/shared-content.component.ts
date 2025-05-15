import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { MatDialogClose, MatDialogContent } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { Multimedia } from '../../interfaces/multimedia';
import { OembedService } from '../../services/oembed.service';
import { SharedContentService } from '../../services/shared-content.service';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';

@Component({
  standalone: true,
  selector: 'app-shared-content',
  imports: [
    CommonModule,
    MatDialogClose,
    MatDialogContent,
    MatIcon,
    ShowmultimediaComponent
  ],
  templateUrl: './shared-content.component.html',
  styleUrl: './shared-content.component.css'
})

export class SharedContentComponent implements OnInit {
  public multimedia: Multimedia | undefined;

  constructor(
    private oembedService: OembedService,
    private sharedContentService: SharedContentService
  ) { }

  public async ngOnInit(): Promise<void> {
    const lastContent = await this.sharedContentService.getLast(); // oder Observable verwenden
    if (lastContent?.url) {
      this.multimedia = await this.oembedService.getMultimediaFromUrl(lastContent.url);
      if (this.multimedia) {
        console.log('Multimedia erhalten:', this.multimedia);
      } else {
        console.log('Keine Multimedia-Daten erkannt.');
      }
    } else {
      console.log('Kein Shared Content gefunden.');
    }
  }
}
