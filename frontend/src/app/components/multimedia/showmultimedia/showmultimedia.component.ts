import { CommonModule } from '@angular/common';
import { Component, Input, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';
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
  safeHtml: SafeHtml | undefined;

  constructor(private sanitizer: DomSanitizer) {
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['multimedia']) {
      this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(this.multimedia?.oembed?.html ? this.multimedia?.oembed.html : '');
    }
  }
}
