import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Weather } from '../interfaces/weather';
import { NetworkService } from './network.service';

@Injectable({
  providedIn: 'root'
})
export class WeatherService {
  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${environment.apiToken}`,
      withCredentials: 'true'
    })
  };

  constructor(
    private http: HttpClient,
    private networkService: NetworkService
  ) { }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  getWeather(locale: string, pluscode: string, latitude: number, longitude: number, days: number, showAlways: boolean = false): Observable<Weather> {
    const url = `${environment.apiUrl}/weather/${locale}/${pluscode}/${latitude}/${longitude}/${days}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Weather service',
      image: '',
      icon: '',
      message: 'Fetching weather data',
      button: '',
      delay: 0,
      showSpinner: true
    });

    return this.http.get<{ status: number, data: any }>(url, this.httpOptions)
      .pipe(
        map((res) => this.mapToWeather(res.data)),
        catchError(this.handleError)
      );
  }

  private mapToWeather(data: any): Weather {
    return {
      current: {
        temperature: data.current_weather.temperature,
        windspeed: data.current_weather.windspeed,
        weatherCode: data.current_weather.weathercode,
        time: data.current_weather.time
      },
      hourly: data.hourly.time.map((t: string, i: number) => ({
        time: t,
        temperature: data.hourly.temperature_2m[i],
        precipitationProbability: data.hourly.precipitation_probability[i],
        precipitation: data.hourly.precipitation[i],
        uvIndex: data.hourly.uv_index[i],
        pressure: data.hourly.pressure_msl[i],
        wind: data.hourly.windspeed_10m[i]
      })),
      daily: data.daily.time.map((d: string, i: number) => ({
        date: d,
        sunrise: data.daily.sunrise[i],
        sunset: data.daily.sunset[i],
        temperatureMax: data.daily.temperature_2m_max[i],
        temperatureMin: data.daily.temperature_2m_min[i]
      }))
    };
  }
}
