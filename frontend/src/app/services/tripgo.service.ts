import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';
import { Location } from '../interfaces/location';
import { TripGoRoutingResult, TripGoRoutesResponse } from '../interfaces/tripgo';

@Injectable({ providedIn: 'root' })
export class TripGoService {
  private readonly http = inject(HttpClient);

  calculatePublicTransportRoute(from: Location, to: Location, locale: string): Observable<TripGoRoutingResult> {
    return this.http.post<TripGoRoutesResponse>(`${environment.apiUrl}/tripgo/routes`, {
      from: { latitude: from.latitude, longitude: from.longitude },
      to: { latitude: to.latitude, longitude: to.longitude },
      locale,
      modes: ['pt_pub']
    }).pipe(map((response) => response.data));
  }
}
