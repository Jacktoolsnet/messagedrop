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
  selector: 'app-instagram',
  imports: [
    CommonModule,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './tiktok.component.html',
  styleUrl: './tiktok.component.css'
})
export class TiktokComponent {
  tiktokUrl: string = '';
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
    const tiktokRegex = /^(https?:\/\/)?(www\.)?tiktok\.com\/@[\w.-]+\/video\/(\d+)/;
    const tiktokMatch = this.tiktokUrl.match(tiktokRegex);
    if (tiktokMatch) {
      this.oembedService.getTikTokEmbedCode(this.tiktokUrl)
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
      type: MultimediaType.TIKTOK,
      url: '',
      contentId: null != this.videoId ? this.videoId : '',
      sourceUrl: this.tiktokUrl,
      attribution: 'Powered by TikTok',
      title: '',
      description: '',
      oembed: this.oembed
    }
    this.dialogRef.close(multimedia);
  }

}
