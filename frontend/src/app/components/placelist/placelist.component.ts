import { Component, computed, effect, inject, Signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { GetNominatimAddressResponse } from '../../interfaces/get-nominatim-address-response copy';
import { Mode } from '../../interfaces/mode';
import { NominatimPlace } from '../../interfaces/nominatim-place';
import { Place } from '../../interfaces/place';
import { createDefaultTileSettings } from '../../interfaces/tile-settings';
import { GeolocationService } from '../../services/geolocation.service';
import { IndexedDbService } from '../../services/indexed-db.service';
import { MapService } from '../../services/map.service';
import { NominatimService } from '../../services/nominatim.service';
import { PlaceService } from '../../services/place.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { DeletePlaceComponent } from '../tile/delete-place/delete-place.component';
import { TileListDialogComponent } from "../tile/tile-list-dialog/tile-list-dialog.component";
import { PlaceProfileComponent } from './place-settings/place-settings.component';

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
    MatDialogActions,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatMenuModule,
    MatInputModule,
    TranslocoPipe
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
  private readonly translation = inject(TranslationHelperService);
  private readonly dialogData = inject<unknown>(MAT_DIALOG_DATA);

  readonly placesSignal: Signal<Place[]> = this.placeService.sortedPlacesSignal;
  readonly hasPlaces = computed(() => this.placesSignal().length > 0);
  private placeToDelete?: Place;
  public mode: typeof Mode = Mode;
  private snackBarRef?: MatSnackBarRef<SimpleSnackBar>;
  public subscriptionError = false;

  constructor() {
    effect(() => {
      const count = this.placesSignal().length;
      const width = count > 1 ? 'min(900px, 95vw)' : 'min(520px, 95vw)';
      this.dialogRef.updateSize(width);
    });
  }

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
              this.snackBar.open(
                err?.message ?? this.translation.t('common.placeList.deleteFailed'),
                this.translation.t('common.actions.ok'),
                { duration: 3000 }
              );
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
          error: err => {
            this.snackBarRef = this.snackBar.open(err.message, this.translation.t('common.actions.ok'));
          }
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
          this.snackBar.open(
            err?.message ?? this.translation.t('common.placeList.subscribeFailed'),
            this.translation.t('common.actions.ok'),
            { duration: 3000 }
          );
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
          this.snackBar.open(
            err?.message ?? this.translation.t('common.placeList.unsubscribeFailed'),
            this.translation.t('common.actions.ok'),
            { duration: 3000 }
          );
        }
      });
    }
  }

  openTileList(place: Place): void {
    this.matDialog.open(TileListDialogComponent, {
      data: { place },
      minWidth: 'min(500px, 95vw)',
      maxWidth: '95vw',
      width: 'min(900px, 95vw)',
      maxHeight: '90vh',
      height: 'auto',
      hasBackdrop: true,
      autoFocus: false
    });
  }

  tileListAriaLabel(place: Place): string {
    const name = place.name || this.translation.t('common.placeList.nameFallback');
    return this.translation.t('common.tileList.openAria', { name });
  }

  getPlaceHeaderBackgroundImage(place: Place): string {
    return place.placeBackgroundImage ? `url(${place.placeBackgroundImage})` : 'none';
  }

  getPlaceHeaderBackgroundOpacity(place: Place): number {
    if (!place.placeBackgroundImage) {
      return 0;
    }
    const transparency = place.placeBackgroundTransparency ?? 40;
    const clamped = Math.min(Math.max(transparency, 0), 100);
    return 1 - clamped / 100;
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

  openPlaceInMaps(place: Place): void {
    const location = place.location;
    if (!location) {
      return;
    }
    const query = location.plusCode || `${location.latitude},${location.longitude}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
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
      placeBackgroundImage: '',
      placeBackgroundTransparency: 40,
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
      tileSettings: createDefaultTileSettings(),
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
      ); // within 50 m
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
                          this.snackBarRef = this.snackBar.open(
                            this.translation.t('common.placeList.createSuccess'),
                            '',
                            { duration: 1000 }
                          );
                        }
                      },
                      error: err => {
                        this.snackBarRef = this.snackBar.open(err.message, this.translation.t('common.actions.ok'));
                      }
                    });
                  }
                },
                error: err => {
                  this.snackBarRef = this.snackBar.open(err.message, this.translation.t('common.actions.ok'));
                }
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
                          this.snackBarRef = this.snackBar.open(
                            this.translation.t('common.placeList.createSuccess'),
                            '',
                            { duration: 1000 }
                          );
                        }
                      },
                      error: err => {
                        this.snackBarRef = this.snackBar.open(err.message, this.translation.t('common.actions.ok'));
                      }
                    });
                  }
                },
                error: err => {
                  this.snackBarRef = this.snackBar.open(err.message, this.translation.t('common.actions.ok'));
                }
              });
            }
          }
        },
        error: () => {
          this.snackBar.open(
            this.translation.t('common.placeList.resolveFailed'),
            this.translation.t('common.actions.ok'),
            { duration: 3000 }
          );
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
                    this.snackBarRef = this.snackBar.open(
                      this.translation.t('common.placeList.createSuccess'),
                      '',
                      { duration: 1000 }
                    );
                  }
                },
              error: err => {
                this.snackBarRef = this.snackBar.open(err.message, this.translation.t('common.actions.ok'));
              }
              });
            }
          },
        error: err => {
          this.snackBarRef = this.snackBar.open(err.message, this.translation.t('common.actions.ok'));
        }
        });
      }
    }
  }

  public flyTo(place: Place) {
    this.mapService.fitMapToBounds(place.boundingBox);
    this.dialogRef.close();
  }

}
