import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { Message } from '../../../interfaces/message';
import { Place } from '../../../interfaces/place';
import { GeolocationService } from '../../../services/geolocation.service';
import { NoteService } from '../../../services/note.service';

@Component({
  selector: 'app-message-tile',
  imports: [
    CommonModule,
    MatIcon,
    MatButtonModule
  ],
  templateUrl: './messagetile.component.html',
  styleUrl: './messagetile.component.css'
})

export class MessageTileComponent implements OnInit, OnDestroy {
  @Input() place!: Place;
  readonly placeMessages = signal<Message[]>([]);
  readonly allPlaceMessagess = signal<Message[]>([]);

  constructor(
    private noteService: NoteService,
    private geolocationService: GeolocationService,
    private matDialog: MatDialog
  ) { }

  ngOnInit(): void {
    /*this.noteService.getNotesInBoundingBox(this.place.boundingBox!).then(notes => {
      this.allPlaceNotes.set(notes);
      const visibleNotes = notes
        .filter(n => n.note?.trim() !== '')  // Nur Notizen mit Inhalt
        .slice(0, 3);                        // Maximal 3 Notizen
      this.placeNotes.set(visibleNotes);
    });*/
  }

  ngOnDestroy(): void { }
}
