import { CommonModule } from '@angular/common';
import { Component, Input, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Multimedia } from '../../../interfaces/multimedia';
import { MultimediaType } from '../../../interfaces/multimedia-type';

@Component({
  selector: 'app-showmultimedia',
  imports: [CommonModule],
  templateUrl: './showmultimedia.component.html',
  styleUrl: './showmultimedia.component.css'
})
export class ShowmultimediaComponent {
  @Input() multimedia: Multimedia | undefined;
  safeUrl: SafeResourceUrl | undefined;

  constructor(private sanitizer: DomSanitizer) {
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['multimedia']) {
      if (this.multimedia?.type === MultimediaType.YOUTUBE) {
        this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
          `https://www.youtube.com/embed/${this.multimedia?.contentId}`
        );
      }
      if (this.multimedia?.type === MultimediaType.INSTAGRAM) {
        if (this.multimedia.sourceUrl.includes('/reel/')) {
          this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
            `https://www.instagram.com/reel/${this.multimedia?.contentId}/embed`
          );
        } else {
          this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
            `https://www.instagram.com/p/${this.multimedia?.contentId}/embed`
          );
        }
      }
    }
    console.log(this.safeUrl);
  }
}
