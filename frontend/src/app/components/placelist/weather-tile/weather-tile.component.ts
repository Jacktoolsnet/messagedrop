import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { BoundingBox } from '../../../interfaces/bounding-box';
import { Location } from '../../../interfaces/location';
import { Place } from '../../../interfaces/place';
import { Weather } from '../../../interfaces/weather';
import { GeolocationService } from '../../../services/geolocation.service';
import { UserService } from '../../../services/user.service';
import { WeatherService } from '../../../services/weather.service';
import { WeatherComponent } from '../../weather/weather.component';

@Component({
  selector: 'app-weather-tile',
  imports: [
    CommonModule
  ],
  templateUrl: './weather-tile.component.html',
  styleUrl: './weather-tile.component.css'
})
export class WeatherTileComponent implements OnInit, OnDestroy {
  @Input() place!: Place;

  weather: Weather | undefined;
  weatherIcon: string | undefined;
  minMax: { min: number, max: number } | undefined;

  public constructor(
    private userService: UserService,
    private weatherService: WeatherService,
    private geolocationService: GeolocationService,
    private dialog: MatDialog,
  ) { }

  ngOnInit(): void {
    this.getWeather();
  }

  ngOnDestroy(): void { }

  private getWeather() {
    let boundingBox: BoundingBox | undefined = this.geolocationService.getBoundingBoxFromPlusCodes(this.place.plusCodes);
    if (boundingBox) {
      let location: Location = this.geolocationService.getCenterOfBoundingBox(boundingBox)
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
            this.weather = weather;
            this.weatherIcon = this.getWeatherIcon(this.weather?.current.weatherCode);
            this.minMax = this.getHourlyMinMax('temperature');
          },
          error: (err) => { }
        });
    }
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
    let boundingBox: BoundingBox | undefined = this.geolocationService.getBoundingBoxFromPlusCodes(this.place.plusCodes);
    const dialogRef = this.dialog.open(WeatherComponent, {
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

    dialogRef.afterOpened().subscribe(e => {
    });

    dialogRef.afterClosed().subscribe();
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
