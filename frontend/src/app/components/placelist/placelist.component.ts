import { Component, computed, inject, Signal } from '@angular/core';
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
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { GetNominatimAddressResponse } from '../../interfaces/get-nominatim-address-response copy';
import { Mode } from '../../interfaces/mode';
import { NominatimPlace } from '../../interfaces/nominatim-place';
import { Place } from '../../interfaces/place';
import { GeolocationService } from '../../services/geolocation.service';
import { IndexedDbService } from '../../services/indexed-db.service';
import { MapService } from '../../services/map.service';
import { NominatimService } from '../../services/nominatim.service';
import { PlaceService } from '../../services/place.service';
import { UserService } from '../../services/user.service';
import { AirQualityTileComponent } from './air-quality-tile/air-quality-tile.component';
import { DateTimeTileComponent } from './datetime-tile/datetime-tile.component';
import { DeletePlaceComponent } from './delete-place/delete-place.component';
import { ImageTileComponent } from './image-tile/image-tile.component';
import { MessageTileComponent } from "./message-tile/messagetile.component";
import { NoteTileComponent } from './note-tile/note-tile.component';
import { PlaceProfileComponent } from './place-profile/place-profile.component';
import { WeatherTileComponent } from './weather-tile/weather-tile.component';

interface TimezoneResponse { status: number; timezone: string }

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
    ImageTileComponent,
    MatExpansionModule,
    MessageTileComponent
  ],
  templateUrl: './placelist.component.html',
  styleUrl: './placelist.component.css'
})
export class PlacelistComponent {
  private readonly indexedDbService = inject(IndexedDbService);
  private readonly nominatimService = inject(NominatimService);
  private readonly mapService = inject(MapService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly placeService = inject(PlaceService);
  readonly userService = inject(UserService);
  readonly dialogRef = inject(MatDialogRef<PlacelistComponent>);
  private readonly matDialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialogData = inject<unknown>(MAT_DIALOG_DATA);

  readonly placesSignal: Signal<Place[]> = this.placeService.sortedPlacesSignal;
  readonly hasPlaces = computed(() => this.placesSignal().length > 0);
  private placeToDelete?: Place;
  public mode: typeof Mode = Mode;
  private snackBarRef?: MatSnackBarRef<SimpleSnackBar>;
  public subscriptionError = false;

  public deletePlace(place: Place) {
    this.placeToDelete = place;
    const dialogRef = this.matDialog.open(DeletePlaceComponent, {
      closeOnNavigation: true,
      hasBackdrop: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result && this.placeToDelete) {
        const target = this.placeToDelete;
        this.placeService.deletePlace(target.id)
          .subscribe({
            next: (simpleStatusResponse) => {
              if (simpleStatusResponse.status === 200) {
                this.placeService.removePlace(target.id);
                this.placeToDelete = undefined;
              }
            },
            error: err => {
              this.snackBar.open(err?.message ?? 'Could not delete the place.', 'OK', { duration: 3000 });
            }
          });
      }
    });
  }

