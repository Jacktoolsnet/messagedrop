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
import { Location } from '../../interfaces/location';
import { Mode } from '../../interfaces/mode';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { Note } from '../../interfaces/note';
import { User } from '../../interfaces/user';
import { GeolocationService } from '../../services/geolocation.service';
import { MapService } from '../../services/map.service';
import { NoteService } from '../../services/note.service';
import { SharedContentService } from '../../services/shared-content.service';
import { StyleService } from '../../services/style.service';
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
  private location: Location;
  private noteToDelete!: Note
  public user: User | undefined;
  public mode: typeof Mode = Mode;
  private snackBarRef: any;

  constructor(
    public userService: UserService,
    private noteService: NoteService,
    private mapService: MapService,
    private geolocationService: GeolocationService,
    private sharedContentService: SharedContentService,
    public dialogRef: MatDialogRef<NotelistComponent>,
    public noteDialog: MatDialog,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private style: StyleService,
    @Inject(MAT_DIALOG_DATA) public data: { notes: Note[], location: Location }
  ) {
    this.notes = data.notes;
    this.location = data.location;
  }

  ngOnInit(): void {
    this.user = this.userService.getUser();
  }

  public flyTo(note: Note) {
    let location: Location = {
      latitude: note.location.latitude,
      longitude: note.location.longitude,
      plusCode: this.geolocationService.getPlusCode(note.location.latitude, note.location.longitude)
    }
    this.mapService.setCircleMarker(location);
    this.mapService.setDrawCircleMarker(true);
    this.mapService.flyTo(location);
    this.dialogRef.close();
  }

  public navigateToNoteLocation(note: Note) {
    this.noteService.navigateToNoteLocation(this.userService.getUser(), note)
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
        this.noteService.deleteNote(this.noteToDelete).then(() => {
          this.notes = this.notes.filter(note => note.id !== this.noteToDelete.id);
        });
      }
    });
  }

  public editNote(note: Note) {
    if (note.multimedia.type !== MultimediaType.UNDEFINED) {
      this.sharedContentService.addSharedContentToNote(note);
    }
    const dialogRef = this.noteDialog.open(EditNoteComponent, {
      panelClass: '',
      data: { mode: this.mode.EDIT_NOTE, note: note },
      closeOnNavigation: true,
      minWidth: '20vw',
      minHeight: '30vh',
      maxHeight: '90vh',
      maxWidth: '90vw',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.note) {
        this.noteService.updateNote(data.note)
      }
    });
  }

  public goBack() {
    this.dialogRef.close();
  }

  openNoteDialog(): void {
    let note: Note = {
      id: '',
      location: this.mapService.getMapLocation(),
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

    const dialogRef = this.noteDialog.open(EditNoteComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_NOTE, note: note },
      minWidth: '20vw',
      maxWidth: '90vw',
      minHeight: '30vh',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.note) {
        data.note.latitude = this.location.latitude;
        data.note.longitude = this.location.longitude;
        data.note.plusCode = this.location.plusCode;
        this.noteService.addNote(data.note).then(() => {
          this.notes.push(data.note);
        });
      }
    });
  }

}
