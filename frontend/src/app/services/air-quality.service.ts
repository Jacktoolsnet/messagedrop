import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AirQualityData } from '../interfaces/air-quality-data';
import { NetworkService } from './network.service';

@Injectable({
  providedIn: 'root'
})
export class AirQualityService {
  httpOptions = {
    headers: new HttpHeaders({
      'Content-Type': 'application/json',
      'X-API-Authorization': `${environment.apiToken}`,
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

  getAirQuality(pluscode: string, latitude: number, longitude: number, days: number, showAlways: boolean = true): Observable<AirQualityData> {
    const url = `${environment.apiUrl}/airquality/${pluscode}/${latitude}/${longitude}/${days}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: 'Air Quality Service',
      image: '',
      icon: 'eco',
      message: 'Fetching air quality data...',
      button: '',
      delay: 0,
      showSpinner: true
    });

    return this.http.get<{ status: number, data: AirQualityData }>(url, this.httpOptions)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }
}