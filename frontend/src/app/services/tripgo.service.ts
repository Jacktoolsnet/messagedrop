import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
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

  getServiceDetails(
    segment: TripGoRouteSegment,
    locale: string,
    includeLive = false
  ): Observable<TripGoLiveServiceDetails> {
    const request = {
      region: segment.from?.region,
      serviceTripId: segment.service?.tripId,
      operator: segment.service?.operatorId,
      startStopCode: segment.from?.stopCode,
      endStopCode: segment.to?.stopCode,
      embarkationTime: segment.scheduledStartTime || segment.startTime,
      locale
    };
    const options = {
      // A missing live service is an expected provider-specific result and is
      // presented inside the detail dialog instead of as a global error dialog.
      headers: { 'x-skip-ui': 'true' }
    };
    const scheduled$ = this.http.post<TripGoServiceDetailsResponse>(
      `${environment.apiUrl}/tripgo/service`, request, options
    ).pipe(map((response) => response.data));
    if (!includeLive || !segment.service?.operatorId) return scheduled$;

    const latest$ = this.http.post<TripGoServiceDetailsResponse>(
      `${environment.apiUrl}/tripgo/latest`, request, options
    ).pipe(
      map((response) => response.data),
      catchError(() => of(null))
    );
    return forkJoin({ scheduled: scheduled$, latest: latest$ }).pipe(
      map(({ scheduled, latest }) => this.mergeServiceDetails(segment, scheduled, latest))
    );
  }

  private mergeServiceDetails(
    segment: TripGoRouteSegment,
    scheduled: TripGoLiveServiceDetails,
    latest: TripGoLiveServiceDetails | null
  ): TripGoLiveServiceDetails {
    const routeRealTime = segment.service?.realTime === true;
    const scheduledDepartureTime = segment.scheduledStartTime
      || (!routeRealTime ? segment.startTime : scheduled.scheduledDepartureTime);
    const scheduledArrivalTime = segment.scheduledEndTime
      || (!routeRealTime ? segment.endTime : scheduled.scheduledArrivalTime);
    if (!latest) return {
      ...scheduled,
      departureTime: routeRealTime ? segment.startTime : scheduled.departureTime,
      arrivalTime: routeRealTime ? segment.endTime : scheduled.arrivalTime,
      scheduledDepartureTime,
      scheduledArrivalTime,
      realTime: scheduled.realTime === true || routeRealTime
    };
    const liveStops = new Map(latest.stops.map((stop) => [stop.stopCode, stop]));
    const mergedStops = scheduled.stops.map((stop) => ({
      ...stop,
      ...(stop.stopCode ? liveStops.get(stop.stopCode) : undefined)
    }));
    const knownCodes = new Set(mergedStops.map((stop) => stop.stopCode).filter(Boolean));
    mergedStops.push(...latest.stops.filter((stop) => !stop.stopCode || !knownCodes.has(stop.stopCode)));
    const departureTime = latest.departureTime || (routeRealTime ? segment.startTime : scheduled.departureTime);
    const arrivalTime = latest.arrivalTime || (routeRealTime ? segment.endTime : scheduled.arrivalTime);
    const delaySeconds = departureTime && scheduledDepartureTime
      ? Math.round((Date.parse(departureTime) - Date.parse(scheduledDepartureTime)) / 1000)
      : latest.delaySeconds;
    return {
      ...scheduled,
      ...latest,
      departureTime,
      arrivalTime,
      scheduledDepartureTime,
      scheduledArrivalTime,
      delaySeconds,
      realTime: latest.realTime === true || routeRealTime,
      alerts: [...new Set([...scheduled.alerts, ...latest.alerts])],
      stops: mergedStops,
      geometry: scheduled.geometry
    };
  }
}
