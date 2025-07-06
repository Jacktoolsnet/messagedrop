import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
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

  private notes: Note[] = [];
  public visibleNotes: Note[] = [];

  constructor(
    private noteService: NoteService,
    private geolocationService: GeolocationService,
    private matDialog: MatDialog
  ) { }

  ngOnInit(): void {
    if (this.place) {
      this.noteService.getNotesInBoundingBox(this.place.boundingBox!).then((notes: Note[]) => {
        this.notes = notes;
        this.visibleNotes = notes.filter(n => n.note?.trim().length > 0);
      });
    }
  }

  ngOnDestroy(): void {
  }

  openNoteDialog(): void {
    const dialogRef = this.matDialog.open(NotelistComponent, {
      panelClass: 'NoteListDialog',
      closeOnNavigation: true,
      data: { location: this.geolocationService.getCenterOfBoundingBox(this.place.boundingBox!) },
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: '8rem',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (this.place) {
        this.noteService.getNotesInBoundingBox(this.place.boundingBox!).then((notes: Note[]) => {
          this.notes = notes;
          this.visibleNotes = notes.filter(n => n.note?.trim().length > 0);
        });
      }
    });
  }
}
