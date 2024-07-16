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
import { Mode } from '../../interfaces/mode';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { Note } from '../../interfaces/note';
import { NoteService } from '../../services/note.service';
import { DeletePlaceComponent } from './delete-place/delete-place.component';
import { NoteComponent } from '../note/note.component';
import { Place } from '../../interfaces/place';
import { PlaceService } from '../../services/place.service';
import { PlaceComponent } from '../place/place.component';

@Component({
  selector: 'app-placelist',
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
  templateUrl: './placelist.component.html',
  styleUrl: './placelist.component.css'
})
export class PlacelistComponent implements OnInit{
  public places!: Place[];
  private placeToDelete!: Place
  public user!: User;
  public animation!: Animation;
  public mode: typeof Mode = Mode;
  private snackBarRef: any;

  constructor(
    private placeService: PlaceService,
    public dialogRef: MatDialogRef<PlacelistComponent>,
    public placeDialog: MatDialog,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private style: StyleService,        
    @Inject(MAT_DIALOG_DATA) public data: {user: User, places: Place[]}
  ) {
    this.user = data.user;
    this.places = [...data.places];
  }

  ngOnInit(): void {
    this.animation = this.style.getRandomColorAnimation();
  }

  public deletePlace(place: Place) {
    this.placeToDelete = place;
    const dialogRef = this.dialog.open(DeletePlaceComponent, {
      closeOnNavigation: true,
      hasBackdrop: true 
    });

    dialogRef.afterOpened().subscribe(e => {      
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && undefined != this.placeToDelete) {
        this.placeService.deletePlace(this.placeToDelete)
              .subscribe({
                next: (simpleStatusResponse) => {
                  if (simpleStatusResponse.status === 200) {
                    this.places = this.places.filter( element => element.id !== this.placeToDelete.id );                    
                  }
                },
                error: (err) => {
                },
                complete:() => {}
              });
      }
    });
  }

  public editPlace(place: Place) {
    const dialogRef = this.placeDialog.open(PlaceComponent, {
      panelClass: '',
      data: {mode: this.mode.EDIT_PLACE, user: this.user, place: place},
      closeOnNavigation: true,
      width: '90vw',
      minWidth: '20vw',
      maxWidth:'90vw',
      minHeight: 'auto',
      height: 'auto',
      maxHeight: '90vh',
      hasBackdrop: true      
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.place) {
        this.placeService.updatePlace(data.place)
            .subscribe({
              next: simpleResponse => {
                if (simpleResponse.status === 200) {
                  this.snackBarRef = this.snackBar.open(`Place succesfully edited.`, '', {duration: 1000});
                }
              },
              error: (err) => {this.snackBarRef = this.snackBar.open(err.message, 'OK');},
              complete:() => {}
            });
      }
    });
  }

  public goBack() {
    this.dialogRef.close();
  }

  openPlaceDialog(): void {
    let place: Place = {
      id: 0,
      userId: this.user.id,
      name: ''
    };
    const dialogRef = this.placeDialog.open(PlaceComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {mode: this.mode.ADD_PLACE, place: place},
      width: '90vw',
      minWidth: '20vw',
      maxWidth:'90vw',
      minHeight: 'auto',
      height: 'auto',
      maxHeight: '90vh',
      hasBackdrop: true      
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.place) {
        this.placeService.createPlace(data.place)
            .subscribe({
              next: simpleResponse => {
                if (simpleResponse.status === 200) {
                  this.places = [data?.place, ...this.places];
                  this.snackBarRef = this.snackBar.open(`Place succesfully created.`, '', {duration: 1000});
                }
              },
              error: (err) => {this.snackBarRef = this.snackBar.open(err.message, 'OK');},
              complete:() => {}
            });   
      }
    });
  }

}
