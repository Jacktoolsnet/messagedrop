
import { Component, Input, OnInit, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DateTime } from 'luxon';
import { BoundingBox } from '../../../interfaces/bounding-box';
import { Location } from '../../../interfaces/location';
import { Place } from '../../../interfaces/place';
import { Weather } from '../../../interfaces/weather';
import { GeolocationService } from '../../../services/geolocation.service';
import { PlaceService } from '../../../services/place.service';
import { UserService } from '../../../services/user.service';
import { WeatherService } from '../../../services/weather.service';
import { WeatherComponent } from '../../weather/weather.component';
import { getWeatherLevelInfo } from '../../../utils/weather-level.util';

@Component({
  selector: 'app-weather-tile',
  imports: [],
  templateUrl: './weather-tile.component.html',
  styleUrl: './weather-tile.component.css'
})
export class WeatherTileComponent implements OnInit {
  @Input() place!: Place;

  weather: Weather | undefined;
  weatherIcon: string | undefined;
  minMax: { min: number, max: number } | undefined;
  isStale = false;
  tempColor: string | undefined;

  private readonly userService = inject(UserService);
  private readonly placeService = inject(PlaceService);
  private readonly weatherService = inject(WeatherService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly dialog = inject(MatDialog);

  ngOnInit(): void {
    if (this.place.datasets.weatherDataset.data) {
      if (this.placeService.isDatasetExpired(this.place.datasets.weatherDataset)) {
        // show cached while trying refresh
        this.weather = this.place.datasets.weatherDataset.data;
        this.weatherIcon = this.getWeatherIcon(this.weather?.current.weatherCode);
        this.minMax = this.getHourlyMinMax('temperature');
        this.setTempColor();
        this.isStale = true;
        this.getWeather();
      } else {
        this.weather = this.place.datasets.weatherDataset.data;
        this.weatherIcon = this.getWeatherIcon(this.weather?.current.weatherCode);
        this.minMax = this.getHourlyMinMax('temperature');
        this.setTempColor();
        this.isStale = false;
      }
    } else {
      this.getWeather();
    }
  }

  private getWeather() {
    const boundingBox: BoundingBox | undefined = this.place.boundingBox;
    if (boundingBox) {
      const location: Location = this.geolocationService.getCenterOfBoundingBox(boundingBox);
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
            if (weather) {
              this.place.datasets.weatherDataset.data = weather;
              this.place.datasets.weatherDataset.lastUpdate = DateTime.now();
              this.weather = weather;
              this.weatherIcon = this.getWeatherIcon(this.weather?.current.weatherCode);
              this.minMax = this.getHourlyMinMax('temperature');
              this.setTempColor();
              this.isStale = false;
            } else {
              this.useCachedAsStale();
            }
          },
          error: () => {
            this.useCachedAsStale();
          }
        });
    }
  }

  private useCachedAsStale(): void {
    if (this.place.datasets.weatherDataset.data) {
      this.weather = this.place.datasets.weatherDataset.data;
      this.weatherIcon = this.getWeatherIcon(this.weather?.current.weatherCode);
      this.minMax = this.getHourlyMinMax('temperature');
      this.setTempColor();
      this.isStale = true;
    } else {
      this.weather = undefined;
      this.weatherIcon = undefined;
      this.minMax = undefined;
      this.isStale = true;
    }
  }

  private setTempColor(): void {
    const temp = this.weather?.current?.temperature ?? 0;
    const isDarkMode = document.body.classList.contains('dark');
    this.tempColor = getWeatherLevelInfo('temperature', temp, isDarkMode).color;
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
    const boundingBox: BoundingBox | undefined = this.place.boundingBox;
    this.dialog.open(WeatherComponent, {
      data: { weather: this.weather, location: this.geolocationService.getCenterOfBoundingBox(boundingBox!) },
      closeOnNavigation: true,
      minWidth: '90vw',
      width: '90vw',
      maxWidth: '90vw',
      minHeight: '90vh',
      height: '90vh',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });
  }

  getHourlyMinMax(field: 'temperature' | 'precipitationProbability' | 'precipitation' | 'wind' | 'pressure' | 'uvIndex'): { min: number, max: number } {
    if (
      !this.weather ||
      !this.weather.hourly ||
      !this.weather.current?.time
    ) {
      return { min: 0, max: 0 };
    }
    const currentDate = this.weather.current.time.split('T')[0];

    const values = this.weather.hourly
      .filter(h => h.time.startsWith(currentDate))
      .map(h => h[field])
      .filter(v => typeof v === 'number');

    if (values.length === 0) return { min: 0, max: 0 };

    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }
}
