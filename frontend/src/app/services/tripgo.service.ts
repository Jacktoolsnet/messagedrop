import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, retry, throwError, timer } from 'rxjs';
import { environment } from '../../environments/environment';
import { Location } from '../interfaces/location';
import {
  TripGoLiveServiceDetails,
  TripGoDeparture,
  TripGoDeparturesResponse,
  TripGoRouteSegment,
  TripGoRoutingResult,
  TripGoRoutesResponse,
  TripGoServiceDetailsResponse,
  TripGoStop,
  TripGoStopsResponse
} from '../interfaces/tripgo';
import { BoundingBox } from '../interfaces/bounding-box';

@Injectable({ providedIn: 'root' })
export class TripGoService {
  private readonly http = inject(HttpClient);

  calculateRoute(
    from: Location,
    to: Location,
    locale: string,
    modes: string[]
  ): Observable<TripGoRoutingResult> {
    return this.http.post<TripGoRoutesResponse>(`${environment.apiUrl}/tripgo/routes`, {
      from: { latitude: from.latitude, longitude: from.longitude },
      to: { latitude: to.latitude, longitude: to.longitude },
      locale,
      modes
    }, {
      // Routing failures are rendered directly inside the route dialog. Avoid a
      // second, global display-message dialog for the same expected result.
      headers: { 'x-skip-ui': 'true' }
    }).pipe(
      retry({
        count: 1,
        delay: (error: unknown) => this.isTransientRoutingError(error)
          ? timer(1_000)
          : throwError(() => error)
      }),
      map((response) => response.data)
    );
  }

  calculatePublicTransportRoute(from: Location, to: Location, locale: string): Observable<TripGoRoutingResult> {
    return this.calculateRoute(from, to, locale, ['pt_pub']);
  }

  getStops(bounds: BoundingBox[], locale: string): Observable<TripGoStop[]> {
    return this.http.post<TripGoStopsResponse>(`${environment.apiUrl}/tripgo/locations`, {
      bounds,
      locale
    }, {
      // Map-search errors should not open the global display-message dialog.
      // The layer simply stays empty and retries after the next map movement.
      headers: { 'x-skip-ui': 'true' }
    }).pipe(map((response) => response.data.stops));
  }

  getDepartures(stop: TripGoStop, locale: string, limit = 40): Observable<TripGoDeparture[]> {
    const stopCodes = [...new Set(stop.platforms.map((platform) => platform.stopCode).filter(Boolean))];
    return this.http.post<TripGoDeparturesResponse>(`${environment.apiUrl}/tripgo/departures`, {
      region: stop.region,
      stopCodes,
      locale,
      limit
    }, {
      // Departure availability differs by provider. Errors are presented inside
      // the stop dialog and must not open an additional global message dialog.
      headers: { 'x-skip-ui': 'true' }
    }).pipe(map((response) => response.data.departures));
  }

  private isTransientRoutingError(error: unknown): boolean {
    return error instanceof HttpErrorResponse
      && [429, 502, 503, 504].includes(error.status);
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
