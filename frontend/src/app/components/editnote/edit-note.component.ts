import { Component, OnInit, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';


import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import { Location } from '../../interfaces/location';
import { Mode } from '../../interfaces/mode';
import { Multimedia } from '../../interfaces/multimedia';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { Note } from '../../interfaces/note';
import { OembedService } from '../../services/oembed.service';
import { SharedContentService } from '../../services/shared-content.service';
import { StyleService } from '../../services/style.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { SelectMultimediaComponent } from '../multimedia/select-multimedia/select-multimedia.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { LocationPickerTileComponent } from '../utils/location-picker/location-picker-tile.component';
import { TextComponent } from '../utils/text/text.component';

interface TextDialogResult {
  text: string;
}

type DialogHeaderConfig = {
  icon: string;
  labelKey: string;
};

@Component({
  selector: 'app-note',
  imports: [
    SelectMultimediaComponent,
    ShowmultimediaComponent,
    LocationPickerTileComponent,
    FormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatDialogTitle,
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
  private readonly oembedService = inject(OembedService);
  private readonly matDialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  readonly dialogRef = inject(MatDialogRef<EditNoteComponent>);
  private readonly style = inject(StyleService);
  readonly data = inject<{ mode: Mode; note: Note }>(MAT_DIALOG_DATA);
  readonly headerConfig = this.resolveHeaderConfig(this.data.mode);
  readonly mode = Mode;
  readonly isLocationEditable = !this.data.mode
    || this.data.mode === Mode.ADD_NOTE
    || this.data.mode === Mode.EDIT_NOTE;

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

  private resolveHeaderConfig(mode: Mode): DialogHeaderConfig {
    switch (mode) {
      case Mode.EDIT_NOTE:
        return { icon: 'edit_note', labelKey: 'common.noteList.editTitle' };
      case Mode.ADD_NOTE:
      default:
        return { icon: 'add_notes', labelKey: 'common.noteList.addNoteAria' };
    }
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
    this.safeHtml = this.oembedService.isAllowedOembedSource(newMultimedia?.sourceUrl, newMultimedia?.oembed?.provider_url)
      ? this.sanitizer.bypassSecurityTrustHtml(html)
      : undefined;
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
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: true
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

  public updateLocation(location: Location): void {
    this.data.note.location = { ...location };
  }

}
