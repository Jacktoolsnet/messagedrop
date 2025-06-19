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
import { BoundingBox } from '../../interfaces/bounding-box';
import { GetNominatimAddressResponse } from '../../interfaces/get-nominatim-address-response copy';
import { Location } from '../../interfaces/location';
import { Mode } from '../../interfaces/mode';
import { NominatimPlace } from '../../interfaces/nominatim-place';
import { Place } from '../../interfaces/place';
import { CryptoService } from '../../services/crypto.service';
import { GeolocationService } from '../../services/geolocation.service';
import { IndexedDbService } from '../../services/indexed-db.service';
import { MapService } from '../../services/map.service';
import { NominatimService } from '../../services/nominatim.service';
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
    private indexedDbService: IndexedDbService,
    private nominatimService: NominatimService,
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
        this.placeService.deletePlace(this.placeToDelete.id)
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
                this.placeService.saveAdditionalPlaceInfos();
                this.snackBarRef = this.snackBar.open(`Place succesfully edited.`, '', { duration: 1000 });
              }
            },
            error: (err) => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); },
            complete: () => { }
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

  async addPlace() {
    let place: Place = {
      id: '',
      userId: this.userService.getUser().id,
      name: '',
      base64Avatar: '',
      icon: '',
      subscribed: false,
      boundingBox: undefined,
      plusCodes: []
    };
    let nominatimPlace: NominatimPlace | undefined = undefined;
    let selectedPlace: string = await this.indexedDbService.getSetting('nominatimSelectedPlace');
    let isNearby: boolean = false;
    if (selectedPlace) {
      nominatimPlace = JSON.parse(selectedPlace) as NominatimPlace;
      isNearby = this.geolocationService.areLocationsNear(this.mapService.getMapLocation(), this.nominatimService.getLocationFromNominatimPlace(nominatimPlace), 50); // innerhalb 50 m
    }
    if (!isNearby) {
      this.nominatimService.getNominatimPlaceByLocation(this.mapService.getMapLocation(), true).subscribe({
        next: ((nominatimAddressResponse: GetNominatimAddressResponse) => {
          if (nominatimAddressResponse.status === 200) {
            if (nominatimAddressResponse.nominatimPlace.error) {
              let plusCode = this.geolocationService.getPlusCode(this.mapService.getMapLocation().latitude, this.mapService.getMapLocation().longitude);
              place.boundingBox = this.geolocationService.getBoundingBoxFromPlusCodes([plusCode]);
              place.plusCodes = this.geolocationService.getPlusCodesInBoundingBox(place.boundingBox!);
              this.placeService.createPlace(place)
                .subscribe({
                  next: createPlaceResponse => {
                    if (createPlaceResponse.status === 200) {
                      place.id = createPlaceResponse.placeId;
                      this.places.unshift(place);
                      this.placeService.saveAdditionalPlaceInfos();
                      this.snackBarRef = this.snackBar.open(`Place succesfully created.`, '', { duration: 1000 });
                    }
                  },
                  error: (err) => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); },
                  complete: () => { }
                });
            } else {
              nominatimPlace = nominatimAddressResponse.nominatimPlace;
              place.name = nominatimPlace.name!;
              let boundingBox: BoundingBox;
              if (nominatimPlace.boundingbox && nominatimPlace.boundingbox.length === 4) {
                boundingBox = {
                  latMin: parseFloat(nominatimPlace.boundingbox[0]),
                  latMax: parseFloat(nominatimPlace.boundingbox[1]),
                  lonMin: parseFloat(nominatimPlace.boundingbox[2]),
                  lonMax: parseFloat(nominatimPlace.boundingbox[3])
                };
                place.icon = this.nominatimService.getIconForPlace(nominatimPlace);
                place.boundingBox = boundingBox;
                place.plusCodes = this.geolocationService.getPlusCodesInBoundingBox(boundingBox);
              }
              this.placeService.createPlace(place)
                .subscribe({
                  next: createPlaceResponse => {
                    if (createPlaceResponse.status === 200) {
                      place.id = createPlaceResponse.placeId;
                      this.places.unshift(place);
                      this.placeService.saveAdditionalPlaceInfos();
                      this.snackBarRef = this.snackBar.open(`Place succesfully created.`, '', { duration: 1000 });
                    }
                  },
                  error: (err) => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); },
                  complete: () => { }
                });
            }
          }
        }),
        error: ((err) => { })
      });
    } else {
      if (nominatimPlace) {
        place.name = nominatimPlace.name!;
        let boundingBox: BoundingBox;
        if (nominatimPlace.boundingbox && nominatimPlace.boundingbox.length === 4) {
          boundingBox = {
            latMin: parseFloat(nominatimPlace.boundingbox[0]),
            latMax: parseFloat(nominatimPlace.boundingbox[1]),
            lonMin: parseFloat(nominatimPlace.boundingbox[2]),
            lonMax: parseFloat(nominatimPlace.boundingbox[3])
          };
          place.icon = this.nominatimService.getIconForPlace(nominatimPlace);
          place.boundingBox = boundingBox;
          place.plusCodes = this.geolocationService.getPlusCodesInBoundingBox(boundingBox);
        }
        this.placeService.createPlace(place)
          .subscribe({
            next: createPlaceResponse => {
              if (createPlaceResponse.status === 200) {
                place.id = createPlaceResponse.placeId;
                this.places.unshift(place);
                this.placeService.saveAdditionalPlaceInfos();
                this.snackBarRef = this.snackBar.open(`Place succesfully created.`, '', { duration: 1000 });
              }
            },
            error: (err) => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); },
            complete: () => { }
          });
      }
    }
  }

  public flyTo(place: Place) {
    let location: Location = this.geolocationService.getCenterOfBoundingBox(place.boundingBox!);
    this.mapService.flyToWithZoom(location, 18);
    this.dialogRef.close();
  }

}
