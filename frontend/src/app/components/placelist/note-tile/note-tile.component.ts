import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { Note } from '../../../interfaces/note';
import { Place } from '../../../interfaces/place';
import { GeolocationService } from '../../../services/geolocation.service';
import { NoteService } from '../../../services/note.service';
import { NotelistComponent } from '../../notelist/notelist.component';

@Component({
  selector: 'app-note-tile',
  imports: [
    CommonModule,
    MatIcon,
    MatButtonModule
  ],
  templateUrl: './note-tile.component.html',
  styleUrl: './note-tile.component.css'
})
export class NoteTileComponent implements OnInit, OnDestroy {
  @Input() place!: Place;
  readonly placeNotes = signal<Note[]>([]);
  readonly allPlaceNotes = signal<Note[]>([]);

  constructor(
    private noteService: NoteService,
    private geolocationService: GeolocationService,
    private matDialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.noteService.getNotesInBoundingBox(this.place.boundingBox!).then(notes => {
      this.allPlaceNotes.set(notes);
      const visibleNotes = notes
        .filter(n => n.note?.trim() !== '')  // Nur Notizen mit Inhalt
        .slice(0, 3);                        // Maximal 3 Notizen
      this.placeNotes.set(visibleNotes);
    });
  }

  ngOnDestroy(): void { }

  openNoteDialog(): void {
    const dialogRef = this.matDialog.open(NotelistComponent, {
      panelClass: 'NoteListDialog',
      closeOnNavigation: true,
      data: { location: this.geolocationService.getCenterOfBoundingBox(this.place.boundingBox!), notesSignal: this.allPlaceNotes },
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: '8rem',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe(() => {
      const visibleNotes = this.allPlaceNotes()
        .filter(n => n.note?.trim() !== '')
        .slice(0, 3);

      this.placeNotes.set(visibleNotes);
    });
  }
}