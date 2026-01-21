
import { Component, computed, inject, Input, OnInit, signal, WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Note } from '../../../interfaces/note';
import { Place } from '../../../interfaces/place';
import { GeolocationService } from '../../../services/geolocation.service';
import { NoteService } from '../../../services/note.service';
import { NotelistComponent } from '../../notelist/notelist.component';

@Component({
  selector: 'app-note-tile',
  imports: [
    MatIcon,
    MatButtonModule,
    TranslocoPipe
  ],
  templateUrl: './note-tile.component.html',
  styleUrl: './note-tile.component.css'
})
export class NoteTileComponent implements OnInit {
  @Input() place!: Place;
  readonly allPlaceNotes: WritableSignal<Note[]> = signal<Note[]>([]);

  readonly placeNotes = computed(() =>
    this.allPlaceNotes()
      .filter(n => n.note?.trim() !== '')
      .slice(0, 3)
  );

  private readonly noteService = inject(NoteService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly matDialog = inject(MatDialog);

  ngOnInit(): void {
    this.noteService.getNotesInBoundingBox(this.place.boundingBox!).then(notes => {
      this.allPlaceNotes.set(notes);
    });
  }

  openNoteDialog(): void {
    this.matDialog.open(NotelistComponent, {
      panelClass: 'NoteListDialog',
      closeOnNavigation: true,
      data: { location: this.geolocationService.getCenterOfBoundingBox(this.place.boundingBox!), notesSignal: this.allPlaceNotes },
      minWidth: '20vw',
      maxWidth: '95vw',
      width: 'auto',
      maxHeight: 'none',
      height: 'auto',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }
}
