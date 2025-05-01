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
import { Place } from '../../interfaces/place';
import { CryptoService } from '../../services/crypto.service';
import { GeolocationService } from '../../services/geolocation.service';
import { MapService } from '../../services/map.service';
import { PlaceService } from '../../services/place.service';
import { StyleService } from '../../services/style.service';
import { UserService } from '../../services/user.service';
import { PlaceComponent } from '../place/place.component';
import { DeletePlaceComponent } from './delete-place/delete-place.component';

@Component({
  selector: 'app-placelist',
  imports: [
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
  templateUrl: './placelist.component.html',
  styleUrl: './placelist.component.css'
})
export class PlacelistComponent implements OnInit {
  public places!: Place[];
  private placeToDelete!: Place
  public mode: typeof Mode = Mode;
  private snackBarRef: any;
  public subscriptionError: boolean = false;

  constructor(
    private mapService: MapService,
    private geolocationService: GeolocationService,
    private placeService: PlaceService,
    public userService: UserService,
    private cryptoService: CryptoService,
    public dialogRef: MatDialogRef<PlacelistComponent>,
    public placeDialog: MatDialog,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private style: StyleService,
    @Inject(MAT_DIALOG_DATA) public data: { places: Place[] }
  ) {
    this.places = data.places;
  }

  ngOnInit(): void {
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
                this.places.splice(this.places.map(e => e.id).indexOf(this.placeToDelete.id), 1);
                this.placeService.saveAdditionalPlaceInfos();
              }
            },
            error: (err) => {
            },
            complete: () => { }
          });
      }
    });
  }

  public editPlace(place: Place) {
    const dialogRef = this.placeDialog.open(PlaceComponent, {
      panelClass: '',
      data: { mode: this.mode.EDIT_PLACE, user: this.userService.getUser(), place: place },
      closeOnNavigation: true,
      width: '90vw',
      minWidth: '20vw',
      maxWidth: '90vw',
      height: 'auto',
      maxHeight: '90vh',
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.place) {
        this.cryptoService.createHash(data.place.name)
          .then((hashedName: string) => {
            let updatePlace: Place = {
              id: data.place.id,
              userId: data.place.userId,
              name: hashedName,
              base64Avatar: data.place.base64Avatar,
              subscribed: data.place.subscribe,
              plusCodes: [...data.place.plusCodes]
            };
            this.placeService.updatePlace(updatePlace)
              .subscribe({
                next: simpleResponse => {
                  if (simpleResponse.status === 200) {
                    this.placeService.saveAdditionalPlaceInfos();
                    this.snackBarRef = this.snackBar.open(`Place succesfully edited.`, '', { duration: 1000 });
                  }
                },
                error: (err) => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); },
                complete: () => { }
              });
          });
      }
    });
  }

  public subscribe(place: Place) {
    if (Notification.permission !== "granted") {
      this.userService.registerSubscription(this.userService.getUser());
    }
    if (!place.subscribed && Notification.permission === "granted") {
      // subscribe to place
      this.placeService.subscribe(place)
        .subscribe({
          next: (simpleStatusResponse) => {
            if (simpleStatusResponse.status === 200) {
              place.subscribed = true;
            }
          },
          error: (err) => { },
          complete: () => { }
        });
    } else {
      // Unsubscribe from place.
      this.placeService.unsubscribe(place)
        .subscribe({
          next: (simpleStatusResponse) => {
            if (simpleStatusResponse.status === 200) {
              place.subscribed = false;
            }
          },
          error: (err) => {
          },
          complete: () => { }
        });
    }
  }

  public editLocation(place: Place) {
    this.dialogRef.close(place);
  }

  public goBack() {
    this.dialogRef.close();
  }

  openPlaceDialog(): void {
    let place: Place = {
      id: '',
      userId: this.userService.getUser().id,
      name: '',
      base64Avatar: '',
      subscribed: false,
      plusCodes: []
    };
    const dialogRef = this.placeDialog.open(PlaceComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { mode: this.mode.ADD_PLACE, place: place },
      width: '90vw',
      minWidth: '20vw',
      maxWidth: '90vw',
      height: 'auto',
      maxHeight: '90vh',
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe((data: any) => {
      if (undefined !== data?.place) {
        this.cryptoService.createHash(data.place.name)
          .then((hasedName: string) => {
            let updatePlace: Place = {
              id: data.place.id,
              userId: data.place.userId,
              name: hasedName,
              base64Avatar: data.place.base64Avatar,
              subscribed: data.place.subscribe,
              plusCodes: [...data.place.plusCodes]
            };
            this.placeService.createPlace(updatePlace)
              .subscribe({
                next: createPlaceResponse => {
                  if (createPlaceResponse.status === 200) {
                    data.place.id = createPlaceResponse.placeId;
                    this.places.unshift(data.place);
                    this.placeService.saveAdditionalPlaceInfos();
                    this.snackBarRef = this.snackBar.open(`Place succesfully created.`, '', { duration: 1000 });
                  }
                },
                error: (err) => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); },
                complete: () => { }
              });
          });
      }
    });
  }

  public flyTo(place: Place) {
    let location: Location = this.geolocationService.getLocationFromPlusCode(place.plusCodes[0]);
    this.mapService.flyToWithZoom(location, 18);
    this.dialogRef.close();
  }

}
