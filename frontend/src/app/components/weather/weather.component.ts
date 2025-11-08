import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, map, Observable, of } from 'rxjs';
import { GetNominatimAddressResponse } from '../../interfaces/get-nominatim-address-response copy';
import { Location } from '../../interfaces/location';
import { Weather } from '../../interfaces/weather';
import { NominatimService } from '../../services/nominatim.service';
import { WeatherDetailComponent } from './weather-detail/weather-detail.component';

@Component({
  selector: 'app-weather',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSliderModule,
    FormsModule,
    WeatherDetailComponent,
    MatButtonToggleModule
  ],
  templateUrl: './weather.component.html',
  styleUrls: ['./weather.component.css']
})
export class WeatherComponent implements OnInit {

  weather: Weather | null = null;
  location: Location;
  tiles: {
    type: string;
    label: string;
    icon: string;
    value: string;
    levelText: string;
    minMax: { min: number, max: number }
  }[] = [];

  selectedDayIndex = 0;
  selectedHour = 0;

  selectedTile: any = null;
  tileIndex = 0;

  locationName$: Observable<string> | undefined;

  constructor(
    private nomatinService: NominatimService,
    private dialogRef: MatDialogRef<WeatherComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { weather: Weather, location: Location }
  ) {
    this.weather = this.data.weather;
    this.location = this.data.location;
  }

  ngOnInit(): void {
    this.selectedHour = new Date().getHours();
    this.getLocationName();
    this.updateTiles(true);
  }

  onTileClick(tile: any): void {
    if (tile.value == null || tile.value === 0) return;
    this.selectedTile = tile;
    this.tileIndex = this.tiles.findIndex(t => t.type === tile.type);
  }

  selectPreviousTile(): void {
    if (this.tileIndex > 0) {
      this.tileIndex--;
      this.selectedTile = this.tiles[this.tileIndex];
    }
  }

  selectNextTile(): void {
    if (this.tileIndex < this.tiles.length - 1) {
      this.tileIndex++;
      this.selectedTile = this.tiles[this.tileIndex];
    }
  }

  onDayChange(index: number): void {
    this.selectedDayIndex = index;
    this.updateTiles();
  }

  onHourChange(): void {
    this.updateTiles();
  }