  public editPlace(place: Place) {

    const dialogRef = this.matDialog.open(PlaceProfileComponent, {
      panelClass: '',
      data: { mode: this.mode.EDIT_PLACE, user: this.userService.getUser(), place: place },
      closeOnNavigation: true,
      hasBackdrop: true
    });

    dialogRef.afterClosed().subscribe(() => {
      this.placeService.updatePlace(place)
        .subscribe({
          next: simpleResponse => {
            if (simpleResponse.status === 200) {
              this.placeService.saveAdditionalPlaceInfos(place);
            }
          },
          error: err => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); }
        });
    });
  }

  public handleSubscription(place: Place) {
    if (Notification.permission !== "granted") {
      this.userService.registerSubscription(this.userService.getUser());
    }
    if (!place.subscribed && Notification.permission === "granted") {
      // subscribe to place
      this.placeService.subscribe(place).subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            place.subscribed = true;
            this.placeService.saveAdditionalPlaceInfos(place);
          }
        },
        error: err => {
          this.snackBar.open(err?.message ?? 'Subscribing failed.', 'OK', { duration: 3000 });
        }
      });
    } else {
      // Unsubscribe from place.
      this.placeService.unsubscribe(place).subscribe({
        next: (simpleStatusResponse) => {
          if (simpleStatusResponse.status === 200) {
            place.subscribed = false;
            this.placeService.saveAdditionalPlaceInfos(place);
          }
        },
        error: err => {
          this.snackBar.open(err?.message ?? 'Unsubscribing failed.', 'OK', { duration: 3000 });
        }
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

  async addPlace(): Promise<void> {
    const place: Place = {
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
    let nominatimPlace: NominatimPlace | undefined;
    const selectedPlace = await this.indexedDbService.getSetting<NominatimPlace>('nominatimSelectedPlace');
    let isNearby = false;
    if (selectedPlace) {
      nominatimPlace = selectedPlace;
      isNearby = this.geolocationService.areLocationsNear(
        this.mapService.getMapLocation(),
        this.nominatimService.getLocationFromNominatimPlace(nominatimPlace),
        50
      ); // innerhalb 50 m
    }
    if (!isNearby) {
      this.nominatimService.getNominatimPlaceByLocation(this.mapService.getMapLocation(), true).subscribe({
        next: (nominatimAddressResponse: GetNominatimAddressResponse) => {
          if (nominatimAddressResponse.status === 200) {
            if (nominatimAddressResponse.nominatimPlace.error) {
              place.location = this.mapService.getMapLocation()
              place.boundingBox = this.geolocationService.getBoundingBoxFromPlusCodes([place.location.plusCode]);
              this.placeService.getTimezone(this.geolocationService.getCenterOfBoundingBox(place.boundingBox!)).subscribe({
                next: (timezoneResponse) => {
                  const response = timezoneResponse as TimezoneResponse;
                  if (response.status === 200 && response.timezone) {
                    place.timezone = response.timezone;
                    this.placeService.createPlace(place).subscribe({
                      next: createPlaceResponse => {
                        if (createPlaceResponse.status === 200) {
                          place.id = createPlaceResponse.placeId;
                          this.placeService.saveAdditionalPlaceInfos(place);
                          this.snackBarRef = this.snackBar.open(`Place succesfully created.`, '', { duration: 1000 });
                        }
                      },
                      error: err => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); }
                    });
                  }
                },
                error: err => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); }
              });
            } else {
              nominatimPlace = nominatimAddressResponse.nominatimPlace;
              place.name = nominatimPlace.name ? nominatimPlace.name : this.nominatimService.getFormattedStreet(nominatimPlace, ' ');
              place.icon = this.nominatimService.getIconForPlace(nominatimPlace);
              place.boundingBox = this.nominatimService.getBoundingBoxFromNominatimPlace(nominatimPlace);
              place.location = this.nominatimService.getLocationFromNominatimPlace(nominatimPlace);
              this.placeService.getTimezone(this.geolocationService.getCenterOfBoundingBox(place.boundingBox!)).subscribe({
                next: (timezoneResponse) => {
                  const response = timezoneResponse as TimezoneResponse;
                  if (response.status === 200 && response.timezone) {
                    place.timezone = response.timezone;
                    this.placeService.createPlace(place).subscribe({
                      next: createPlaceResponse => {
                        if (createPlaceResponse.status === 200) {
                          place.id = createPlaceResponse.placeId;
                          this.placeService.saveAdditionalPlaceInfos(place);
                          this.snackBarRef = this.snackBar.open(`Place succesfully created.`, '', { duration: 1000 });
                        }
                      },
                      error: err => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); }
                    });
                  }
                },
                error: err => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); }
              });
            }
          }
        },
        error: () => {
          this.snackBar.open('Could not determine the current place.', 'OK', { duration: 3000 });
        }
      });
    } else {
      if (nominatimPlace) {
        place.name = nominatimPlace.name!;
        place.icon = this.nominatimService.getIconForPlace(nominatimPlace);
        place.boundingBox = this.nominatimService.getBoundingBoxFromNominatimPlace(nominatimPlace);
        place.location = this.nominatimService.getLocationFromNominatimPlace(nominatimPlace);
        this.placeService.getTimezone(this.geolocationService.getCenterOfBoundingBox(place.boundingBox!)).subscribe({
          next: (timezoneResponse) => {
            const response = timezoneResponse as TimezoneResponse;
            if (response.status === 200 && response.timezone) {
              place.timezone = response.timezone;
              this.placeService.createPlace(place).subscribe({
                next: createPlaceResponse => {
                  if (createPlaceResponse.status === 200) {
                    place.id = createPlaceResponse.placeId;
                    this.placeService.saveAdditionalPlaceInfos(place);
                    this.snackBarRef = this.snackBar.open(`Place succesfully created.`, '', { duration: 1000 });
                  }
                },
                error: err => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); }
              });
            }
          },
          error: err => { this.snackBarRef = this.snackBar.open(err.message, 'OK'); }
        });
      }
    }
  }

  public flyTo(place: Place) {
    this.mapService.fitMapToBounds(place.boundingBox);
    this.dialogRef.close();
  }

}
