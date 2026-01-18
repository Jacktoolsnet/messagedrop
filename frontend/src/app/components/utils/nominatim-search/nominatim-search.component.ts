
import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatOptionModule } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { DisplayMessage } from '../display-message/display-message.component';
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

interface SearchValues {
  searchterm: string;
  selectedRadius: number;
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
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatOptionModule,
    MatBadgeModule,
    MatCardModule,
    MatMenuModule,
    MatDialogActions,
    MatDialogClose,
    MatDialogContent,
    TranslocoPipe
  ],
  templateUrl: './nominatim-search.component.html',
  styleUrl: './nominatim-search.component.css'
})
export class NominatimSearchComponent {

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  readonly searchTerm = new FormControl('', { nonNullable: true });

  selectedRadius = 0; // z. B. 1000 = 1 km
  readonly radiusOptions: readonly { value: number; labelKey: string; params?: Record<string, number> }[] = [
    { value: 0, labelKey: 'common.location.radius.worldwide' },
    { value: 1000, labelKey: 'common.location.radius.kilometers', params: { value: 1 } },
    { value: 2000, labelKey: 'common.location.radius.kilometers', params: { value: 2 } },
    { value: 5000, labelKey: 'common.location.radius.kilometers', params: { value: 5 } },
    { value: 10000, labelKey: 'common.location.radius.kilometers', params: { value: 10 } },
    { value: 25000, labelKey: 'common.location.radius.kilometers', params: { value: 25 } },
    { value: 50000, labelKey: 'common.location.radius.kilometers', params: { value: 50 } },
    { value: 100000, labelKey: 'common.location.radius.kilometers', params: { value: 100 } },
    { value: 200000, labelKey: 'common.location.radius.kilometers', params: { value: 200 } }
  ];

  nominatimPlaces: NominatimPlace[] = [];

  readonly userService = inject(UserService);
  readonly nominatimService = inject(NominatimService);
  private readonly placeService = inject(PlaceService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly mapService = inject(MapService);
  private readonly dialogRef = inject(MatDialogRef<NominatimSearchComponent>);
  private readonly displayMessage = inject(MatDialog);
  private readonly translation = inject(TranslationHelperService);
  private readonly data = inject<NominatimDialogData>(MAT_DIALOG_DATA);

  constructor() {
    const searchValues = this.data.searchValues;
    if (searchValues) {
      this.searchTerm.setValue(searchValues.searchterm);
      this.selectedRadius = searchValues.selectedRadius;
      this.nominatimPlaces = searchValues.nominatimPlaces;
    }
  }

  onSelectChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    selectElement.blur();
  }

  search(): void {
    this.searchInput?.nativeElement.blur();
    this.nominatimPlaces = [];
    const term = this.searchTerm.value.trim();
    if (!term) {
      return;
    }

    const limit = 50;
    const radius = Number(this.selectedRadius);
    const location = this.data.location;

    if (radius === 0) {
      // Umkreissuche ohne Bound
      this.nominatimService.getNominatimPlaceBySearchTermWithViewbox(
        term,
        location.latitude,
        location.longitude,
        limit
      ).subscribe({
        next: (response) => this.handleSearchResponse(response, location),
        error: (error) => this.handleSearchError(error)
      });
    } else {
      // Umkreissuche mit Bound
      this.nominatimService.getNominatimPlaceBySearchTermWithViewboxAndBounded(
        term,
        location.latitude,
        location.longitude,
        1,      // bounded = true
        limit,
        radius
      ).subscribe({
        next: (response) => this.handleSearchResponse(response, location),
        error: (error) => this.handleSearchError(error)
      });
    }
  }

  private handleSearchResponse(response: NominatimSearchResponse, location: Location): void {
    this.nominatimPlaces = this.sortByDistance(
      location.latitude,
      location.longitude,
      response.result
    );
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

  getIconForPlace(place: NominatimPlace): string {
    return this.nominatimService.getIconForPlace(place);
  }

  getFormattedAddress(place: NominatimPlace): string {
    return this.nominatimService.getFormattedAddress(place);
  }

  formatDistance(distance: number): string {
    const locale = navigator.language; // Holt die locale des Browsers (z.B. 'de-DE' für Deutschland)
    const formattedDistance = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1, // Maximale Dezimalstellen (optional anpassbar)
    }).format(distance >= 1000 ? distance / 1000 : distance);

    return `${formattedDistance} ${distance >= 1000 ? 'km' : 'm'}`;
  }

  public flyTo(place: NominatimPlace): void {
    this.mapService.fitMapToBounds(this.nominatimService.getBoundingBoxFromNominatimPlace(place));
    const result = {
      action: 'saveSearch',
      selectedPlace: place,
      searchValues: {
        searchterm: this.searchTerm.value.trim(),
        selectedRadius: this.selectedRadius,
        nominatimPlaces: this.nominatimPlaces
      }
    };
    this.dialogRef.close(result);
  }

  loginAndAddToMyPlaces(nominatimPlace: NominatimPlace): void {
    this.userService.loginWithBackend(() => this.addToMyPlaces(nominatimPlace));
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

  private openDisplayMessage(config: DisplayMessageConfig, hasBackdrop = true): void {
    this.displayMessage.open(DisplayMessage, {
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
