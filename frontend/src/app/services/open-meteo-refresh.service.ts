import { Injectable, Signal, WritableSignal, inject, signal } from '@angular/core';
import { DateTime } from 'luxon';
import { AirQualityData } from '../interfaces/air-quality-data';
import { Place } from '../interfaces/place';
import { Weather } from '../interfaces/weather';
import { AirQualityService } from './air-quality.service';
import { GeolocationService } from './geolocation.service';
import { PlaceService } from './place.service';
import { UserService } from './user.service';
import { WeatherService } from './weather.service';

export interface DatasetState<T> {
  data: Signal<T | undefined>;
  isStale: Signal<boolean>;
  isLoading: Signal<boolean>;
}

interface DatasetStateInternal<T> {
  data: WritableSignal<T | undefined>;
  isStale: WritableSignal<boolean>;
  isLoading: WritableSignal<boolean>;
}

@Injectable({
  providedIn: 'root'
})
export class OpenMeteoRefreshService {
  private readonly placeService = inject(PlaceService);
  private readonly weatherService = inject(WeatherService);
  private readonly airQualityService = inject(AirQualityService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly userService = inject(UserService);

  private readonly weatherStates = new Map<string, DatasetStateInternal<Weather>>();
  private readonly airQualityStates = new Map<string, DatasetStateInternal<AirQualityData>>();
  private readonly weatherRequests = new Set<string>();
  private readonly airQualityRequests = new Set<string>();

  getWeatherState(place: Place): DatasetState<Weather> {
    const state = this.ensureWeatherState(place.id);
    this.syncWeatherFromPlace(place, state);
    return this.toReadonly(state);
  }

  refreshWeather(place: Place, force = false): void {
    const state = this.ensureWeatherState(place.id);
    this.syncWeatherFromPlace(place, state);

    const dataset = place.datasets.weatherDataset;
    const isExpired = this.placeService.isDatasetExpired(dataset);
    state.isStale.set(!!dataset?.data && isExpired);

    if (!force && dataset?.data && !isExpired) {
      state.isLoading.set(false);
      return;
    }

    if (this.weatherRequests.has(place.id)) return;
    if (!place.boundingBox) return;

    const location = this.geolocationService.getCenterOfBoundingBox(place.boundingBox);
    this.weatherRequests.add(place.id);
    state.isLoading.set(true);

    this.weatherService
      .getWeather(
        this.userService.getUser().language?.slice(0, 2) || 'de',
        location.plusCode,
        location.latitude,
        location.longitude,
        3
      )
      .subscribe({
        next: (weather) => {
          if (!weather) {
            this.useCachedWeatherAsStale(place, state);
            return;
          }
          const updatedPlace: Place = {
            ...place,
            datasets: {
              ...place.datasets,
              weatherDataset: {
                ...place.datasets.weatherDataset,
                data: weather,
                lastUpdate: DateTime.now()
              }
            }
          };
          void this.placeService.saveAdditionalPlaceInfos(updatedPlace);
          this.syncWeatherFromPlace(updatedPlace, state);
        },
        error: () => {
          this.useCachedWeatherAsStale(place, state);
          this.finishWeatherRequest(place.id, state);
        },
        complete: () => {
          this.finishWeatherRequest(place.id, state);
        }
      });
  }

  getAirQualityState(place: Place): DatasetState<AirQualityData> {
    const state = this.ensureAirQualityState(place.id);
    this.syncAirQualityFromPlace(place, state);
    return this.toReadonly(state);
  }

  refreshAirQuality(place: Place, force = false): void {
    const state = this.ensureAirQualityState(place.id);
    this.syncAirQualityFromPlace(place, state);

    const dataset = place.datasets.airQualityDataset;
    const isExpired = this.placeService.isDatasetExpired(dataset);
    state.isStale.set(!!dataset?.data && isExpired);

    if (!force && dataset?.data && !isExpired) {
      state.isLoading.set(false);
      return;
    }

    if (this.airQualityRequests.has(place.id)) return;
    if (!place.boundingBox) return;

    const location = this.geolocationService.getCenterOfBoundingBox(place.boundingBox);
    this.airQualityRequests.add(place.id);
    state.isLoading.set(true);

    this.airQualityService
      .getAirQuality(location.plusCode, location.latitude, location.longitude, 3)
      .subscribe({
        next: (airQuality) => {
          if (!airQuality) {
            this.useCachedAirQualityAsStale(place, state);
            return;
          }
          const updatedPlace: Place = {
            ...place,
            datasets: {
              ...place.datasets,
              airQualityDataset: {
                ...place.datasets.airQualityDataset,
                data: airQuality,
                lastUpdate: DateTime.now()
              }
            }
          };
          void this.placeService.saveAdditionalPlaceInfos(updatedPlace);
          this.syncAirQualityFromPlace(updatedPlace, state);
        },
        error: () => {
          this.useCachedAirQualityAsStale(place, state);
          this.finishAirQualityRequest(place.id, state);
        },
        complete: () => {
          this.finishAirQualityRequest(place.id, state);
        }
      });
  }

  private useCachedWeatherAsStale(place: Place, state: DatasetStateInternal<Weather>): void {
    const cached = place.datasets.weatherDataset.data;
    if (cached) {
      state.data.set(cached);
    } else {
      state.data.set(undefined);
    }
    state.isStale.set(true);
  }

  private useCachedAirQualityAsStale(place: Place, state: DatasetStateInternal<AirQualityData>): void {
    const cached = place.datasets.airQualityDataset.data;
    if (cached) {
      state.data.set(cached);
    } else {
      state.data.set(undefined);
    }
    state.isStale.set(true);
  }

  private finishWeatherRequest(placeId: string, state: DatasetStateInternal<Weather>): void {
    this.weatherRequests.delete(placeId);
    state.isLoading.set(false);
  }

  private finishAirQualityRequest(placeId: string, state: DatasetStateInternal<AirQualityData>): void {
    this.airQualityRequests.delete(placeId);
    state.isLoading.set(false);
  }

  private syncWeatherFromPlace(place: Place, state: DatasetStateInternal<Weather>): void {
    const dataset = place.datasets.weatherDataset;
    state.data.set(dataset.data);
    state.isStale.set(!!dataset.data && this.placeService.isDatasetExpired(dataset));
  }

  private syncAirQualityFromPlace(place: Place, state: DatasetStateInternal<AirQualityData>): void {
    const dataset = place.datasets.airQualityDataset;
    state.data.set(dataset.data);
    state.isStale.set(!!dataset.data && this.placeService.isDatasetExpired(dataset));
  }

  private ensureWeatherState(placeId: string): DatasetStateInternal<Weather> {
    const existing = this.weatherStates.get(placeId);
    if (existing) return existing;
    const created = this.createState<Weather>();
    this.weatherStates.set(placeId, created);
    return created;
  }

  private ensureAirQualityState(placeId: string): DatasetStateInternal<AirQualityData> {
    const existing = this.airQualityStates.get(placeId);
    if (existing) return existing;
    const created = this.createState<AirQualityData>();
    this.airQualityStates.set(placeId, created);
    return created;
  }

  private createState<T>(): DatasetStateInternal<T> {
    return {
      data: signal<T | undefined>(undefined),
      isStale: signal(false),
      isLoading: signal(false)
    };
  }

  private toReadonly<T>(state: DatasetStateInternal<T>): DatasetState<T> {
    return {
      data: state.data.asReadonly(),
      isStale: state.isStale.asReadonly(),
      isLoading: state.isLoading.asReadonly()
    };
  }
}
