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
  videoId: string | null = null;
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
    console.log(this.pinterestUrl);
    const pinterestRegex = /^(https?:\/\/)?(www\.)?pinterest\.[a-z]{2,3}\/pin\/(\d+)\/?$/;
    const pinterestMatch = this.pinterestUrl.match(pinterestRegex);
    const pinterestShortRegex = /https:\/\/pin\.it\/([a-zA-Z0-9]+)/;;
    const pinterestShortMatch = this.pinterestUrl.match(pinterestShortRegex);
    if (pinterestMatch && pinterestMatch[3]) {
      this.oembedService.getPinterestEmbedCode(this.pinterestUrl)
        .subscribe({
          next: response => {
            console.log(response);
            this.oembed = response.result;
            console.log(this.oembed);
            this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(this.oembed!.html ? this.oembed!.html : '');
          },
          error: (err) => {
            console.error(err);
            this.urlInvalid = true;
          },
          complete: () => { }
        });
      this.videoId = pinterestMatch[3];
      this.urlInvalid = false;
    } else if (pinterestShortMatch) {
      this.oembedService.resolveRedirectUrl(this.pinterestUrl)
        .subscribe({
          next: firstResponse => {
            console.log(firstResponse.result)
            this.oembedService.resolveRedirectUrl(firstResponse.result)
              .subscribe({
                next: finalResponse => {
                  const regex = /^(https?:\/\/)?(www\.)?pinterest\.[a-z]{2,3}\/pin\/\d+/;
                  const match = finalResponse.result.match(regex);
                  if (match) {
                    console.log(match[0].replace(/pinterest\.[a-z]{2,3}/, 'pinterest.com'))
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
    } else {
      this.videoId = null;
      this.safeHtml = undefined;
      this.urlInvalid = true;
    }
  }

  onApplyClick(): void {
    let multimedia: Multimedia = {
      type: MultimediaType.PINTEREST,
      url: '',
      contentId: null != this.videoId ? this.videoId : '',
      sourceUrl: this.pinterestUrl,
      attribution: 'Powered by Pinterest',
      title: '',
      description: '',
      oembed: this.oembed
    }
    this.dialogRef.close(multimedia);
  }
}
