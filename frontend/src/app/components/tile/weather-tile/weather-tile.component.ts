import { Component, Input, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { BoundingBox } from '../../../interfaces/bounding-box';
import { Place } from '../../../interfaces/place';
import { Weather } from '../../../interfaces/weather';
import { GeolocationService } from '../../../services/geolocation.service';
import { DatasetState, OpenMeteoRefreshService } from '../../../services/open-meteo-refresh.service';
import { getWeatherLevelInfo } from '../../../utils/weather-level.util';
import { WeatherComponent } from '../../weather/weather.component';

@Component({
  selector: 'app-weather-tile',
  imports: [MatIcon, TranslocoPipe],
  templateUrl: './weather-tile.component.html',
  styleUrl: './weather-tile.component.css'
})
export class WeatherTileComponent {
  private placeRef?: Place;
  private weatherState?: DatasetState<Weather>;

  @Input() set place(value: Place) {
    this.placeRef = value;
    this.weatherState = this.refreshService.getWeatherState(value);
    this.refreshService.refreshWeather(value);
  }

  private readonly geolocationService = inject(GeolocationService);
  private readonly dialog = inject(MatDialog);
  private readonly refreshService = inject(OpenMeteoRefreshService);

  get weather(): Weather | undefined {
    return this.weatherState?.data() ?? undefined;
  }

  get weatherIcon(): string | undefined {
    return this.getWeatherIcon(this.weather?.current.weatherCode);
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

  getWeatherIcon(code?: number): string {
    if (code === undefined) return 'na';

    const map: Record<number, string> = {
      0: 'day-sunny',
      1: 'day-sunny-overcast',
      2: 'day-cloudy',
      3: 'cloudy',
      45: 'fog',
      48: 'fog',
      51: 'sprinkle',
      53: 'showers',
      55: 'rain-mix',
      56: 'sprinkle',
      57: 'rain-mix',
      61: 'rain',
      63: 'rain',
      65: 'rain-wind',
      66: 'rain',
      67: 'rain-wind',
      71: 'snow',
      73: 'snow',
      75: 'snow-wind',
      77: 'snowflake-cold',
      80: 'showers',
      81: 'showers',
      82: 'rain-wind',
      85: 'snow',
      86: 'snow-wind',
      95: 'thunderstorm',
      96: 'thunderstorm',
      99: 'thunderstorm'
    };

    return map[code] || 'na';
  }

  openWeatherDetails(): void {
    const boundingBox: BoundingBox | undefined = this.placeRef?.boundingBox;
    this.dialog.open(WeatherComponent, {
      data: { weather: this.weather, location: this.geolocationService.getCenterOfBoundingBox(boundingBox!), place: this.placeRef },
      closeOnNavigation: true,
      minWidth: '90vw',
      width: '90vw',
      maxWidth: '90vw',
      minHeight: '90vh',
      height: '90vh',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }

  getHourlyMinMax(field: 'temperature' | 'precipitationProbability' | 'precipitation' | 'wind' | 'pressure' | 'uvIndex'): { min: number, max: number } | undefined {
    const weather = this.weather;
    if (
      !weather ||
      !weather.hourly ||
      !weather.current?.time
    ) {
      return undefined;
    }
    const currentDate = weather.current.time.split('T')[0];

    const values = weather.hourly
      .filter((h: Weather['hourly'][number]) => h.time.startsWith(currentDate))
      .map((h: Weather['hourly'][number]) => h[field])
      .filter((v: unknown): v is number => typeof v === 'number');

    if (values.length === 0) return undefined;

    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }
}
