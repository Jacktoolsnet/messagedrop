import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { GetGeoStatisticResponse } from '../interfaces/get-geo-statistic-response';
import { NetworkService } from './network.service';
import { TranslationHelperService } from './translation-helper.service';

@Injectable({
  providedIn: 'root'
})
export class GeoStatisticService {
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
    // Return an observable with a user-facing error message.
    return throwError(() => error);
  }

  getDataForLocation(pluscode: string, latitude: number, longitude: number, years: number, showAlways = true): Observable<GetGeoStatisticResponse> {
    const url = `${environment.apiUrl}/geostatistic/${pluscode}/${latitude}/${longitude}/${years}`;
    this.networkService.setNetworkMessageConfig(url, {
      showAlways: showAlways,
      title: this.i18n.t('common.geoStatistic.title'),
      image: '',
      icon: '',
      message: this.i18n.t('common.geoStatistic.loading'),
      button: '',
      delay: 0,
      showSpinner: true
    });

    return this.http.get<GetGeoStatisticResponse>(url, this.httpOptions)
      .pipe(
        catchError(this.handleError)
      );
  }
}
