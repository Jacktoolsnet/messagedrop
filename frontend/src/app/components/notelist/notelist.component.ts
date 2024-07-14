import { CUSTOM_ELEMENTS_SCHEMA, Component, Inject, OnInit } from '@angular/core';
import { MatDialogRef, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose, MatDialogContainer, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';

import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule}  from '@angular/material/card';
import { StyleService } from '../../services/style.service';
import { Animation } from '../../interfaces/animation';
import { User } from '../../interfaces/user';
import { MapService } from '../../services/map.service';
import { Location } from '../../interfaces/location';
import { GeolocationService } from '../../services/geolocation.service';
import { MatBadgeModule } from '@angular/material/badge';
import { ShortNumberPipe } from '../../pipes/short-number.pipe';
import { MessageMode } from '../../interfaces/message-mode';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { Note } from '../../interfaces/note';
import { NoteService } from '../../services/note.service';
import { DeleteNoteComponent } from './delete-note/delete-note.component';
import { NoteComponent } from '../note/note.component';

@Component({
  selector: 'app-notelist',
  standalone: true,
  imports: [
    ShortNumberPipe,
    MatBadgeModule,
    MatCardModule,
    MatDialogContainer,
    CommonModule, 
    FormsModule, 
    MatButtonModule, 
    MatDialogActions, 
    MatDialogClose, 
    MatDialogTitle, 
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
export class NotelistComponent implements OnInit{
  public notes!: Note[];
  private noteToDelete!: Note
  public user!: User;
  public animation!: Animation;
  public messageMode: typeof MessageMode = MessageMode;
  private snackBarRef: any;

  constructor(
    private noteService: NoteService,
    private mapService: MapService,
    private geolocationService: GeolocationService,
    public dialogRef: MatDialogRef<NotelistComponent>,
    public noteDialog: MatDialog,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private style:StyleService,    
    @Inject(MAT_DIALOG_DATA) public data: {user: User, notes: Note[]}
  ) {
    this.user = data.user;
    this.notes = [...data.notes];
  }

  ngOnInit(): void {
    this.animation = this.style.getRandomColorAnimation();
  }

  public flyTo(note: Note){
    let location: Location = {
      latitude: note.latitude,
      longitude: note.longitude,
      zoom: 17,
      plusCode: this.geolocationService.getPlusCode(note.latitude, note.longitude)
    }
    this.mapService.setCircleMarker(location);
    this.mapService.setDrawCircleMarker(true);
    this.mapService.flyTo(location);
    this.dialogRef.close();
  }

  public navigateToNoteLocation(note: Note){
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
        let index: number = this.notes.indexOf(this.noteToDelete, 0);
        if (index > -1) {
          this.notes.splice(index, 1);
        }
        this.noteService.saveNotesToStorage(this.notes);
      }
    });
  }

  public editNote(note: Note) {
    const dialogRef = this.noteDialog.open(NoteComponent, {
      panelClass: '',
      data: {mode: this.messageMode.EDIT_NOTE, user: this.user, note: note},
      closeOnNavigation: true,
      width: '90vh',
      height: '90vh',
      maxHeight: '90vh',
      maxWidth:'90vw',
      hasBackdrop: true      
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.note) {
        this.noteService.saveNotesToStorage(this.notes);
      }
    });
  }

}
