import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Multimedia } from '../../../interfaces/multimedia';
import { OembedService } from '../../../services/oembed.service';

@Component({
  selector: 'app-pinterest',
  imports: [
    CommonModule,
    MatDialogContent,
    MatButtonModule,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './import-multimedia.component.html',
  styleUrl: './import-multimedia.component.css'
})
export class ImportMultimediaComponent {
  multimediaUrl: string = '';
  multimedia: Multimedia | undefined = undefined;
  urlInvalid: boolean = true;
  safeHtml: SafeHtml | undefined;

  constructor(
    public dialogRef: MatDialogRef<ImportMultimediaComponent>,
    private oembedService: OembedService,
    private sanitizer: DomSanitizer,
    @Inject(MAT_DIALOG_DATA) public data: {}
  ) { }

  async validateUrl() {
    this.multimedia = await this.oembedService.getObjectFromUrl(this.multimediaUrl) as Multimedia;
    if (this.multimedia) {
      this.urlInvalid = false;
      this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(this.multimedia.oembed!.html ? this.multimedia.oembed!.html : '');
    } else {
      this.urlInvalid = true;
      this.safeHtml = undefined;
    }
  }

  clearContent(): void {
    this.urlInvalid = true;
    this.safeHtml = undefined;
    this.multimediaUrl = '';
    this.multimedia = undefined;
  }

  onApplyClick(): void {
    this.dialogRef.close(this.multimedia);
  }
}
