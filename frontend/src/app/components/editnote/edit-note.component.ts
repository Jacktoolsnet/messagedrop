import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Mode } from '../../interfaces/mode';
import { Multimedia } from '../../interfaces/multimedia';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { Note } from '../../interfaces/note';
import { User } from '../../interfaces/user';
import { StyleService } from '../../services/style.service';
import { SelectMultimediaComponent } from '../multimedia/select-multimedia/select-multimedia.component';
import { TextComponent } from '../utils/text/text.component';

@Component({
  selector: 'app-note',
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
  templateUrl: './edit-note.component.html',
  styleUrl: './edit-note.component.css'
})
export class EditNoteComponent implements OnInit {
  safeUrl: SafeResourceUrl | undefined;

  constructor(
    private sanitizer: DomSanitizer,
    private textDialog: MatDialog,
    private snackBar: MatSnackBar,
    public dialogRef: MatDialogRef<EditNoteComponent>,
    private style: StyleService,
    @Inject(MAT_DIALOG_DATA) public data: { mode: Mode, user: User, note: Note }
  ) { }

  ngOnInit(): void {
    this.data.note.style = this.data.user.defaultStyle
  }

  onApplyClick(): void {
    this.dialogRef.close(this.data);
  }

  onNewFontClick(): void {
    this.getRandomFont();
  }

  private getRandomFont(): void {
    this.data.note.style = this.style.getRandomStyle();
  }

  public showPolicy() {
    this.snackBar.open(`This information is stored on your device and is only visible to you.`, 'OK', {});
  }

  applyNewMultimedia(newMultimedia: Multimedia) {
    this.data.note.multimedia = newMultimedia;
    if (this.data.note.multimedia.type === MultimediaType.YOUTUBE) {
      this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://www.youtube.com/embed/${this.data.note.multimedia.contentId}`
      );
    }
  }

  public removeMultimedia(): void {
    this.data.note.multimedia.type = MultimediaType.UNDEFINED
    this.data.note.multimedia.attribution = '';
    this.data.note.multimedia.title = '';
    this.data.note.multimedia.description = '';
    this.data.note.multimedia.url = '';
    this.data.note.multimedia.sourceUrl = '';
  }

  public openTextDialog(): void {
    const dialogRef = this.textDialog.open(TextComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { text: this.data.note.note },
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => { });

    dialogRef.afterClosed().subscribe((data: any) => {
      this.data.note.note = data.text
    });
  }

  public removeText(): void {
    this.data.note.note = '';
  }

}
