import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { catchError, map, Observable, of } from 'rxjs';
import { GetNominatimAddressResponse } from '../../interfaces/get-nominatim-address-response copy';
import { Location } from '../../interfaces/location';
import { Weather } from '../../interfaces/weather';
import { NominatimService } from '../../services/nominatim.service';
import { WeatherDetailComponent } from './weather-detail/weather-detail.component';
import { WeatherTile, WeatherTileType } from './weather-tile.interface';
import { getWeatherLevelInfo } from '../../utils/weather-level.util';

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

  private readonly dialogData = inject<{ weather: Weather; location: Location }>(MAT_DIALOG_DATA);

  weather: Weather | null = this.dialogData.weather;
  location: Location = this.dialogData.location;
  tiles: WeatherTile[] = [];

  selectedDayIndex = 0;
  selectedHour = 0;

  selectedTile: WeatherTile | null = null;
  tileIndex = 0;

  locationName$: Observable<string> | undefined;

  private readonly nomatinService = inject(NominatimService);

  ngOnInit(): void {
    this.selectedHour = new Date().getHours();
    this.getLocationName();
    this.updateTiles(true);
  }

  onTileClick(tile: WeatherTile): void {
    const numericValue = this.getTileNumericValue(tile.type);
    if (numericValue == null || numericValue === 0) return;
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

    const isDarkMode = document.body.classList.contains('dark');

    const make = (
      type: WeatherTileType,
      label: string,
      icon: string,
      value: string,
      levelText: string,
      minMax: { min: number; max: number },
      color: string
    ): WeatherTile => ({ type, label, icon, value, levelText, color, minMax });

    this.tiles = [
      make(
        'temperature',
        'Temperature',
        'thermostat',
        `${init ? this.weather?.current.temperature : hourData.temperature} °C`,
        getWeatherLevelInfo('temperature', hourData.temperature, isDarkMode).label,
        this.getHourlyMinMax('temperature'),
        getWeatherLevelInfo('temperature', hourData.temperature, isDarkMode).color
      ),
      make(
        'precipitationprobability',
        'Rain chance',
        'water_drop',
        `${hourData.precipitationProbability} %`,
        getWeatherLevelInfo('precipitationprobability', hourData.precipitationProbability, isDarkMode).label,
        this.getHourlyMinMax('precipitationProbability'),
        getWeatherLevelInfo('precipitationprobability', hourData.precipitationProbability, isDarkMode).color
      ),
      make(
        'precipitation',
        'Rainfall',
        'grain',
        `${hourData.precipitation} mm/h`,
        getWeatherLevelInfo('precipitation', hourData.precipitation, isDarkMode).label,
        this.getHourlyMinMax('precipitation'),
        getWeatherLevelInfo('precipitation', hourData.precipitation, isDarkMode).color
      ),
      make(
        'uvIndex',
        'UV Index',
        'light_mode',
        `${hourData.uvIndex}`,
        getWeatherLevelInfo('uvIndex', hourData.uvIndex, isDarkMode).label,
        this.getHourlyMinMax('uvIndex'),
        getWeatherLevelInfo('uvIndex', hourData.uvIndex, isDarkMode).color
      ),
      make(
        'wind',
        'Wind',
        'air',
        `${hourData.wind} km/h`,
        getWeatherLevelInfo('wind', hourData.wind, isDarkMode).label,
        this.getHourlyMinMax('wind'),
        getWeatherLevelInfo('wind', hourData.wind, isDarkMode).color
      ),
      make(
        'pressure',
        'Pressure',
        'compress',
        `${hourData.pressure} hPa`,
        getWeatherLevelInfo('pressure', hourData.pressure, isDarkMode).label,
        this.getHourlyMinMax('pressure'),
        getWeatherLevelInfo('pressure', hourData.pressure, isDarkMode).color
      )
    ];
  }

  getTileNumericValue(type: WeatherTileType): number | null {
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
