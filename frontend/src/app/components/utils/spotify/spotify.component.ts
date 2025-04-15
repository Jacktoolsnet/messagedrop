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
import { YoutubeComponent } from '../youtube/youtube.component';

@Component({
  selector: 'app-spotify',
  imports: [
    CommonModule,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './spotify.component.html',
  styleUrl: './spotify.component.css'
})
export class SpotifyComponent {
  spotifyUrl: string = '';
  spotifyId: string | null = null;
  oembed: Oembed | undefined;
  safeHtml: SafeHtml | undefined;
  urlInvalid: boolean = true;

  constructor(
    public dialogRef: MatDialogRef<YoutubeComponent>,
    private oembedService: OembedService,
    private sanitizer: DomSanitizer,
    @Inject(MAT_DIALOG_DATA) public data: {}
  ) { }

  validateUrl() {
    const spotifyRegex = /https?:\/\/open\.spotify\.com\/(track|album|artist|playlist)\/([a-zA-Z0-9]+)/;
    const spotifyMatch = this.spotifyUrl.match(spotifyRegex);
    console.log(spotifyMatch);
    if (spotifyMatch && spotifyMatch[2]) {
      this.oembedService.getSpotifyEmbedCode(spotifyMatch[0])
        .subscribe({
          next: response => {
            console.log(response);
            this.oembed = response.result;
            this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(this.oembed!.html ? this.oembed!.html : '');
          },
          error: (err) => {
          },
          complete: () => { }
        });
      this.spotifyUrl = spotifyMatch[0];
      this.spotifyId = spotifyMatch[2];
      this.urlInvalid = false;
    } else {
      this.spotifyId = null;
      this.safeHtml = undefined;
      this.urlInvalid = true;
    }
  }

  onApplyClick(): void {
    let multimedia: Multimedia = {
      type: MultimediaType.YOUTUBE,
      url: '',
      contentId: null != this.spotifyId ? this.spotifyId : '',
      sourceUrl: this.spotifyUrl,
      attribution: 'Powered by YouTube',
      title: '',
      description: '',
      oembed: this.oembed
    }
    this.dialogRef.close(multimedia);
  }
}
