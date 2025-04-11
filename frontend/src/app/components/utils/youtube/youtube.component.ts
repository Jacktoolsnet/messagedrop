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
import { EditMessageComponent } from '../../editmessage/edit-message.component';

@Component({
  selector: 'app-youtube',
  imports: [
    CommonModule,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './youtube.component.html',
  styleUrl: './youtube.component.css'
})
export class YoutubeComponent {
  youtubeUrl: string = '';
  videoId: string | null = null;
  oembed: Oembed | undefined;
  safeHtml: SafeHtml | undefined;
  urlInvalid: boolean = true;

  constructor(
    public dialogRef: MatDialogRef<EditMessageComponent>,
    private oembedService: OembedService,
    private sanitizer: DomSanitizer,
    @Inject(MAT_DIALOG_DATA) public data: {}
  ) { }

  validateUrl() {
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)([?=a-zA-Z0-9_-]+)/;
    const youtubeMatch = this.youtubeUrl.match(youtubeRegex);
    const tiktokRegex = /^(https?:\/\/)?(www\.)?tiktok\.com\/@[\w.-]+\/video\/(\d+)/;
    const tiktokMatch = this.youtubeUrl.match(tiktokRegex);
    if (youtubeMatch) {
      this.oembedService.getYoutubeEmbedCode(this.youtubeUrl)
        .subscribe({
          next: oembedCode => {
            this.oembed = oembedCode;
            this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(this.oembed.html ? this.oembed.html : '');
          },
          error: (err) => {
          },
          complete: () => { }
        });
      this.videoId = youtubeMatch[5];
      this.urlInvalid = false;
    } else if (tiktokMatch) {
      this.oembedService.getTikTokEmbedCode(this.youtubeUrl)
      this.videoId = tiktokMatch[3];
      let oembedHtml = this.oembedService.getTikTokEmbedCode(this.videoId);
      this.oembed = {
        html: oembedHtml,
        width: 0,
        height: 0,
        provider_name: 'TikTok',
        provider_url: 'https://www.tiktok.com/',
        type: 'rich',
        version: '1.0'
      };
      console.log(this.oembed)
      this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(this.oembed.html ? this.oembed.html : '');
      this.urlInvalid = false;
    } else {
      this.videoId = null;
      this.safeHtml = undefined;
      this.urlInvalid = true;
    }
  }

  onApplyClick(): void {
    let multimedia: Multimedia = {
      type: MultimediaType.YOUTUBE,
      url: '',
      contentId: null != this.videoId ? this.videoId : '',
      sourceUrl: this.youtubeUrl,
      attribution: 'Powered by YouTube',
      title: '',
      description: '',
      oembed: this.oembed
    }
    this.dialogRef.close(multimedia);
  }
}
