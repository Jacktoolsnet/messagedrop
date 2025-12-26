import { Component, OnInit, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';


import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import { Mode } from '../../interfaces/mode';
import { Multimedia } from '../../interfaces/multimedia';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { Note } from '../../interfaces/note';
import { SharedContentService } from '../../services/shared-content.service';
import { StyleService } from '../../services/style.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { SelectMultimediaComponent } from '../multimedia/select-multimedia/select-multimedia.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { TextComponent } from '../utils/text/text.component';

interface TextDialogResult {
  text: string;
}

@Component({
  selector: 'app-note',
  imports: [
    SelectMultimediaComponent,
    ShowmultimediaComponent,
    FormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    TranslocoPipe
],
  templateUrl: './edit-note.component.html',
  styleUrl: './edit-note.component.css'
})
export class EditNoteComponent implements OnInit {
  private readonly userService = inject(UserService);
  private readonly sharedContentService = inject(SharedContentService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly matDialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  readonly dialogRef = inject(MatDialogRef<EditNoteComponent>);
  private readonly style = inject(StyleService);
  readonly data = inject<{ mode: Mode; note: Note }>(MAT_DIALOG_DATA);

  safeHtml: SafeHtml | undefined = undefined;
  showSaveHtml = false;

  private readonly oriNote: string | undefined = this.data.note.note;
  private readonly oriMultimedia: Multimedia | undefined = structuredClone(this.data.note.multimedia);
  private readonly oriStyle: string | undefined = this.data.note.style;

  ngOnInit(): void {
    if (!this.data.note.style) {
      this.data.note.style = this.userService.getProfile().defaultStyle ?? '';
    }
    this.applyNewMultimedia(this.data.note.multimedia);
  }

  onApplyClick(): void {
    this.dialogRef.close(this.data);
  }

  onAbortClick(): void {
    if (undefined != this.oriNote) {
      this.data.note.note = this.oriNote;
    }
    if (undefined != this.oriMultimedia) {
      this.data.note.multimedia = this.oriMultimedia;
    }
    if (undefined != this.oriStyle) {
      this.data.note.style = this.oriStyle;
    }
    this.dialogRef.close();
  }

  onNewFontClick(): void {
    this.getRandomFont();
  }

  private getRandomFont(): void {
    this.data.note.style = this.style.getRandomStyle();
  }

  public showPolicy() {
    this.snackBar.open(this.translation.t('common.note.policy'), this.translation.t('common.actions.ok'), {});
  }

  applyNewMultimedia(newMultimedia: Multimedia) {
    this.data.note.multimedia = newMultimedia;
    const html = newMultimedia?.oembed?.html ?? '';
    this.safeHtml = this.sanitizer.bypassSecurityTrustHtml(html);
    this.showSaveHtml = newMultimedia.type !== MultimediaType.TENOR;
  }

  public removeMultimedia(): void {
    const multimedia = this.data.note.multimedia;
    multimedia.type = MultimediaType.UNDEFINED;
    multimedia.attribution = '';
    multimedia.title = '';
    multimedia.description = '';
    multimedia.url = '';
    multimedia.sourceUrl = '';
    this.safeHtml = undefined;
    this.showSaveHtml = false;
    this.sharedContentService.deleteSharedContent('last');
    this.sharedContentService.deleteSharedContent('lastMultimedia');
    this.sharedContentService.deleteSharedContent('lastLocation');
  }

  public openTextDialog(): void {
    const dialogRef = this.matDialog.open(TextComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { text: this.data.note.note },
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result?: TextDialogResult) => {
      if (result?.text != null) {
        this.data.note.note = result.text;
      }
    });
  }

  public removeText(): void {
    this.data.note.note = '';
  }

}
