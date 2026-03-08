
import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, effect, inject, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import { Location } from '../../interfaces/location';
import { Mode } from '../../interfaces/mode';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { Note } from '../../interfaces/note';
import { User } from '../../interfaces/user';
import { AppService } from '../../services/app.service';
import { GeolocationService } from '../../services/geolocation.service';
import { MapService } from '../../services/map.service';
import { NoteService } from '../../services/note.service';
import { SharedContentService } from '../../services/shared-content.service';
import { SpeechService } from '../../services/speech.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { EditNoteComponent } from '../editnote/edit-note.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { ShowmessageComponent } from '../showmessage/showmessage.component';
import { DisplayMessage } from '../utils/display-message/display-message.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { DeleteNoteComponent } from './delete-note/delete-note.component';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-notelist',
  imports: [
    DialogHeaderComponent,
    ShowmessageComponent,
    ShowmultimediaComponent,
    MatBadgeModule,
    MatCardModule,
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogContent,
    MatDialogActions,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatMenuModule,
    MatInputModule,
    TranslocoPipe
  ],
  templateUrl: './notelist.component.html',
  styleUrl: './notelist.component.css',
  standalone: true
})
export class NotelistComponent implements OnDestroy {
  readonly mode = Mode;
  private readonly speechTargetPrefix = 'note-list:';
  private readonly dialogData = inject<{ location: Location; notesSignal: WritableSignal<Note[]> }>(MAT_DIALOG_DATA);
  public readonly userService = inject(UserService);
  private readonly appService = inject(AppService);
  private readonly noteService = inject(NoteService);
  private readonly mapService = inject(MapService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly sharedContentService = inject(SharedContentService);
  private readonly speechService = inject(SpeechService);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  public readonly dialogRef = inject(MatDialogRef<NotelistComponent>);
  public readonly dialog = inject(MatDialog);

  readonly hasNotes = computed(() => this.notesSignal().length > 0);
  readonly sortedNotes = computed(() => [...this.notesSignal()].sort((a, b) => b.timestamp - a.timestamp));
  public user: User | undefined = this.userService.getUser();
  public notesSignal: WritableSignal<Note[]> = this.dialogData.notesSignal;
  private location: Location = this.dialogData.location;

  constructor() {
    effect(() => {
      this.notesSignal();   // reactive read
      if (this.dialogData.notesSignal) {
        this.dialogData.notesSignal.set(this.notesSignal());
      }
    });
  }

  ngOnDestroy(): void {
    this.stopListReadAloud();
  }

  goBack(): void {
    this.stopListReadAloud();
    this.dialogRef.close();
  }

  flyTo(note: Note) {
    this.stopListReadAloud();
    const location = { ...note.location, plusCode: this.geolocationService.getPlusCode(note.location.latitude, note.location.longitude) };
    this.mapService.flyTo(location);
    this.dialogRef.close();
  }

  navigateToNoteLocation(note: Note) {
    this.stopReadAloudForNote(note);
    this.noteService.navigateToNoteLocation(this.userService.getUser(), note);
  }

  deleteNote(note: Note) {
    const dialogRef = this.dialog.open(DeleteNoteComponent, {
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false
    });
    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        this.stopReadAloudForNote(note);
        await this.noteService.deleteNote(note);
        const updatedNotes = this.notesSignal().filter(n => n.id !== note.id);
        this.notesSignal.set(updatedNotes);
      }
    });
  }

  async editNote(note: Note): Promise<void> {
    this.stopReadAloudForNote(note);

    if (note.multimedia.type !== MultimediaType.UNDEFINED) {
      await this.sharedContentService.addSharedContentToNote(note);
    }

    const dialogRef = this.dialog.open(EditNoteComponent, {
      data: { mode: this.mode.EDIT_NOTE, note },
      closeOnNavigation: true,
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe(async () => {
      await this.noteService.updateNote(note);
    });
  }

  async openNoteDialog(): Promise<void> {
    this.stopListReadAloud();

    const note: Note = {
      id: '',
      location: this.location,
      note: '',
      hashtags: [],
      markerType: 'note',
      style: '',
      timestamp: 0,
      multimedia: {
        type: MultimediaType.UNDEFINED,
        url: '',
        sourceUrl: '',
        attribution: '',
        title: '',
        description: '',
        contentId: ''
      }
    };

    await this.sharedContentService.addSharedContentToNote(note);
    const dialogRef = this.dialog.open(EditNoteComponent, {
      data: { mode: this.mode.ADD_NOTE, note },
      closeOnNavigation: true,
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result?.note) {
        const createdNote = await this.noteService.addNote(result.note);
        const currentNotes = this.notesSignal();
        if (!currentNotes.some(noteItem => noteItem.id === createdNote.id)) {
          this.notesSignal.set([createdNote, ...currentNotes]);
        }
      }
    });
  }

  toggleReadAloud(note: Note): void {
    if (!this.speechService.supported()) {
      this.showReadAloudHint('common.speech.unsupported');
      return;
    }

    if (!this.appService.getAppSettings().speech?.enabled) {
      this.showReadAloudHint('common.speech.disabled');
      return;
    }

    const text = this.getSpeechText(note);
    if (!text) {
      return;
    }

    this.speechService.toggle({
      targetId: this.getSpeechTargetId(note),
      text
    });
  }

  isReadAloudActive(note: Note): boolean {
    return this.speechService.isActive(this.getSpeechTargetId(note));
  }

  getReadAloudIcon(note: Note): string {
    return this.isReadAloudActive(note) ? 'stop' : 'volume_up';
  }

  getReadAloudLabel(note: Note): string {
    return this.translation.t(
      this.isReadAloudActive(note)
        ? 'common.actions.stopReadAloud'
        : 'common.actions.readAloud'
    );
  }

  private getSpeechTargetId(note: Note): string {
    return `${this.speechTargetPrefix}${note.id || note.timestamp}`;
  }

  private getSpeechText(note: Note): string {
    return (note.note ?? '').trim();
  }

  private stopReadAloudForNote(note: Note): void {
    this.speechService.stopIfCurrentTarget(this.getSpeechTargetId(note));
  }

  private stopListReadAloud(): void {
    const currentTargetId = this.speechService.currentTargetId();
    if (currentTargetId?.startsWith(this.speechTargetPrefix)) {
      this.speechService.stop();
    }
  }

  private showReadAloudHint(messageKey: string): void {
    this.dialog.open(DisplayMessage, {
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.translation.t('common.actions.readAloud'),
        image: '',
        icon: 'record_voice_over',
        message: this.translation.t(messageKey),
        button: this.translation.t('common.actions.ok'),
        delay: 0,
        showSpinner: false,
        autoclose: false
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }
}
