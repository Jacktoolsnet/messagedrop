import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatOptionModule } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { Location } from '../../../interfaces/location';
import { NominatimPlace } from '../../../interfaces/nominatim-place';
import { NominatimService } from '../../../services/nominatim.service';

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
    MatMenuModule
  ],
  templateUrl: './nominatim-search.component.html',
  styleUrl: './nominatim-search.component.css'
})
export class NominatimSearchComponent {
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
    private nominatimService: NominatimService,
    public dialogRef: MatDialogRef<NominatimSearchComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { location: Location }
  ) { }

  ngOnInit(): void { }

  onSelectChange(event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    selectElement.blur();
  }

  search(): void {
    this.nominatimPlaces = [];
    const term = this.searchterm.value?.trim();
    if (!term) return;

    const limit = 50;
    const radius = Number(this.selectedRadius);
    if (radius === 0) {
      // Umkreissuche ohne Bound
      this.nominatimService.getAddressBySearchTermWithViewbox(
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
      this.nominatimService.getAddressBySearchTermWithViewboxAndBounded(
        term,
        this.data.location.latitude,
        this.data.location.longitude,
        1,      // bounded = true
        limit,
        radius
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
    const type = place.type?.toLowerCase() || '';
    switch (type) {
      case 'zoo':
      case 'animal':
        return 'pets';
      case 'restaurant':
      case 'food':
        return 'restaurant';
      case 'school':
        return 'school';
      case 'park':
        return 'park';
      case 'city':
      case 'town':
      case 'village':
        return 'location_city';
      case 'museum':
        return 'museum';
      case 'hotel':
        return 'hotel';
      case 'station':
      case 'bus_station':
        return 'directions_bus';
      default:
        return 'place';
    }
  }

  getFormattedAddress(place: NominatimPlace): string {
    const address = place.address;
    if (!address) return '';

    const lines: string[] = [];

    const street = [address.road, address.house_number].filter(Boolean).join(' ');
    if (street) lines.push(street);

    const cityLine = [address.postcode, address.city || address.town || address.village].filter(Boolean).join(' ');
    if (cityLine) lines.push(cityLine);

    const suburb = address.suburb;
    if (suburb) lines.push(suburb)

    const country = address.country;
    if (country && !lines.includes(country)) lines.push(country);

    return lines.join('\n');
  }

  formatDistance(distance: number): string {
    const locale = navigator.language; // Holt die locale des Browsers (z.B. 'de-DE' für Deutschland)
    const formattedDistance = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 1, // Maximale Dezimalstellen (optional anpassbar)
    }).format(distance >= 1000 ? distance / 1000 : distance);

    return `${formattedDistance} ${distance >= 1000 ? 'km' : 'm'}`;
  }
}
