import { ChangeDetectionStrategy, Component, inject, Input, OnChanges } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Place } from '../../interfaces/place';
import { TripGoLocation } from '../../interfaces/tripgo';
import { Weather } from '../../interfaces/weather';
import { GeolocationService } from '../../services/geolocation.service';
import { DatasetState, OpenMeteoRefreshService } from '../../services/open-meteo-refresh.service';
import { weatherIconForCode } from '../../utils/weather-icon.util';

@Component({
  selector: 'app-tripgo-timeline-weather',
  imports: [TranslocoPipe],
  templateUrl: './tripgo-timeline-weather.component.html',
  styleUrl: './tripgo-timeline-weather.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TripGoTimelineWeatherComponent implements OnChanges {
  @Input() location?: TripGoLocation;

  private readonly geolocation = inject(GeolocationService);
  private readonly refreshService = inject(OpenMeteoRefreshService);
  private weatherState?: DatasetState<Weather>;

  ngOnChanges(): void {
    const latitude = Number(this.location?.latitude);
    const longitude = Number(this.location?.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      this.weatherState = undefined;
      return;
    }

    const place = this.createTransientPlace(latitude, longitude);
    this.weatherState = this.refreshService.getWeatherState(place);
    // Weather is supplementary information in the route timeline and
    // simulation. Rate limits or temporary failures must not interrupt the
    // route with a global display-message dialog.
    this.refreshService.refreshWeather(place, false, false, true);
  }

  get weather(): Weather | undefined {
    return this.weatherState?.data();
  }

  get icon(): string {
    return weatherIconForCode(this.weather?.current.weatherCode);
  }

  get roundedTemperature(): number {
    return Math.round(this.weather?.current.temperature ?? 0);
  }

  private createTransientPlace(latitude: number, longitude: number): Place {
    const coordinateRadius = 0.0001;
    return {
      // Nearby stops share one request because weather data does not vary at metre-level resolution.
      id: `tripgo-route-point:weather:${latitude.toFixed(2)}:${longitude.toFixed(2)}`,
      userId: '',
      location: {
        latitude,
        longitude,
        plusCode: this.geolocation.getPlusCode(latitude, longitude)
      },
      name: this.location?.name || this.location?.address || '',
      base64Avatar: '',
      icon: 'cloud',
      subscribed: false,
      pinned: false,
      boundingBox: {
        latMin: latitude - coordinateRadius,
        lonMin: longitude - coordinateRadius,
        latMax: latitude + coordinateRadius,
        lonMax: longitude + coordinateRadius
      },
      timezone: this.location?.timezone || '',
      datasets: {
        weatherDataset: { data: undefined, lastUpdate: undefined },
        airQualityDataset: { data: undefined, lastUpdate: undefined }
      }
    };
  }
}
