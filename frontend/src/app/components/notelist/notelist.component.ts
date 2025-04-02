import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogContent, MatDialogRef } from '@angular/material/dialog';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Animation } from '../../interfaces/animation';
import { Location } from '../../interfaces/location';
import { Mode } from '../../interfaces/mode';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { Note } from '../../interfaces/note';
import { User } from '../../interfaces/user';
import { GeolocationService } from '../../services/geolocation.service';
import { MapService } from '../../services/map.service';
import { NoteService } from '../../services/note.service';
import { StyleService } from '../../services/style.service';
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
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatMenuModule,
    MatInputModule
  ],
  templateUrl: './notelist.component.html',
  styleUrl: './notelist.component.css'
})
export class NotelistComponent implements OnInit {
  public notes: Note[];
  private noteToDelete!: Note
  public user: User;
  public animation!: Animation;
  public mode: typeof Mode = Mode;
  private snackBarRef: any;

  constructor(
    private noteService: NoteService,
    private mapService: MapService,
    private geolocationService: GeolocationService,
    public dialogRef: MatDialogRef<NotelistComponent>,
    public noteDialog: MatDialog,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private style: StyleService,
    @Inject(MAT_DIALOG_DATA) public data: { user: User, notes: Note[] }
  ) {
    this.user = data.user;
    this.notes = data.notes;
  }

  ngOnInit(): void {
    this.animation = this.style.getRandomColorAnimation();
  }

  public flyTo(note: Note) {
    let location: Location = {
      latitude: note.latitude,
      longitude: note.longitude,
      plusCode: this.geolocationService.getPlusCode(note.latitude, note.longitude)
    }
    this.mapService.setCircleMarker(location);
    this.mapService.setDrawCircleMarker(true);
    this.mapService.flyTo(location);
    this.dialogRef.close();
  }

  public navigateToNoteLocation(note: Note) {
    this.noteService.navigateToNoteLocation(this.user, note)
  }

  public deleteNote(note: Note) {
    this.noteToDelete = note;
    const dialogRef = this.dialog.open(DeleteNoteComponent, {
      closeOnNavigation: true,
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && undefined != this.noteToDelete) {
        this.notes.splice(this.notes.findIndex(note => note === this.noteToDelete), 1)
        this.noteService.saveNotes();
        if (this.notes.length == 0) {
          this.dialogRef.close();
        }
      }
    });
  }

  public editNote(note: Note) {
    const dialogRef = this.noteDialog.open(EditNoteComponent, {
      panelClass: '',
      data: { mode: this.mode.EDIT_NOTE, user: this.user, note: note },
      closeOnNavigation: true,
      width: '90vh',
      height: '90vh',
      maxHeight: '90vh',
      maxWidth: '90vw',
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.note) {
        this.noteService.saveNotes();
      }
    });
  }

  public goBack() {
    this.dialogRef.close();
  }

  openNoteDialog(): void {
    let note: Note = {
      latitude: 0,
      longitude: 0,
      plusCode: '',
      note: '',
      markerType: 'note',
      style: '',
      multimedia: {
        type: MultimediaType.UNDEFINED,
        url: '',
        sourceUrl: '',
        attribution: '',
        title: '',
        description: '',
        videoId: ''
      }
    };
    const dialogRef = this.noteDialog.open(EditNoteComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_NOTE, note: note },
      width: '90vw',
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: '90vh',
      height: '90vh',
      maxHeight: '90vh',
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.note) {
        data.note.latitude = this.mapService.getMapLocation().latitude;
        data.note.longitude = this.mapService.getMapLocation().longitude;
        data.note.plusCode = this.mapService.getMapLocation().plusCode;
        this.noteService.addNote(data.note);
        this.noteService.saveNotes();
      }
    });
  }

}
