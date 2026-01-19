
import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { BoundingBox } from '../../../interfaces/bounding-box';
import { CreatePlaceResponse } from '../../../interfaces/create-place-response';
import { DisplayMessageConfig } from '../../../interfaces/display-message-config';
import { Location } from '../../../interfaces/location';
import { NominatimPlace } from '../../../interfaces/nominatim-place';
import { Place } from '../../../interfaces/place';
import { SimpleStatusResponse } from '../../../interfaces/simple-status-response';
import { createDefaultTileSettings } from '../../../interfaces/tile-settings';
import { GeolocationService } from '../../../services/geolocation.service';
import { MapService } from '../../../services/map.service';
import { NominatimService } from '../../../services/nominatim.service';
import { PlaceService } from '../../../services/place.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { UserService } from '../../../services/user.service';
import { DisplayMessage } from '../display-message/display-message.component';
import { NominatimResultDialogComponent } from './components/nominatim-result-dialog/nominatim-result-dialog.component';
import { NominatimResultsListComponent } from './components/nominatim-results-list/nominatim-results-list.component';
import { NominatimResultsMapComponent } from './components/nominatim-results-map/nominatim-results-map.component';

interface SearchValues {
  searchterm: string;
  nominatimPlaces: NominatimPlace[];
}

interface NominatimDialogData {
  location: Location;
  searchValues?: SearchValues;
}

interface NominatimSearchResponse {
  result: NominatimPlace[];
}

type TimezoneResponse = SimpleStatusResponse & { timezone?: string };

@Component({
  selector: 'app-nominatim-search',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatIcon,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    TranslocoPipe,
    NominatimResultsListComponent,
    NominatimResultsMapComponent
  ],
  templateUrl: './nominatim-search.component.html',
  styleUrl: './nominatim-search.component.css'
})
export class NominatimSearchComponent {

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild(NominatimResultsMapComponent)
  set mapComponent(component: NominatimResultsMapComponent | undefined) {
    this._mapComponent = component;
    if (component && this.pendingBounds) {
      component.fitBounds(this.pendingBounds);
      this.pendingBounds = undefined;
    }
  }
  readonly searchTerm = new FormControl('', { nonNullable: true });

  nominatimPlaces: NominatimPlace[] = [];
  viewMode: 'list' | 'map' = 'map';
  currentBounds?: BoundingBox;
  private pendingBounds?: BoundingBox;
  private _mapComponent?: NominatimResultsMapComponent;
  mapView = {
    center: { latitude: 0, longitude: 0, plusCode: '' },
    zoom: 2
  };

  readonly userService = inject(UserService);
  readonly nominatimService = inject(NominatimService);
  private readonly placeService = inject(PlaceService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly mapService = inject(MapService);
  private readonly dialogRef = inject(MatDialogRef<NominatimSearchComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly translation = inject(TranslationHelperService);
  readonly data = inject<NominatimDialogData>(MAT_DIALOG_DATA);

  constructor() {
    const searchValues = this.data.searchValues;
    if (searchValues) {
      this.searchTerm.setValue(searchValues.searchterm);
      this.nominatimPlaces = searchValues.nominatimPlaces;
    }
    this.currentBounds = this.mapService.getVisibleMapBoundingBox();
    this.mapView = {
      center: this.geolocationService.getCenterOfBoundingBox(this.currentBounds),
      zoom: this.mapService.getMapZoom()
    };
  }

  search(): void {
    this.searchInput?.nativeElement.blur();
    this.nominatimPlaces = [];
    const term = this.searchTerm.value.trim();
    if (!term) {
      return;
    }

    const limit = 50;
    const bounds = this.currentBounds ?? {
      latMin: -85,
      lonMin: -180,
      latMax: 85,
      lonMax: 180
    };

    this.nominatimService.getNominatimPlaceBySearchTermWithBoundingBox(term, bounds, limit).subscribe({
      next: (response) => this.handleSearchResponse(response, this.data.location),
      error: (error) => this.handleSearchError(error)
    });
  }

  private handleSearchResponse(response: NominatimSearchResponse, location: Location): void {
    this.nominatimPlaces = this.sortByDistance(
      location.latitude,
      location.longitude,
      response.result
    );
    if (!this.nominatimPlaces.length) {
      this.openDisplayMessage({
        showAlways: true,
        title: this.translation.t('common.location.searchTitle'),
        image: '',
        icon: 'info',
        message: this.translation.t('common.location.noResults'),
        button: '',
        delay: 1500,
        showSpinner: false,
        autoclose: true
      }, false);
    }
  }

  private handleSearchError(error: unknown): void {
    console.error('Nominatim search failed', error);
  }

  onApplyClick(): void {
    this.dialogRef.close();
  }

  private sortByDistance(latitude: number, longitude: number, places: NominatimPlace[]): NominatimPlace[] {
    return places
      .map(place => {
        const distance = this.calculateDistance(latitude, longitude, +place.lat, +place.lon);
        return { ...place, distance };
      })
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const toRad = (value: number) => value * Math.PI / 180;
    const R = 6371e3; // Erdradius in Metern

    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lon2 - lon1);

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c); // gerundet in Meter
  }

  public flyTo(place: NominatimPlace): void {
    this.viewMode = 'map';
    this.focusMapOnPlace(place);
  }

