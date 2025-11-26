import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatOptionModule } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Location } from '../../../interfaces/location';
import { NominatimPlace } from '../../../interfaces/nominatim-place';
import { Place } from '../../../interfaces/place';
import { CreatePlaceResponse } from '../../../interfaces/create-place-response';
import { SimpleStatusResponse } from '../../../interfaces/simple-status-response';
import { createDefaultTileSettings } from '../../../interfaces/tile-settings';
import { GeolocationService } from '../../../services/geolocation.service';
import { MapService } from '../../../services/map.service';
import { NominatimService } from '../../../services/nominatim.service';
import { PlaceService } from '../../../services/place.service';
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
    CommonModule,
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
    MatDialogContent
  ],
  templateUrl: './nominatim-search.component.html',
  styleUrl: './nominatim-search.component.css'
})
export class NominatimSearchComponent {

  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;
  readonly searchTerm = new FormControl('', { nonNullable: true });

  selectedRadius = 0; // z. B. 1000 = 1 km
  readonly radiusOptions: readonly { value: number; label: string }[] = [
    { value: 0, label: 'Worldwide' },
    { value: 1000, label: '1 km' },
    { value: 2000, label: '2 km' },
    { value: 5000, label: '5 km' },
    { value: 10000, label: '10 km' },
    { value: 25000, label: '25 km' },
    { value: 50000, label: '50 km' },
    { value: 100000, label: '100 km' },
    { value: 200000, label: '200 km' }
  ];

  nominatimPlaces: NominatimPlace[] = [];

  readonly userService = inject(UserService);
  readonly nominatimService = inject(NominatimService);
  private readonly placeService = inject(PlaceService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly mapService = inject(MapService);
  private readonly dialogRef = inject(MatDialogRef<NominatimSearchComponent>);
  private readonly snackBar = inject(MatSnackBar);
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
    this.snackBar.open('Search failed. Please try again later.', 'OK', { duration: 2000 });
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
    this.userService.login(() => this.addToMyPlaces(nominatimPlace));
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
                  this.snackBar.open(`Place succesfully created.`, '', { duration: 1000 });
                }
              },
              error: (err) => this.handleCreatePlaceError(err)
            });
        } else {
          this.snackBar.open('Failed to resolve timezone for this place.', 'OK', { duration: 2000 });
        }
      },
      error: (err) => this.handleTimezoneError(err)
    });
  }

  private handleCreatePlaceError(error: unknown): void {
    console.error('Failed to create place', error);
    this.snackBar.open('Creating the place failed. Please try again.', 'OK', { duration: 2000 });
  }

  private handleTimezoneError(error: unknown): void {
    console.error('Timezone lookup failed', error);
    this.snackBar.open('Unable to determine timezone.', 'OK', { duration: 2000 });
  }
}
