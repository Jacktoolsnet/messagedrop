import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Multimedia } from '../../../interfaces/multimedia';
import { MultimediaType } from '../../../interfaces/multimedia-type';
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
  safeUrl: SafeResourceUrl | null = null;
  urlInvalid: boolean = true;

  constructor(
    public dialogRef: MatDialogRef<EditMessageComponent>,
    private sanitizer: DomSanitizer,
    @Inject(MAT_DIALOG_DATA) public data: {}
  ) { }

  validateUrl() {
    const regex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)([?=a-zA-Z0-9_-]+)/;
    const match = this.youtubeUrl.match(regex);
    if (match) {
      this.videoId = match[5];
      this.urlInvalid = false;
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://www.youtube.com/embed/${this.videoId}`
      );
    } else {
      this.videoId = null;
      this.safeUrl = null;
      this.urlInvalid = true;
    }
  }

  onApplyClick(): void {
    let multimedia: Multimedia = {
      type: MultimediaType.YOUTUBE,
      url: '',
      videoId: null != this.videoId ? this.videoId : '',
      sourceUrl: this.youtubeUrl,
      attribution: 'Powered by YouTube',
      title: '',
      description: ''
    }
    this.dialogRef.close(multimedia);
  }
}
