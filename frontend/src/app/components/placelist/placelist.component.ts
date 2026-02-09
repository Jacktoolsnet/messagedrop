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
import { Location } from '../../interfaces/location';
import { Mode } from '../../interfaces/mode';
import { NominatimPlace } from '../../interfaces/nominatim-place';
import { Place } from '../../interfaces/place';
import { createDefaultTileSettings } from '../../interfaces/tile-settings';
import { GeolocationService } from '../../services/geolocation.service';
import { MapService } from '../../services/map.service';
import { NominatimService } from '../../services/nominatim.service';
import { PlaceService } from '../../services/place.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { DeletePlaceComponent } from '../tile/delete-place/delete-place.component';
import { TileListDialogComponent } from "../tile/tile-list-dialog/tile-list-dialog.component";
import { LocationPickerDialogComponent } from '../utils/location-picker-dialog/location-picker-dialog.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { PlaceProfileComponent } from './place-settings/place-settings.component';
import { PlaceSortDialogComponent } from './place-sort-dialog/place-sort-dialog.component';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';

interface TimezoneResponse { status: number; timezone: string }

@Component({
  selector: 'app-placelist',
  imports: [
    DialogHeaderComponent,
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
  private readonly nominatimService = inject(NominatimService);
  private readonly mapService = inject(MapService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly placeService = inject(PlaceService);
  readonly userService = inject(UserService);
  readonly dialogRef = inject(MatDialogRef<PlacelistComponent>);
  private readonly matDialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
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
    if (!this.userService.hasJwt()) {
      return;
    }
    this.placeToDelete = place;
    const dialogRef = this.matDialog.open(DeletePlaceComponent, {
      closeOnNavigation: true,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
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
    if (!this.userService.hasJwt()) {
      return;
    }

    const dialogRef = this.matDialog.open(PlaceProfileComponent, {
      panelClass: '',
      data: { mode: this.mode.EDIT_PLACE, user: this.userService.getUser(), place: place },
      closeOnNavigation: true,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
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
    if (!this.userService.hasJwt()) {
      return;
    }
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
      backdropClass: 'dialog-backdrop',
      disableClose: false,
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

  openSortDialog(): void {
    if (!this.userService.hasJwt()) {
      return;
    }
    const dialogRef = this.matDialog.open(PlaceSortDialogComponent, {
      data: { places: this.placesSignal() },
      minWidth: 'min(520px, 95vw)',
      maxWidth: '95vw',
      width: 'min(680px, 95vw)',
      maxHeight: '90vh',
      height: 'auto',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result?: { orderedIds?: string[] }) => {
      if (result?.orderedIds?.length) {
        void this.placeService.updatePlaceOrder(result.orderedIds);
      }
    });
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

  addPlace(): void {
    if (!this.userService.hasJwt()) {
      return;
    }

    const dialogRef = this.matDialog.open(LocationPickerDialogComponent, {
      data: { location: this.mapService.getMapLocation(), markerType: 'message' },
      maxWidth: '95vw',
      maxHeight: '95vh',
      width: '95vw',
      height: '95vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((location?: Location) => {
      if (!location) {
        return;
      }
      this.createPlaceFromLocation(location);
    });
  }

  private createPlaceFromLocation(location: Location): void {
    const place = this.buildNewPlace(location);
    this.nominatimService.getNominatimPlaceByLocation(place.location, true).subscribe({
      next: (nominatimAddressResponse: GetNominatimAddressResponse) => {
        if (nominatimAddressResponse.status !== 200) {
          return;
        }
        const nominatimPlace: NominatimPlace | undefined = nominatimAddressResponse.nominatimPlace;
        if (!nominatimPlace || nominatimPlace.error) {
          this.persistPlace(place);
          return;
        }
        place.name = nominatimPlace.name ? nominatimPlace.name : this.nominatimService.getFormattedStreet(nominatimPlace, ' ');
        place.icon = this.nominatimService.getIconForPlace(nominatimPlace);
        place.boundingBox = this.nominatimService.getBoundingBoxFromNominatimPlace(nominatimPlace);
        place.location = this.nominatimService.getLocationFromNominatimPlace(nominatimPlace);
        this.persistPlace(place);
      },
      error: () => {
        this.snackBar.open(
          this.translation.t('common.placeList.resolveFailed'),
          this.translation.t('common.actions.ok'),
          { duration: 3000 }
        );
      }
    });
  }

  private buildNewPlace(location: Location): Place {
    const resolvedLocation = location.plusCode
      ? { ...location }
      : { ...location, plusCode: this.geolocationService.getPlusCode(location.latitude, location.longitude) };
    return {
      id: '',
      userId: this.userService.getUser().id,
      name: '',
      hashtags: [],
      location: resolvedLocation,
      base64Avatar: '',
      placeBackgroundImage: '',
      placeBackgroundTransparency: 40,
      icon: '',
      subscribed: false,
      pinned: false,
      sortOrder: this.placeService.getNextSortOrder(),
      boundingBox: this.geolocationService.getBoundingBoxFromPlusCodes([resolvedLocation.plusCode]),
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
  }

  private persistPlace(place: Place): void {
    this.placeService.getTimezone(this.geolocationService.getCenterOfBoundingBox(place.boundingBox)).subscribe({
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

  public flyTo(place: Place) {
    this.mapService.fitMapToBounds(place.boundingBox);
    this.dialogRef.close();
  }

}
