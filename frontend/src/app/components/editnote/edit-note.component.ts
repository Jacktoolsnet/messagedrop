import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';


import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { Location } from '../../interfaces/location';
import { Mode } from '../../interfaces/mode';
import { Multimedia } from '../../interfaces/multimedia';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { Note } from '../../interfaces/note';
import { DisplayMessageConfig } from '../../interfaces/display-message-config';
import { OembedService } from '../../services/oembed.service';
import { SharedContentService } from '../../services/shared-content.service';
import { StyleService } from '../../services/style.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { HashtagSuggestionService } from '../../services/hashtag-suggestion.service';
import { MAX_LOCAL_HASHTAGS, normalizeHashtags } from '../../utils/hashtag.util';
import { SelectMultimediaComponent } from '../multimedia/select-multimedia/select-multimedia.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { DisplayMessage } from '../utils/display-message/display-message.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { LocationPickerTileComponent } from '../utils/location-picker/location-picker-tile.component';
import { TextComponent } from '../utils/text/text.component';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';

interface TextDialogResult {
  text: string;
}

interface DialogHeaderConfig {
  icon: string;
  labelKey: string;
}

@Component({
  selector: 'app-note',
  imports: [
    DialogHeaderComponent,
    SelectMultimediaComponent,
    ShowmultimediaComponent,
    LocationPickerTileComponent,
    FormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatChipsModule,
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
  private readonly oembedService = inject(OembedService);
  private readonly matDialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  private readonly hashtagSuggestionService = inject(HashtagSuggestionService);
  readonly help = inject(HelpDialogService);
  readonly dialogRef = inject(MatDialogRef<EditNoteComponent>);
  private readonly style = inject(StyleService);
  readonly data = inject<{ mode?: Mode; note: Note }>(MAT_DIALOG_DATA);
  readonly headerConfig = this.resolveHeaderConfig(this.data.mode, this.data.note);
  readonly mode = Mode;
  readonly maxLocalHashtags = MAX_LOCAL_HASHTAGS;
  readonly isLocationEditable = !this.data.mode
    || this.data.mode === Mode.ADD_NOTE
    || this.data.mode === Mode.EDIT_NOTE;
  @ViewChild(MatAutocompleteTrigger) hashtagAutocompleteTrigger?: MatAutocompleteTrigger;
  @ViewChild('hashtagInputElement') hashtagInputElement?: ElementRef<HTMLInputElement>;

  safeHtml: string | undefined = undefined;
  showSaveHtml = false;
  hashtagInput = '';
  hashtagTags: string[] = [];

  private readonly oriNote: string | undefined = this.data.note.note;
  private readonly oriMultimedia: Multimedia | undefined = structuredClone(this.data.note.multimedia);
  private readonly oriStyle: string | undefined = this.data.note.style;
  private readonly oriHashtags: string[] = [...(this.data.note.hashtags ?? [])];

  ngOnInit(): void {
    if (!this.data.note.style) {
      this.data.note.style = this.userService.getProfile().defaultStyle ?? '';
    }
    this.data.note.hashtags = [...this.oriHashtags];
    this.hashtagTags = [...this.oriHashtags];
    this.clearHashtagInput();
    this.applyNewMultimedia(this.data.note.multimedia);
  }

  private resolveHeaderConfig(mode: Mode | undefined, note: Note): DialogHeaderConfig {
    switch (mode) {
      case Mode.EDIT_NOTE:
        return { icon: 'edit_note', labelKey: 'common.noteList.editTitle' };
      case Mode.ADD_NOTE:
        return { icon: 'add_notes', labelKey: 'common.noteList.addNoteAria' };
      default:
        return note?.id
          ? { icon: 'edit_note', labelKey: 'common.noteList.editTitle' }
          : { icon: 'add_notes', labelKey: 'common.noteList.addNoteAria' };
    }
  }

  onApplyClick(): void {
    if (!this.addHashtagsFromInput(true)) {
      return;
    }
    const parsed = normalizeHashtags(this.hashtagTags, MAX_LOCAL_HASHTAGS);
    if (parsed.invalidTokens.length > 0 || parsed.overflow > 0) {
      this.showHashtagValidationError();
      return;
    }
    this.data.note.hashtags = parsed.tags;
    this.hashtagTags = [...parsed.tags];
    this.hashtagSuggestionService.remember(this.hashtagTags);
    this.clearHashtagInput();
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
    this.data.note.hashtags = [...this.oriHashtags];
    this.hashtagTags = [...this.oriHashtags];
    this.clearHashtagInput();
    this.dialogRef.close();
  }

  onHashtagEnter(event: Event): void {
    if (this.hashtagAutocompleteTrigger?.panelOpen) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    this.addHashtagsFromInput(true);
  }

  onAddHashtagClick(): void {
    this.addHashtagsFromInput(true);
  }

  onHashtagSuggestionSelected(tag: string): void {
    const added = this.addHashtagsFromInput(true, tag);
    if (added) {
      this.clearHashtagInput();
      setTimeout(() => this.clearHashtagInput());
    }
  }

  addHashtagsFromInput(showErrors = true, candidateOverride?: string): boolean {
    const candidate = (candidateOverride ?? this.hashtagInput).trim();
    if (!candidate) {
      return true;
    }

    const parsed = normalizeHashtags(candidate, MAX_LOCAL_HASHTAGS);
    if (parsed.invalidTokens.length > 0) {
      if (showErrors) {
        this.showHashtagValidationError();
      }
      return false;
    }

    const merged = normalizeHashtags([...this.hashtagTags, ...parsed.tags], MAX_LOCAL_HASHTAGS);
    if (merged.overflow > 0) {
      if (showErrors) {
        this.showHashtagValidationError();
      }
      return false;
    }

    this.hashtagTags = [...merged.tags];
    this.clearHashtagInput();
    return true;
  }

  removeHashtag(tag: string): void {
    this.hashtagTags = this.hashtagTags.filter((item) => item !== tag);
  }

  getHashtagSuggestions(): string[] {
    return this.hashtagSuggestionService.suggest(this.hashtagInput, {
      exclude: this.hashtagTags,
      limit: 12
    });
  }

  private clearHashtagInput(): void {
    this.hashtagInput = '';
    if (this.hashtagInputElement?.nativeElement) {
      this.hashtagInputElement.nativeElement.value = '';
    }
  }

  private showHashtagValidationError(): void {
    const config: DisplayMessageConfig = {
      showAlways: true,
      title: this.translation.t('common.hashtags.label'),
      image: '',
      icon: 'warning',
      message: this.translation.t('common.hashtags.invalidLocal', { max: MAX_LOCAL_HASHTAGS }),
      button: '',
      delay: 2000,
      showSpinner: false,
      autoclose: true
    };

    this.matDialog.open(DisplayMessage, {
      panelClass: '',
      closeOnNavigation: false,
      data: config,
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
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
      ? html
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
