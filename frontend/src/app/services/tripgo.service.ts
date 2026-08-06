import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Location } from '../interfaces/location';
import {
  TripGoLiveServiceDetails,
  TripGoRouteSegment,
  TripGoRoutingResult,
  TripGoRoutesResponse,
  TripGoServiceDetailsResponse
} from '../interfaces/tripgo';

@Injectable({ providedIn: 'root' })
export class TripGoService {
  private readonly http = inject(HttpClient);

  calculatePublicTransportRoute(from: Location, to: Location, locale: string): Observable<TripGoRoutingResult> {
    return this.http.post<TripGoRoutesResponse>(`${environment.apiUrl}/tripgo/routes`, {
      from: { latitude: from.latitude, longitude: from.longitude },
      to: { latitude: to.latitude, longitude: to.longitude },
      locale,
      modes: ['pt_pub']
    }, {
      // Routing failures are rendered directly inside the route dialog. Avoid a
      // second, global display-message dialog for the same expected result.
      headers: { 'x-skip-ui': 'true' }
    }).pipe(map((response) => response.data));
  }

  getServiceDetails(segment: TripGoRouteSegment, locale: string): Observable<TripGoLiveServiceDetails> {
    return this.http.post<TripGoServiceDetailsResponse>(`${environment.apiUrl}/tripgo/service`, {
      region: segment.from?.region,
      serviceTripId: segment.service?.tripId,
      operator: segment.service?.operatorId,
      startStopCode: segment.from?.stopCode,
      endStopCode: segment.to?.stopCode,
      embarkationTime: segment.startTime,
      locale
    }, {
      // A missing live service is an expected provider-specific result and is
      // presented inside the detail dialog instead of as a global error dialog.
      headers: { 'x-skip-ui': 'true' }
    }).pipe(map((response) => response.data));
  }
}
