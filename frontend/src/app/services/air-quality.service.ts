import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AirQualityData } from '../interfaces/air-quality-data';
import { NetworkService } from './network.service';
import { TranslationHelperService } from './translation-helper.service';

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

  private readonly http = inject(HttpClient);
  private readonly networkService = inject(NetworkService);
  private readonly i18n = inject(TranslationHelperService);

  private handleError(error: HttpErrorResponse) {
    return throwError(() => error);
  }

  getAirQuality(pluscode: string, latitude: number, longitude: number, days: number, showAlways = true): Observable<AirQualityData> {
    const url = `${environment.apiUrl}/airquality/${pluscode}/${latitude}/${longitude}/${days}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: this.i18n.t('weather.airQuality.serviceTitle'),
      image: '',
      icon: 'eco',
      message: this.i18n.t('weather.airQuality.loading'),
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
