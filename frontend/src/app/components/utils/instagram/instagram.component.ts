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
  selector: 'app-instagram',
  imports: [
    CommonModule,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './instagram.component.html',
  styleUrl: './instagram.component.css'
})
export class InstagramComponent {
  instagramUrl: string = '';
  instagramId: string | null = null;
  safeUrl: SafeResourceUrl | null = null;
  urlInvalid: boolean = true;

  constructor(
    public dialogRef: MatDialogRef<EditMessageComponent>,
    private sanitizer: DomSanitizer,
    @Inject(MAT_DIALOG_DATA) public data: {}
  ) { }

  validateUrl() {
    const regex = /^(https?:\/\/)?(www\.)?instagram\.com\/p\/([a-zA-Z0-9_-]+)(\/.*)?$/;
    const match = this.instagramUrl.match(regex);
    if (match) {
      this.instagramId = match[3];
      console.log('Instagram ID:', this.instagramId);
      this.urlInvalid = false;
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://www.instagram.com/p/${this.instagramId}/embed`
      );
    } else {
      this.instagramId = null;
      this.safeUrl = null;
      this.urlInvalid = true;
    }
  }

  onApplyClick(): void {
    let multimedia: Multimedia = {
      type: MultimediaType.YOUTUBE,
      url: '',
      contentId: null != this.instagramId ? this.instagramId : '',
      sourceUrl: this.instagramUrl,
      attribution: 'Powered by Instagram',
      title: '',
      description: ''
    }
    this.dialogRef.close(multimedia);
  }

}
