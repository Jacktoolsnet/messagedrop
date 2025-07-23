import { Component, computed, Inject, OnInit, Signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogContent, MatDialogRef } from '@angular/material/dialog';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from "@angular/material/expansion";
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { GetNominatimAddressResponse } from '../../interfaces/get-nominatim-address-response copy';
import { Mode } from '../../interfaces/mode';
import { NominatimPlace } from '../../interfaces/nominatim-place';
import { Place } from '../../interfaces/place';
import { GeolocationService } from '../../services/geolocation.service';
import { IndexedDbService } from '../../services/indexed-db.service';
import { MapService } from '../../services/map.service';
import { NominatimService } from '../../services/nominatim.service';
import { PlaceService } from '../../services/place.service';
import { StyleService } from '../../services/style.service';
import { UserService } from '../../services/user.service';
import { AirQualityTileComponent } from './air-quality-tile/air-quality-tile.component';
import { DateTimeTileComponent } from './datetime-tile/datetime-tile.component';
import { DeletePlaceComponent } from './delete-place/delete-place.component';
import { NoteTileComponent } from './note-tile/note-tile.component';
import { PlaceProfileComponent } from './place-profile/place-profile.component';
import { WeatherTileComponent } from './weather-tile/weather-tile.component';

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
    MatInputModule,
    DateTimeTileComponent,
    WeatherTileComponent,
    AirQualityTileComponent,
    NoteTileComponent,
    MatExpansionModule
  ],
  templateUrl: './placelist.component.html',
  styleUrl: './placelist.component.css'
})
export class PlacelistComponent implements OnInit {
  placesSignal: Signal<Place[]>;

  readonly hasPlaces = computed(() => this.placesSignal().length > 0);
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
    public dialogRef: MatDialogRef<PlacelistComponent>,
    public placeDialog: MatDialog,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private style: StyleService,
    @Inject(MAT_DIALOG_DATA) public data: {}
  ) {
    this.placesSignal = this.placeService.sortedPlacesSignal;
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
                this.placeService.removePlace(this.placeToDelete.id);
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

    const dialogRef = this.placeDialog.open(PlaceProfileComponent, {
      panelClass: '',
      data: { mode: this.mode.EDIT_PLACE, user: this.userService.getUser(), place: place },
      closeOnNavigation: true,
      hasBackdrop: true
    });

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe(() => {
      this.placeService.updatePlace(place)
        .subscribe({
          next: simpleResponse => {
            if (simpleResponse.status === 200) {
              this.placeService.saveAdditionalPlaceInfos(place);
            }
          },
          error: (err) => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); },
          complete: () => { }
        });
    });
  }

  public handleSubscription(place: Place) {
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
              this.placeService.saveAdditionalPlaceInfos(place);
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
              this.placeService.saveAdditionalPlaceInfos(place);
            }
          },
          error: (err) => {
          },
          complete: () => { }
        });
    }
  }

  public pinPlace(place: Place) {
    place.pinned = true;
    this.placeService.saveAdditionalPlaceInfos(place);
    const updatedPlaces = this.placeService.getPlaces().map(p =>
      p.id === place.id ? { ...p, pinned: true } : p
    );
    this.placeService.setPlaces(updatedPlaces);
  }

  public unpinPlace(place: Place) {
    place.pinned = false;
    this.placeService.saveAdditionalPlaceInfos(place);
    const updatedPlaces = this.placeService.getPlaces().map(p =>
      p.id === place.id ? { ...p, pinned: false } : p
    );
    this.placeService.setPlaces(updatedPlaces);
  }

  public goBack() {
    this.dialogRef.close();
  }

  async addPlace() {
    let place: Place = {
      id: '',
      userId: this.userService.getUser().id,
      name: '',
      location: {
        latitude: 0,
        longitude: 0,
        plusCode: ''
      },
      base64Avatar: '',
      icon: '',
      subscribed: false,
      pinned: false,
      boundingBox: {
        latMin: 0,
        lonMin: 0,
        latMax: 0,
        lonMax: 0
      },
      timezone: '',
      datasets: {
        weatherDataset: {
          data: undefined,
          lastUpdate: undefined
        },
        airQualityDataset: {
          data: undefined,
          lastUpdate: undefined
        }
      }
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
              place.location = this.mapService.getMapLocation()
              place.boundingBox = this.geolocationService.getBoundingBoxFromPlusCodes([place.location.plusCode]);
              this.placeService.getTimezone(this.geolocationService.getCenterOfBoundingBox(place.boundingBox!)).subscribe({
                next: (timezoneResponse: any) => {
                  if (timezoneResponse.status === 200) {
                    place.timezone = timezoneResponse.timezone;
                    this.placeService.createPlace(place)
                      .subscribe({
                        next: createPlaceResponse => {
                          if (createPlaceResponse.status === 200) {
                            place.id = createPlaceResponse.placeId;
                            this.placeService.saveAdditionalPlaceInfos(place);
                            this.snackBarRef = this.snackBar.open(`Place succesfully created.`, '', { duration: 1000 });
                          }
                        },
                        error: (err) => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); },
                        complete: () => { }
                      });
                  }
                },
                error: (err) => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); },
                complete: () => { }
              });
            } else {
              nominatimPlace = nominatimAddressResponse.nominatimPlace;
              place.name = nominatimPlace.name ? nominatimPlace.name : this.nominatimService.getFormattedStreet(nominatimPlace, ' ');
              place.icon = this.nominatimService.getIconForPlace(nominatimPlace);
              place.boundingBox = this.nominatimService.getBoundingBoxFromNominatimPlace(nominatimPlace);
              place.location = this.nominatimService.getLocationFromNominatimPlace(nominatimPlace);
              this.placeService.getTimezone(this.geolocationService.getCenterOfBoundingBox(place.boundingBox!)).subscribe({
                next: (timezoneResponse: any) => {
                  if (timezoneResponse.status === 200) {
                    place.timezone = timezoneResponse.timezone;
                    this.placeService.createPlace(place)
                      .subscribe({
                        next: createPlaceResponse => {
                          if (createPlaceResponse.status === 200) {
                            place.id = createPlaceResponse.placeId;
                            this.placeService.saveAdditionalPlaceInfos(place);
                            this.snackBarRef = this.snackBar.open(`Place succesfully created.`, '', { duration: 1000 });
                          }
                        },
                        error: (err) => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); },
                        complete: () => { }
                      });
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
        place.icon = this.nominatimService.getIconForPlace(nominatimPlace);
        place.boundingBox = this.nominatimService.getBoundingBoxFromNominatimPlace(nominatimPlace);
        place.location = this.nominatimService.getLocationFromNominatimPlace(nominatimPlace);
        this.placeService.getTimezone(this.geolocationService.getCenterOfBoundingBox(place.boundingBox!)).subscribe({
          next: (timezoneResponse: any) => {
            if (timezoneResponse.status === 200) {
              place.timezone = timezoneResponse.timezone;
              this.placeService.createPlace(place)
                .subscribe({
                  next: createPlaceResponse => {
                    if (createPlaceResponse.status === 200) {
                      place.id = createPlaceResponse.placeId;
                      this.placeService.saveAdditionalPlaceInfos(place);
                      this.snackBarRef = this.snackBar.open(`Place succesfully created.`, '', { duration: 1000 });
                    }
                  },
                  error: (err) => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); },
                  complete: () => { }
                });
            }
          },
          error: (err) => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); },
          complete: () => { }
        });
      }
    }
  }

  public flyTo(place: Place) {
    this.mapService.fitMapToBounds(place.boundingBox);
    this.dialogRef.close();
  }

}
