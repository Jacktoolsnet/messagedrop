import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Contact } from '../../../interfaces/contact';
import { Mode } from '../../../interfaces/mode';
import { Multimedia } from '../../../interfaces/multimedia';
import { MultimediaType } from '../../../interfaces/multimedia-type';
import { ShortMessage } from '../../../interfaces/short-message';
import { User } from '../../../interfaces/user';
import { StyleService } from '../../../services/style.service';
import { SelectMultimediaComponent } from '../../multimedia/select-multimedia/select-multimedia.component';
import { TenorComponent } from '../../utils/tenor/tenor.component';
import { TextComponent } from '../../utils/text/text.component';

@Component({
  selector: 'app-message',
  imports: [
    SelectMultimediaComponent,
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogTitle,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule
  ],
  templateUrl: './contact-edit-message.component.html',
  styleUrl: './contact-edit-message.component.css'
})
export class ContactEditMessageComponent implements OnInit {
  safeHtml: SafeHtml | undefined = undefined;
  showSaveHtml: boolean = false;

  constructor(
    private sanitizer: DomSanitizer,
    private snackBar: MatSnackBar,
    private tenorDialog: MatDialog,
    private textDialog: MatDialog,
    public dialogRef: MatDialogRef<ContactEditMessageComponent>,
    private style: StyleService,
    @Inject(MAT_DIALOG_DATA) public data: { mode: Mode, user: User, contact: Contact, shortMessage: ShortMessage }
  ) { }

  ngOnInit(): void {
    this.data.shortMessage.style = this.data.user.defaultStyle;
  }

  onApplyClick(): void {
    this.dialogRef.close(this.data);
  }

  onNewFontClick(): void {
    this.getRandomFont();
  }

  private getRandomFont(): void {
    this.data.shortMessage.style = this.style.getRandomStyle()
  }

  public showPolicy() {
    this.snackBar.open(`This information is stored on our server and is visible to everyone.`, 'OK', {});
  }

  public openTenorDialog(): void {
    const dialogRef = this.tenorDialog.open(TenorComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      width: '90vw',
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: '90vh',
      height: '90vh',
      maxHeight: '90vh',
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => { });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data) {
        this.data.shortMessage.multimedia.type = MultimediaType.TENOR
        this.data.shortMessage.multimedia.attribution = 'Powered by Tenor';
        this.data.shortMessage.multimedia.title = data.title;
        this.data.shortMessage.multimedia.description = data.content_description;
        this.data.shortMessage.multimedia.url = data.media_formats.gif.url;
        this.data.shortMessage.multimedia.sourceUrl = data.itemurl;
      }
    });
  }

  applyNewMultimedia(newMultimedia: Multimedia) {
    this.data.shortMessage.multimedia = newMultimedia;
    this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(this.data.shortMessage.multimedia?.oembed?.html ? this.data.shortMessage.multimedia?.oembed.html : '');
    this.showSaveHtml = this.data.shortMessage.multimedia.type != MultimediaType.TENOR;
  }

  public removeMultimedia(): void {
    this.data.shortMessage.multimedia.type = MultimediaType.UNDEFINED
    this.data.shortMessage.multimedia.attribution = '';
    this.data.shortMessage.multimedia.title = '';
    this.data.shortMessage.multimedia.description = '';
    this.data.shortMessage.multimedia.url = '';
    this.data.shortMessage.multimedia.sourceUrl = '';
  }

  public openTextDialog(): void {
    const dialogRef = this.textDialog.open(TextComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { text: this.data.shortMessage.message },
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => { });

    dialogRef.afterClosed().subscribe((data: any) => {
      this.data.shortMessage.message = data.text;
    });
  }

  public removeText(): void {
    this.data.shortMessage.message = '';
  }

}
