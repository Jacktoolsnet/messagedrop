import { CommonModule } from '@angular/common';
import { Component, effect, inject, Injector, OnInit, runInInjectionContext, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { catchError, map, Observable, of } from 'rxjs';
import { GetNominatimAddressResponse } from '../../interfaces/get-nominatim-address-response copy';
import { Location } from '../../interfaces/location';
import { Place } from '../../interfaces/place';
import { Weather } from '../../interfaces/weather';
import { NominatimService } from '../../services/nominatim.service';
import { DatasetState, OpenMeteoRefreshService } from '../../services/open-meteo-refresh.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { getWeatherLevelInfo } from '../../utils/weather-level.util';
import { WeatherDetailComponent } from './weather-detail/weather-detail.component';
import { WeatherTile, WeatherTileType } from './weather-tile.interface';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-weather',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSliderModule,
    FormsModule,
    WeatherDetailComponent,
    MatButtonToggleModule,
    TranslocoPipe
  ],
  templateUrl: './weather.component.html',
  styleUrls: ['./weather.component.css']
})
export class WeatherComponent implements OnInit {

  private readonly dialogData = inject<{ weather?: Weather; location: Location; place?: Place }>(MAT_DIALOG_DATA);
  private readonly refreshService = inject(OpenMeteoRefreshService);
  private readonly translation = inject(TranslationHelperService);
  private readonly injector = inject(Injector);
  readonly help = inject(HelpDialogService);

  location: Location = this.dialogData.location;
  private readonly tilesSignal = signal<WeatherTile[]>([]);
  readonly tiles = this.tilesSignal.asReadonly();

  selectedDayIndex = 0;
  selectedHour = 0;

  selectedTile: WeatherTile | null = null;
  tileIndex = 0;

  locationName$: Observable<string> | undefined;

  private readonly nomatinService = inject(NominatimService);
  private readonly weatherSignal = signal<Weather | null>(null);
  readonly weatherSig = this.weatherSignal.asReadonly();
  private weatherState?: DatasetState<Weather>;
  private readonly tileLabelKeys: Record<WeatherTileType, string> = {
    temperature: 'weather.tiles.temperature',
    precipitationprobability: 'weather.tiles.precipitationProbability',
    precipitation: 'weather.tiles.precipitation',
    uvIndex: 'weather.tiles.uvIndex',
    wind: 'weather.tiles.wind',
    pressure: 'weather.tiles.pressure'
  };

  get weather(): Weather | null {
    return this.weatherSignal();
  }

  ngOnInit(): void {
    this.selectedHour = new Date().getHours();
    this.getLocationName();
    const place = this.dialogData.place;
    if (place) {
      this.weatherState = this.refreshService.getWeatherState(place);
      this.refreshService.refreshWeather(place);
    }
    const initialWeather = this.dialogData.weather ?? this.weatherState?.data() ?? null;
    this.weatherSignal.set(initialWeather);
    runInInjectionContext(this.injector, () => {
      effect(() => {
        const nextWeather = this.weatherState?.data() ?? this.dialogData.weather ?? null;
        if (nextWeather !== this.weatherSignal()) {
          this.weatherSignal.set(nextWeather);
          this.updateTiles();
        }
      });
    });
    this.updateTiles(true);
  }

  onTileClick(tile: WeatherTile): void {
    const numericValue = this.getTileNumericValue(tile.type);
    if (numericValue == null || numericValue === 0) return;
    this.selectedTile = tile;
    this.tileIndex = this.tiles().findIndex(t => t.type === tile.type);
  }

  selectPreviousTile(): void {
    if (this.tileIndex > 0) {
      this.tileIndex--;
      this.selectedTile = this.tiles()[this.tileIndex];
    }
  }

  selectNextTile(): void {
    if (this.tileIndex < this.tiles().length - 1) {
      this.tileIndex++;
      this.selectedTile = this.tiles()[this.tileIndex];
    }
  }

  onDayChange(index: number): void {
    this.selectedDayIndex = Number(index);
    this.updateTiles();
  }

  onHourChange(): void {
    if (!this.selectedTile) {
      this.updateTiles();
    }
  }

  clearSelectedTile(): void {
    this.selectedTile = null;
    this.updateTiles();
  }

