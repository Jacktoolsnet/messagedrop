
import { Component, computed, effect, inject, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import { MasonryItemDirective } from '../../directives/masonry-item.directive';
import { Location } from '../../interfaces/location';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { Note } from '../../interfaces/note';
import { User } from '../../interfaces/user';
import { GeolocationService } from '../../services/geolocation.service';
import { MapService } from '../../services/map.service';
import { NoteService } from '../../services/note.service';
import { SharedContentService } from '../../services/shared-content.service';
import { UserService } from '../../services/user.service';
import { EditNoteComponent } from '../editnote/edit-note.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { ShowmessageComponent } from '../showmessage/showmessage.component';
import { DeleteNoteComponent } from './delete-note/delete-note.component';

@Component({
  selector: 'app-notelist',
  imports: [
    ShowmessageComponent,
    ShowmultimediaComponent,
    MatBadgeModule,
    MatCardModule,
    FormsModule,
    MatButtonModule,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatMenuModule,
    MatInputModule,
    MasonryItemDirective,
    TranslocoPipe
  ],
  templateUrl: './notelist.component.html',
  styleUrl: './notelist.component.css',
  standalone: true
})
export class NotelistComponent {
  private readonly dialogData = inject<{ location: Location; notesSignal: WritableSignal<Note[]> }>(MAT_DIALOG_DATA);
  public readonly userService = inject(UserService);
  private readonly noteService = inject(NoteService);
  private readonly mapService = inject(MapService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly sharedContentService = inject(SharedContentService);
  public readonly dialogRef = inject(MatDialogRef<NotelistComponent>);
  public readonly dialog = inject(MatDialog);

  readonly hasNotes = computed(() => this.notesSignal().length > 0);
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

  goBack(): void {
    this.dialogRef.close();
  }

  flyTo(note: Note) {
    const location = { ...note.location, plusCode: this.geolocationService.getPlusCode(note.location.latitude, note.location.longitude) };
    this.mapService.flyTo(location);
    this.dialogRef.close();
  }

  navigateToNoteLocation(note: Note) {
    this.noteService.navigateToNoteLocation(this.userService.getUser(), note);
  }

  deleteNote(note: Note) {
    const dialogRef = this.dialog.open(DeleteNoteComponent);
    dialogRef.afterClosed().subscribe(async result => {
      if (result) {
        await this.noteService.deleteNote(note);
        const updatedNotes = this.notesSignal().filter(n => n.id !== note.id);
        this.notesSignal.set(updatedNotes);
      }
    });
  }

  editNote(note: Note) {
    if (note.multimedia.type !== MultimediaType.UNDEFINED) {
      this.sharedContentService.addSharedContentToNote(note);
    }

    const dialogRef = this.dialog.open(EditNoteComponent, {
      data: { note },
      closeOnNavigation: true,
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe(async () => {
      await this.noteService.updateNote(note);
    });
  }

  openNoteDialog(): void {
    const note: Note = {
      id: '',
      location: this.location,
      note: '',
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

    this.sharedContentService.addSharedContentToNote(note);
    const dialogRef = this.dialog.open(EditNoteComponent, {
      data: { note },
      closeOnNavigation: true,
      minWidth: '20vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe(async result => {
      if (result?.note) {
        result.note.latitude = this.location.latitude;
        result.note.longitude = this.location.longitude;
        result.note.plusCode = this.location.plusCode;
        await this.noteService.addNote(result.note);
        const updatedNotes = [result.note, ...this.notesSignal()];
        this.notesSignal.set(updatedNotes);
      }
    });
  }
}
