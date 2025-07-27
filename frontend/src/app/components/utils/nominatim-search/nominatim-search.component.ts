import { CommonModule } from '@angular/common';
import { Component, ElementRef, Inject, ViewChild } from '@angular/core';
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
import { GeolocationService } from '../../../services/geolocation.service';
import { MapService } from '../../../services/map.service';
import { NominatimService } from '../../../services/nominatim.service';
import { PlaceService } from '../../../services/place.service';
import { UserService } from '../../../services/user.service';

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

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  searchterm: FormControl = new FormControl<string>("");

  selectedRadius: number = 0; // z. B. 1000 = 1km
  radiusOptions = [
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

  constructor(
    public userService: UserService,
    private placeService: PlaceService,
    public nominatimService: NominatimService,
    private geolocationService: GeolocationService,
    private mapService: MapService,
    public dialogRef: MatDialogRef<NominatimSearchComponent>,
    private snackBar: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: {
      location: Location,
      searchValues: {
        searchterm: string,
        selectedRadius: number,
        nominatimPlaces: NominatimPlace[]
      }
    }
  ) {
    if (data.searchValues) {
      this.searchterm.setValue(data.searchValues.searchterm);
      this.selectedRadius = data.searchValues.selectedRadius;
      this.nominatimPlaces = data.searchValues.nominatimPlaces;
    }
  }

  ngOnInit(): void { }

  onSelectChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    selectElement.blur();
  }

  search(): void {
    this.searchInput.nativeElement.blur();
    this.nominatimPlaces = [];
    const term = this.searchterm.value?.trim();
    if (!term) return;

    const limit = 50;
    const radius = Number(this.selectedRadius);
    if (radius === 0) {
      // Umkreissuche ohne Bound
      this.nominatimService.getNominatimPlaceBySearchTermWithViewbox(
        term,
        this.data.location.latitude,
        this.data.location.longitude,
        limit
      ).subscribe({
        next: ((response) => {
          this.nominatimPlaces = this.sortByDistance(
            this.data.location.latitude,
            this.data.location.longitude,
            response.result
          );
        }),
        error: ((err) => { })
      });
    } else {
      // Umkreissuche mit Bound
      this.nominatimService.getNominatimPlaceBySearchTermWithViewboxAndBounded(
        term,
        this.data.location.latitude,
        this.data.location.longitude,
        1,      // bounded = true
        limit,
        radius
      ).subscribe({
        next: ((response) => {
          console.log(response);
          this.nominatimPlaces = this.sortByDistance(
            this.data.location.latitude,
            this.data.location.longitude,
            response.result
          );
        }),
        error: ((err) => { })
      });
    }
  }

  onApplyClick(result: any): void {
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

  public flyTo(place: NominatimPlace) {
    this.mapService.fitMapToBounds(this.nominatimService.getBoundingBoxFromNominatimPlace(place));
    let result = {
      action: 'saveSearch',
      selectedPlace: place,
      searchValues: {
        searchterm: this.searchterm.value?.trim() || '',
        selectedRadius: this.selectedRadius,
        nominatimPlaces: this.nominatimPlaces
      }
    };
    this.dialogRef.close(result);
  }

  lgoinAndAddToMypPlaces(nominatimPlace: NominatimPlace) {
    this.userService.login(() => this.addToMyPlaces(nominatimPlace))
  }

  addToMyPlaces(nominatimPlace: NominatimPlace) {
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
                  this.snackBar.open(`Place succesfully created.`, '', { duration: 1000 });
                }
              },
              error: (err) => { this.snackBar.open(err.message, 'OK'); },
              complete: () => { }
            });
        }
      },
      error: (err) => { this.snackBar.open(err.message, 'OK'); },
      complete: () => { }
    });
  }
}
