import { Component, Input, OnChanges, inject, ChangeDetectionStrategy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { BoundingBox } from '../../../interfaces/bounding-box';
import { Place } from '../../../interfaces/place';
import { Weather } from '../../../interfaces/weather';
import { GeolocationService } from '../../../services/geolocation.service';
import { DatasetState, OpenMeteoRefreshService } from '../../../services/open-meteo-refresh.service';
import { getWeatherLevelInfo } from '../../../utils/weather-level.util';
import { weatherIconForCode } from '../../../utils/weather-icon.util';
import { WeatherComponent } from '../../weather/weather.component';

@Component({
  selector: 'app-weather-tile',
  imports: [MatIcon, TranslocoPipe],
  templateUrl: './weather-tile.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './weather-tile.component.css'
})
export class WeatherTileComponent implements OnChanges {
  private placeRef?: Place;
  private weatherState?: DatasetState<Weather>;

  @Input() place?: Place;
  @Input() persist = true;

  private readonly geolocationService = inject(GeolocationService);
  private readonly dialog = inject(MatDialog);
  private readonly refreshService = inject(OpenMeteoRefreshService);

  ngOnChanges(): void {
    if (!this.place) return;
    this.placeRef = this.place;
    this.weatherState = this.refreshService.getWeatherState(this.place);
    this.refreshService.refreshWeather(this.place, false, this.persist);
  }

  get weather(): Weather | undefined {
    return this.weatherState?.data() ?? undefined;
  }

  get weatherIcon(): string | undefined {
    return weatherIconForCode(this.weather?.current.weatherCode);
  }

  get minMax(): { min: number, max: number } | undefined {
    return this.getHourlyMinMax('temperature');
  }

  get isStale(): boolean {
    return this.weatherState?.isStale() ?? false;
  }

  get tempColor(): string | undefined {
    const temp = this.weather?.current?.temperature ?? 0;
    const isDarkMode = document.body.classList.contains('dark');
    return getWeatherLevelInfo('temperature', temp, isDarkMode).color;
  }

  openWeatherDetails(): void {
    const boundingBox: BoundingBox | undefined = this.placeRef?.boundingBox;
    this.dialog.open(WeatherComponent, {
      data: {
        weather: this.weather,
        location: this.geolocationService.getCenterOfBoundingBox(boundingBox!),
        place: this.placeRef,
        locationName: this.placeRef?.name
      },
      closeOnNavigation: true,
      minWidth: '90vw',
      width: '90vw',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }

  getHourlyMinMax(field: 'temperature' | 'precipitationProbability' | 'precipitation' | 'wind' | 'pressure' | 'uvIndex'): { min: number, max: number } | undefined {
    const weather = this.weather;
    if (!weather?.hourly || !weather.current?.time) {
      return undefined;
    }

    const currentDate = weather.current.time.split('T')[0];
    const values = weather.hourly
      .filter((hour: Weather['hourly'][number]) => hour.time.startsWith(currentDate))
      .map((hour: Weather['hourly'][number]) => hour[field])
      .filter((value: unknown): value is number => typeof value === 'number');

    if (!values.length) {
      return undefined;
    }

    return { min: Math.min(...values), max: Math.max(...values) };
  }

}