  getDayLabel(index: number): string {
    const date = new Date(this.weather!.daily[index].date);
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: '2-digit' };
    return date.toLocaleDateString(undefined, options);
  }

  getLocationName(): void {
    const unknownPlace = this.translation.t('weather.location.unknown');
    this.locationName$ = this.nomatinService
      .getNominatimPlaceByLocation(this.location)
      .pipe(
        map((res: GetNominatimAddressResponse) => {
          const addr = res.nominatimPlace.address;
          const place = addr?.city || addr?.town || addr?.village || addr?.hamlet || unknownPlace;
          const country = addr?.country || '';
          return `${place}${country ? ', ' + country : ''}`;
        }),
        catchError(() => of(''))
      );
  }

  private updateTiles(init = false): void {
    const daily = this.weather?.daily ?? [];
    if (this.selectedDayIndex >= daily.length) {
      this.selectedDayIndex = 0;
    }
    const date = daily[this.selectedDayIndex]?.date;
    const hour = this.selectedHour.toString().padStart(2, '0');
    const hourly = this.weather?.hourly;

    if (!hourly || !date) {
      this.tilesSignal.set([]);
      return;
    }

    const dayHours = hourly.filter(h => h.time.startsWith(date));
    if (dayHours.length === 0) {
      this.tilesSignal.set([]);
      return;
    }
    let hourData = dayHours.find(h => h.time.includes(`${hour}:`));
    if (!hourData) {
      hourData = dayHours[0];
      const fallbackHour = hourData.time.split('T')[1]?.slice(0, 2);
      if (fallbackHour) {
        const parsed = Number(fallbackHour);
        if (!Number.isNaN(parsed)) {
          this.selectedHour = parsed;
        }
      }
    }

    const isDarkMode = document.body.classList.contains('dark');

    const make = (
      type: WeatherTileType,
      icon: string,
      value: string,
      levelText: string,
      minMax: { min: number; max: number },
      color: string
    ): WeatherTile => ({ type, label: this.translation.t(this.tileLabelKeys[type]), icon, value, levelText, color, minMax });

    this.tilesSignal.set([
      make(
        'temperature',
        'thermostat',
        `${init ? this.weather?.current.temperature : hourData.temperature} °C`,
        this.translation.t(getWeatherLevelInfo('temperature', hourData.temperature, isDarkMode).labelKey),
        this.getHourlyMinMax('temperature'),
        getWeatherLevelInfo('temperature', hourData.temperature, isDarkMode).color
      ),
      make(
        'precipitationprobability',
        'water_drop',
        `${hourData.precipitationProbability} %`,
        this.translation.t(getWeatherLevelInfo('precipitationprobability', hourData.precipitationProbability, isDarkMode).labelKey),
        this.getHourlyMinMax('precipitationProbability'),
        getWeatherLevelInfo('precipitationprobability', hourData.precipitationProbability, isDarkMode).color
      ),
      make(
        'precipitation',
        'grain',
        `${hourData.precipitation} mm/h`,
        this.translation.t(getWeatherLevelInfo('precipitation', hourData.precipitation, isDarkMode).labelKey),
        this.getHourlyMinMax('precipitation'),
        getWeatherLevelInfo('precipitation', hourData.precipitation, isDarkMode).color
      ),
      make(
        'uvIndex',
        'light_mode',
        `${hourData.uvIndex}`,
        this.translation.t(getWeatherLevelInfo('uvIndex', hourData.uvIndex, isDarkMode).labelKey),
        this.getHourlyMinMax('uvIndex'),
        getWeatherLevelInfo('uvIndex', hourData.uvIndex, isDarkMode).color
      ),
      make(
        'wind',
        'air',
        `${hourData.wind} km/h`,
        this.translation.t(getWeatherLevelInfo('wind', hourData.wind, isDarkMode).labelKey),
        this.getHourlyMinMax('wind'),
        getWeatherLevelInfo('wind', hourData.wind, isDarkMode).color
      ),
      make(
        'pressure',
        'compress',
        `${hourData.pressure} hPa`,
        this.translation.t(getWeatherLevelInfo('pressure', hourData.pressure, isDarkMode).labelKey),
        this.getHourlyMinMax('pressure'),
        getWeatherLevelInfo('pressure', hourData.pressure, isDarkMode).color
      )
    ]);
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