  loginAndAddToMyPlaces(nominatimPlace: NominatimPlace): void {
    this.userService.loginWithBackend(() => this.addToMyPlaces(nominatimPlace));
  }

  onAddPlaceClick(nominatimPlace: NominatimPlace): void {
    if (!this.userService.isReady()) {
      this.loginAndAddToMyPlaces(nominatimPlace);
      return;
    }
    this.addToMyPlaces(nominatimPlace);
  }

  addToMyPlaces(nominatimPlace: NominatimPlace): void {
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
    place.name = nominatimPlace.name!;
    place.icon = this.nominatimService.getIconForPlace(nominatimPlace);
    place.boundingBox = this.nominatimService.getBoundingBoxFromNominatimPlace(nominatimPlace);
    place.location = this.nominatimService.getLocationFromNominatimPlace(nominatimPlace);
    this.placeService.getTimezone(this.geolocationService.getCenterOfBoundingBox(place.boundingBox!)).subscribe({
      next: (response) => {
        const timezoneResponse = response as TimezoneResponse;
        if (timezoneResponse.status === 200 && timezoneResponse.timezone) {
          place.timezone = timezoneResponse.timezone;
          this.placeService.createPlace(place)
            .subscribe({
              next: (createPlaceResponse: CreatePlaceResponse) => {
                if (createPlaceResponse.status === 200) {
                  place.id = createPlaceResponse.placeId;
                  this.placeService.saveAdditionalPlaceInfos(place);
                  this.openDisplayMessage({
                    showAlways: true,
                    title: this.translation.t('common.place.title'),
                    image: '',
                    icon: 'check_circle',
                    message: this.translation.t('common.placeList.createSuccess'),
                    button: '',
                    delay: 1000,
                    showSpinner: false,
                    autoclose: true
                  }, false);
                }
              },
              error: (err) => this.handleCreatePlaceError(err)
            });
        } else {
          this.openDisplayMessage({
            showAlways: true,
            title: this.translation.t('common.place.title'),
            image: '',
            icon: 'warning',
            message: this.translation.t('common.location.timezoneResolveFailed'),
            button: this.translation.t('common.actions.ok'),
            delay: 0,
            showSpinner: false,
            autoclose: false
          });
        }
      },
      error: (err) => this.handleTimezoneError(err)
    });
  }

  private handleCreatePlaceError(error: unknown): void {
    console.error('Failed to create place', error);
    this.openDisplayMessage({
      showAlways: true,
      title: this.translation.t('common.place.title'),
      image: '',
      icon: 'bug_report',
      message: this.translation.t('common.placeList.createFailed'),
      button: this.translation.t('common.actions.ok'),
      delay: 0,
      showSpinner: false,
      autoclose: false
    });
  }

  private handleTimezoneError(error: unknown): void {
    console.error('Timezone lookup failed', error);
    this.openDisplayMessage({
      showAlways: true,
      title: this.translation.t('common.place.title'),
      image: '',
      icon: 'warning',
      message: this.translation.t('common.location.timezoneResolveFailed'),
      button: this.translation.t('common.actions.ok'),
      delay: 0,
      showSpinner: false,
      autoclose: false
    });
  }

  onViewChange(event: { center: Location; zoom: number; bounds: BoundingBox }): void {
    this.currentBounds = event.bounds;
    this.mapView = {
      center: event.center,
      zoom: event.zoom
    };
  }

  private focusMapOnPlace(place: NominatimPlace): void {
    const bounds = this.nominatimService.getBoundingBoxFromNominatimPlace(place);
    const hasFallbackBounds = bounds.latMin === 0 && bounds.latMax === 0 && bounds.lonMin === 0 && bounds.lonMax === 0
      && (Number(place.lat) !== 0 || Number(place.lon) !== 0);
    if (hasFallbackBounds) {
      const center = this.nominatimService.getLocationFromNominatimPlace(place);
      this.mapView = {
        center,
        zoom: Math.max(this.mapView.zoom, 14)
      };
      if (this._mapComponent) {
        this._mapComponent.setView(center, this.mapView.zoom);
      }
      return;
    }

    this.currentBounds = bounds;
    this.mapView = {
      center: this.geolocationService.getCenterOfBoundingBox(bounds),
      zoom: this.mapView.zoom
    };

    if (this._mapComponent) {
      this._mapComponent.fitBounds(bounds);
    } else {
      this.pendingBounds = bounds;
    }
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'list' ? 'map' : 'list';
  }

  openPlaceDialog(place: NominatimPlace): void {
    this.dialog.open(NominatimResultDialogComponent, {
      panelClass: '',
      closeOnNavigation: false,
      data: {
        place,
        showAddButton: this.showAddButton(),
        actions: {
          add: (selected: NominatimPlace) => this.onAddPlaceClick(selected),
          flyTo: (selected: NominatimPlace) => this.flyTo(selected),
          navigate: (selected: NominatimPlace) => this.nominatimService.navigateToNominatimPlace(selected)
        }
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: false,
      autoFocus: false
    });
  }

  showAddButton(): boolean {
    return !this.userService.isReady() || this.userService.hasJwt();
  }

  private openDisplayMessage(config: DisplayMessageConfig, hasBackdrop = true): void {
    this.dialog.open(DisplayMessage, {
      panelClass: '',
      closeOnNavigation: false,
      data: config,
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop,
      autoFocus: false
    });
  }
}