  getDayLabel(index: number): string {
    const date = new Date(this.weather!.daily[index].date);
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: '2-digit' };
    return date.toLocaleDateString(undefined, options);
  }

  getLocationName(): void {
    this.locationName$ = this.nomatinService
      .getNominatimPlaceByLocation(this.location)
      .pipe(
        map((res: GetNominatimAddressResponse) => {
          const addr = res.nominatimPlace.address;
          const place = addr?.city || addr?.town || addr?.village || addr?.hamlet || 'Unknown place';
          const country = addr?.country || '';
          return `${place}${country ? ', ' + country : ''}`;
        }),
        catchError(() => of('Weather'))
      );
  }

  private updateTiles(init = false): void {
    const date = this.weather?.daily[this.selectedDayIndex]?.date;
    const hour = this.selectedHour.toString().padStart(2, '0');
    const hourly = this.weather?.hourly;

    if (!hourly || !date) {
      this.tiles = [];
      return;
    }

    const hourData = hourly.find(h => h.time.startsWith(date) && h.time.includes(`${hour}:`));
    if (!hourData) {
      this.tiles = [];
      return;
    }

    const make = (
      type: string,
      label: string,
      icon: string,
      value: string,
      levelText: string,
      minMax: { min: number, max: number }
    ) => ({ type, label, icon, value, levelText, minMax });

    const timeList = hourly
      .filter(h => h.time.startsWith(date))
      .map(h => h.time);

    this.tiles = [
      make(
        'temperature',
        'Temperature',
        'thermostat',
        `${init ? this.weather?.current.temperature : hourData.temperature} °C`,
        this.getTileLevel('temperature', hourData.temperature),
        this.getHourlyMinMax('temperature')
      ),
      make(
        'precipitationprobability',
        'Rain chance',
        'water_drop',
        `${hourData.precipitationProbability} %`,
        this.getTileLevel('precipitationprobability', hourData.precipitationProbability),
        this.getHourlyMinMax('precipitationProbability')
      ),
      make(
        'precipitation',
        'Rainfall',
        'grain',
        `${hourData.precipitation} mm/h`,
        this.getTileLevel('precipitation', hourData.precipitation),
        this.getHourlyMinMax('precipitation')
      ),
      make(
        'uvIndex',
        'UV Index',
        'light_mode',
        `${hourData.uvIndex}`,
        this.getTileLevel('uvIndex', hourData.uvIndex),
        this.getHourlyMinMax('uvIndex')
      ),
      make(
        'wind',
        'Wind',
        'air',
        `${hourData.wind} km/h`,
        this.getTileLevel('wind', hourData.wind),
        this.getHourlyMinMax('wind')
      ),
      make(
        'pressure',
        'Pressure',
        'compress',
        `${hourData.pressure} hPa`,
        this.getTileLevel('pressure', hourData.pressure),
        this.getHourlyMinMax('pressure')
      )
    ];
  }

  getTileNumericValue(type: string): number | null {
    const hourly = this.weather?.hourly;
    const date = this.weather?.daily[this.selectedDayIndex]?.date;
    if (!hourly || !date) return null;

    const hourData = hourly.find(h =>
      h.time.startsWith(date) &&
      h.time.includes(`${this.selectedHour.toString().padStart(2, '0')}:`)
    );

    if (!hourData) return null;

    switch (type) {
      case 'temperature': return hourData.temperature ?? null;
      case 'precipitationprobability': return hourData.precipitationProbability ?? null;
      case 'precipitation': return hourData.precipitation ?? null;
      case 'uvIndex': return hourData.uvIndex ?? null;
      case 'wind': return hourData.wind ?? null;
      case 'pressure': return hourData.pressure ?? null;
      default: return null;
    }
  }

  getTileColor(type: string, value: number | null): string {
    if (value == null) return '';
    const isDarkMode = document.body.classList.contains('dark');

    const color = (() => {
      switch (type) {
        case 'temperature':
          if (value < 0) return '#1565C0';
          if (value < 10) return '#42A5F5';
          if (value < 20) return '#66BB6A';
          if (value < 28) return '#FFA726';
          if (value < 35) return '#EF5350';
          return '#B71C1C';
        case 'uvIndex':
          if (value < 3) return '#4CAF50';
          if (value < 6) return '#FFEB3B';
          if (value < 8) return '#FF9800';
          if (value < 11) return '#F44336';
          return '#9C27B0';
        case 'precipitationprobability':
          if (value < 20) return '#e0f7fa';
          if (value < 50) return '#81d4fa';
          if (value < 80) return '#0288d1';
          return '#01579b';
        case 'precipitation':
          if (value < 0.1) return '#e0f7fa';
          if (value < 1.0) return '#b3e5fc';
          if (value < 5.0) return '#81d4fa';
          if (value < 10.0) return '#4fc3f7';
          return '#0288d1';
        case 'wind':
          if (value < 5) return '#c8e6c9';
          if (value < 15) return '#aed581';
          if (value < 30) return '#fbc02d';
          if (value < 50) return '#fb8c00';
          return '#e64a19';
        case 'pressure':
          if (value < 980) return '#81d4fa';
          if (value < 1010) return '#c8e6c9';
          if (value < 1030) return '#ffcc80';
          return '#ffb74d';
        default:
          return '#ffffff';
      }
    })();

    return isDarkMode ? color : this.adjustColor(color, -50);
  }

  private adjustColor(hex: string, amount: number): string {
    return '#' + hex.replace(/^#/, '').replace(/../g, c =>
      ('0' + Math.min(255, Math.max(0, parseInt(c, 16) + amount)).toString(16)).slice(-2)
    );
  }

  getTileLevel(type: string, value: number): string {
    switch (type) {
      case 'temperature':
        if (value < 0) return 'Freezing';
        if (value < 10) return 'Cold';
        if (value < 20) return 'Cool';
        if (value < 28) return 'Warm';
        if (value < 35) return 'Hot';
        return 'Extreme heat';

      case 'uvIndex':
        if (value < 3) return 'Low';
        if (value < 6) return 'Moderate';
        if (value < 8) return 'High';
        if (value < 11) return 'Very high';
        return 'Extreme';

      case 'precipitationprobability':
        if (value < 20) return 'Unlikely';
        if (value < 50) return 'Possible';
        if (value < 80) return 'Likely';
        return 'Very likely';

      case 'precipitation':
        if (value < 0.1) return 'Dry';
        if (value < 1.0) return 'Light rain';
        if (value < 5.0) return 'Rain';
        if (value < 10.0) return 'Heavy rain';
        return 'Downpour';

      case 'wind':
        if (value < 5) return 'Calm';
        if (value < 15) return 'Breezy';
        if (value < 30) return 'Windy';
        if (value < 50) return 'Strong wind';
        return 'Storm';

      case 'pressure':
        if (value < 980) return 'Low';
        if (value < 1010) return 'Moderate';
        if (value < 1030) return 'High';
        return 'Very high';

      default:
        return '';
    }
  }

  getHourlyMinMax(field: 'temperature' | 'precipitationProbability' | 'precipitation' | 'wind' | 'pressure' | 'uvIndex'): { min: number, max: number } {
    if (
      !this.weather ||
      !this.weather.hourly ||
      !this.weather.daily ||
      this.selectedDayIndex == null ||
      !this.weather.daily[this.selectedDayIndex]
    ) {
      return { min: 0, max: 0 };
    }

    const selectedDate = this.weather.daily[this.selectedDayIndex].date;

    const values = this.weather.hourly
      .filter(h => h.time.startsWith(selectedDate))
      .map(h => h[field])
      .filter(v => typeof v === 'number');

    if (values.length === 0) return { min: 0, max: 0 };

    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

}