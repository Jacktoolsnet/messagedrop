import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Multimedia } from '../../../interfaces/multimedia';
import { MultimediaType } from '../../../interfaces/multimedia-type';
import { Oembed } from '../../../interfaces/oembed';
import { OembedService } from '../../../services/oembed.service';

@Component({
  selector: 'app-pinterest',
  imports: [
    CommonModule,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './pinterest.component.html',
  styleUrl: './pinterest.component.css'
})
export class PinterestComponent {
  pinterestUrl: string = '';
  pinterestId: string | null = null;
  oembed: Oembed | undefined;
  safeHtml: SafeHtml | undefined;
  urlInvalid: boolean = true;

  constructor(
    public dialogRef: MatDialogRef<PinterestComponent>,
    private oembedService: OembedService,
    private sanitizer: DomSanitizer,
    @Inject(MAT_DIALOG_DATA) public data: {}
  ) { }

  validateUrl() {
    const pinterestRegex = /pinterest\.[a-z]{2,3}(\.[a-z]{2,3})?\/pin\/.*-([^\/]+)/i;
    const pinterestMatch = this.pinterestUrl.match(pinterestRegex);
    const pinterestShortRegex = /https:\/\/pin\.it\/([a-zA-Z0-9]+)/;;
    const pinterestShortMatch = this.pinterestUrl.match(pinterestShortRegex);
    const pinterrestFinalRegex = /pinterest\.[a-z]{2,3}(\.[a-z]{2,3})?\/pin\/(\d+)/i;
    const pinterrestFinalMatch = this.pinterestUrl.match(pinterrestFinalRegex);
    if (pinterestShortMatch) {
      this.oembedService.resolveRedirectUrl(this.pinterestUrl)
        .subscribe({
          next: firstResponse => {
            this.oembedService.resolveRedirectUrl(firstResponse.result)
              .subscribe({
                next: finalResponse => {
                  const regex = /^(https?:\/\/)?(www\.)?pinterest\.[a-z]{2,3}\/pin\/\d+/;
                  const match = finalResponse.result.match(regex);
                  if (match) {
                    if (match[0] != this.pinterestUrl) {
                      this.pinterestUrl = match[0].replace(/pinterest\.[a-z]{2,3}/, 'pinterest.com');
                      this.validateUrl();
                    }
                  }
                },
                error: (err) => { },
                complete: () => { }
              });
          },
          error: (err) => { },
          complete: () => { }
        });
    } else if (pinterestMatch && pinterestMatch[2]) {
      this.pinterestUrl = this.pinterestUrl.substring(0, this.pinterestUrl.indexOf('/pin/') + 5) + pinterestMatch[2];
      this.validateUrl();
    } else if (pinterrestFinalMatch && pinterrestFinalMatch[2]) {
      this.oembedService.getPinterestEmbedCode(this.pinterestUrl)
        .subscribe({
          next: response => {
            this.oembed = response.result;
            this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(this.oembed!.html ? this.oembed!.html : '');
          },
          error: (err) => {
            this.urlInvalid = true;
          },
          complete: () => { }
        });
      this.pinterestId = pinterrestFinalMatch[2];
      this.urlInvalid = false;
    } else {
      this.pinterestId = null;
      this.safeHtml = undefined;
      this.urlInvalid = true;
    }
  }

  onApplyClick(): void {
    let multimedia: Multimedia = {
      type: MultimediaType.PINTEREST,
      url: '',
      contentId: null != this.pinterestId ? this.pinterestId : '',
      sourceUrl: this.pinterestUrl,
      attribution: 'Powered by Pinterest',
      title: '',
      description: '',
      oembed: this.oembed
    }
    this.dialogRef.close(multimedia);
  }
}
