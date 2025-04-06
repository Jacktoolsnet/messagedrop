import { CommonModule } from '@angular/common';
import { Component, Input, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Multimedia } from '../../../interfaces/multimedia';

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
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://www.youtube.com/embed/${this.multimedia?.contentId}`
      );
    }
  }
}
