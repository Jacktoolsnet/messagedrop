import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { catchError, forkJoin, map, of } from 'rxjs';
import { GetNominatimAddressResponse } from '../../interfaces/get-nominatim-address-response copy';
import { Location } from '../../interfaces/location';
import { NominatimPlace } from '../../interfaces/nominatim-place';
import { TripGoRouteOption, TripGoRouteSegment } from '../../interfaces/tripgo';
import { GeolocationService } from '../../services/geolocation.service';
import { NominatimService } from '../../services/nominatim.service';
import { TripGoService } from '../../services/tripgo.service';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { LocationPickerDialogComponent } from '../utils/location-picker-dialog/location-picker-dialog.component';
import { TripGoRouteMapComponent, TripGoSimulationState } from './tripgo-route-map.component';
import { TripGoRouteMapPointSelection } from './tripgo-route-map.component';
import { TripGoRoutePointDialogComponent } from './tripgo-route-point-dialog.component';
import {
  tripGoDisplayLocationName,
  tripGoFollowingBoardingPlatform,
  tripGoServiceLabel,
  tripGoSegmentIcon,
  tripGoSegmentInstructionLocation
} from './tripgo-route.util';
import { TripGoTimelineWeatherComponent } from './tripgo-timeline-weather.component';

export interface TripGoRouteDialogData {
  destination: Location;
}

type RouteDialogState = 'locating' | 'routing' | 'ready' | 'arrived' | 'error';
type RoutePointKind = 'origin' | 'destination';
type TimelineLiveState = 'unavailable' | 'on-time' | 'delayed' | 'missed';

interface TimelineLiveIndicator {
  state: TimelineLiveState;
  time?: string;
}

const DESTINATION_REACHED_RADIUS_METERS = 50;

interface RoutePointDetails {
  name: string;
  address: string;
}

@Component({
  selector: 'app-tripgo-route-dialog',
  imports: [
    DialogHeaderComponent,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
    TripGoRouteMapComponent,
    TripGoTimelineWeatherComponent
  ],
  templateUrl: './tripgo-route-dialog.component.html',
  styleUrl: './tripgo-route-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TripGoRouteDialogComponent implements OnInit {
  @ViewChild(TripGoRouteMapComponent) private routeMap?: TripGoRouteMapComponent;
  private readonly data = inject<TripGoRouteDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<TripGoRouteDialogComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly geolocation = inject(GeolocationService);
  private readonly nominatim = inject(NominatimService);
  private readonly tripGo = inject(TripGoService);
  private readonly transloco = inject(TranslocoService);
  readonly help = inject(HelpDialogService);

  readonly origin = signal<Location | null>(null);
  readonly destination = signal(this.withPlusCode(this.data.destination));
  readonly originDetails = signal<RoutePointDetails | null>(null);
  readonly destinationDetails = signal<RoutePointDetails | null>(null);
  readonly viewMode = signal<'list' | 'map'>('list');
  readonly selectedRoute = signal<TripGoRouteOption | null>(null);
  readonly simulationState = signal<TripGoSimulationState>('idle');
  readonly state = signal<RouteDialogState>('locating');
  readonly routes = signal<TripGoRouteOption[]>([]);
  readonly errorKey = signal('common.tripGo.errors.route');
  readonly isBusy = computed(() => this.state() === 'locating' || this.state() === 'routing');

  ngOnInit(): void {
    this.resolveRoutePoint('destination', this.destination());
    this.calculateWithFreshLocation();
  }

  calculateWithFreshLocation(): void {
    this.showList();
    this.routes.set([]);
    this.state.set('locating');
    this.geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20_000
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (position) => {
        const origin: Location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          plusCode: this.geolocation.getPlusCode(position.coords.latitude, position.coords.longitude)
        };
        this.origin.set(origin);
        this.resolveRoutePoint('origin', origin);
        this.loadRoutes(origin, this.destination());
      },
      error: (error: GeolocationPositionError | unknown) => {
        const code = typeof error === 'object' && error !== null && 'code' in error ? Number(error.code) : 0;
        this.errorKey.set(code === 1
          ? 'common.tripGo.errors.locationPermission'
          : 'common.tripGo.errors.location');
        this.state.set('error');
      }
    });
  }

  close(): void {
    this.routeMap?.stopSimulation();
    this.dialogRef.close();
  }

  showRouteOnMap(route: TripGoRouteOption): void {
    this.selectedRoute.set(route);
    this.viewMode.set('map');
  }

  activateRoutePoint(event: Event, kind: RoutePointKind): void {
    if (this.isNestedInteractiveElement(event)) return;
    if (event instanceof KeyboardEvent) event.preventDefault();
    this.editRoutePoint(kind);
  }

  activateRouteCard(event: Event, route: TripGoRouteOption): void {
    if (this.isNestedInteractiveElement(event)) return;
    if (event instanceof KeyboardEvent) event.preventDefault();
    this.showRouteOnMap(route);
  }

  showList(): void {
    this.routeMap?.stopSimulation();
    this.simulationState.set('idle');
    this.viewMode.set('list');
    this.selectedRoute.set(null);
  }

  toggleSimulation(): void {
    if (this.simulationState() === 'playing') {
      this.routeMap?.pauseSimulation();
    } else if (this.simulationState() === 'paused') {
      this.routeMap?.resumeSimulation();
    } else {
      this.routeMap?.startSimulation();
    }
  }

  previousSimulationPoint(): void {
    this.routeMap?.showPreviousSimulationPoint();
  }

  nextSimulationPoint(): void {
    this.routeMap?.showNextSimulationPoint();
  }

  stopSimulation(): void {
    this.routeMap?.stopSimulation();
  }

  showRoutePointDetails(selection: TripGoRouteMapPointSelection): void {
    const route = this.selectedRoute();
    if (!route) return;
    this.routeMap?.pauseSimulation();
    this.dialog.open(TripGoRoutePointDialogComponent, {
      data: { ...selection, route },
      width: '95vw',
      height: '95vh',
      maxWidth: '95vw',
      maxHeight: '95vh',
      autoFocus: false,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false
    });
  }

  editRoutePoint(kind: RoutePointKind): void {
    const current = kind === 'origin' ? this.origin() : this.destination();
    if (!current || this.isBusy()) return;

    const dialogRef = this.dialog.open<LocationPickerDialogComponent, unknown, Location | undefined>(
      LocationPickerDialogComponent,
      {
        data: { location: current, markerType: 'message', zoom: 16 },
        maxWidth: '95vw',
        maxHeight: '95vh',
        width: '95vw',
        height: '95vh',
        autoFocus: false,
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        disableClose: false
      }
    );

    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((selected) => {
      if (!selected) return;
      const location = this.withPlusCode(selected);
      if (kind === 'origin') {
        this.origin.set(location);
        this.originDetails.set(null);
      } else {
        this.destination.set(location);
        this.destinationDetails.set(null);
      }
      this.showList();
      this.resolveRoutePoint(kind, location);
      const origin = this.origin();
      if (origin) this.loadRoutes(origin, this.destination());
    });
  }

  formatTime(value: string): string {
    return new Intl.DateTimeFormat(this.transloco.getActiveLang() || 'de', {
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(value));
  }

  formatDuration(seconds: number): string {
    const minutes = Math.max(1, Math.round(seconds / 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return hours > 0 ? `${hours} h ${remainingMinutes} min` : `${minutes} min`;
  }

  formatDistance(metres: number): string {
    const locale = this.transloco.getActiveLang() || 'de';
    if (metres >= 1000) {
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(metres / 1000)} km`;
    }
    return `${Math.round(metres)} m`;
  }

  segmentTimelineLabel(route: TripGoRouteOption, segment: TripGoRouteSegment, segmentIndex: number): string {
    if (segment.type === 'scheduled') {
      const service = tripGoServiceLabel(segment) || segment.modeIdentifier || '';
      return segment.service?.direction
        ? `${service} ${this.transloco.translate('common.tripGo.direction', { direction: segment.service.direction })}`
        : service;
    }
    const label = segment.type === 'stationary'
      ? this.transloco.translate('common.tripGo.waitingTime')
      : segment.modeLabel || segment.modeIdentifier || '';
    const location = tripGoSegmentInstructionLocation(route, segmentIndex);
    if (segment.type === 'stationary') {
      return location
        ? this.transloco.translate('common.tripGo.waitingAt', { mode: label, location })
        : label;
    }
    return label;
  }

  segmentPlatform(segment: TripGoRouteSegment): string | undefined {
    return segment.service?.startPlatform;
  }

  segmentDestinationPlatform(
    route: TripGoRouteOption,
    segment: TripGoRouteSegment,
    segmentIndex: number
  ): string | undefined {
    if (segment.type === 'scheduled') return segment.service?.endPlatform;
    return tripGoSegmentIcon(segment) === 'directions_walk'
      ? tripGoFollowingBoardingPlatform(route, segmentIndex)
      : undefined;
  }

  segmentStartLocation(segment: TripGoRouteSegment): string | undefined {
    return tripGoDisplayLocationName(segment.from?.name);
  }

  segmentDestination(segment: TripGoRouteSegment): string | undefined {
    if (segment.type === 'stationary') return undefined;
    return tripGoDisplayLocationName(segment.to?.name);
  }

  intermediateStopCount(segment: TripGoRouteSegment): number {
    const detailedStops = segment.service?.intermediateStops;
    return detailedStops
      ? detailedStops.length
      : Math.max(0, (segment.service?.stops || 0) - 1);
  }

  isLatestRoute(route: TripGoRouteOption): boolean {
    return this.routes()[0]?.id === route.id;
  }

  timelineLiveIndicator(
    route: TripGoRouteOption,
    segmentIndex: number,
    useArrival = false
  ): TimelineLiveIndicator {
    const segment = route.segments[segmentIndex];
    if (!segment) return { state: 'unavailable' };
    const inheritedState = this.timelineConnectionStateBefore(route, segmentIndex);
    const live = segment.liveDetails;
    const hasLiveData = live?.realTime === true || segment.service?.realTime === true;
    const time = useArrival
      ? live?.arrivalTime || (hasLiveData ? segment.endTime : undefined)
      : live?.departureTime || (hasLiveData ? segment.startTime : undefined);
    if (inheritedState === 'missed') return { state: 'missed', time };
    if (!hasLiveData) return { state: 'unavailable' };

    const scheduledTime = useArrival
      ? live?.scheduledArrivalTime || segment.scheduledEndTime
      : live?.scheduledDepartureTime || segment.scheduledStartTime;
    const delaySeconds = !useArrival && live?.delaySeconds !== undefined
      ? live.delaySeconds
      : time && scheduledTime
        ? Math.round((Date.parse(time) - Date.parse(scheduledTime)) / 1000)
        : 0;
    if (delaySeconds > 30) return { state: 'delayed', time };
    return { state: 'on-time', time };
  }

  timelineLineState(route: TripGoRouteOption, segmentIndex: number): 'normal' | 'tight' | 'missed' {
    let tight = false;
    for (let index = 0; index < segmentIndex; index += 1) {
      const state = this.connectionStateAfter(route, index);
      if (state === 'missed') return 'missed';
      if (state === 'tight') tight = true;
    }
    return tight ? 'tight' : 'normal';
  }

  formatLiveIndicatorTime(indicator: TimelineLiveIndicator): string {
    return indicator.time ? this.formatTime(indicator.time) : '--:--';
  }

  timelineLiveAriaLabel(indicator: TimelineLiveIndicator): string {
    const key = indicator.state === 'unavailable'
      ? 'common.tripGo.timelineLive.unavailable'
      : indicator.state === 'on-time'
        ? 'common.tripGo.timelineLive.onTime'
        : indicator.state === 'delayed'
          ? 'common.tripGo.timelineLive.delayed'
          : 'common.tripGo.timelineLive.connectionMissed';
    return this.transloco.translate(key, { time: this.formatLiveIndicatorTime(indicator) });
  }

  segmentIcon(segment: TripGoRouteSegment): string {
    return tripGoSegmentIcon(segment);
  }

  private loadRoutes(origin: Location, destination: Location): void {
    this.routes.set([]);
    if (this.distanceInMeters(origin, destination) <= DESTINATION_REACHED_RADIUS_METERS) {
      this.state.set('arrived');
      return;
    }
    this.state.set('routing');
    this.tripGo.calculatePublicTransportRoute(
      origin,
      destination,
      this.transloco.getActiveLang() || 'de'
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.routes.set(result.routes);
        this.state.set('ready');
        this.loadServiceDetails(result.routes);
      },
      error: () => {
        this.errorKey.set('common.tripGo.errors.route');
        this.state.set('error');
      }
    });
  }

  private loadServiceDetails(routes: TripGoRouteOption[]): void {
    const latestRouteId = routes[0]?.id;
    const requests = routes.flatMap((route) => route.segments
      .filter((segment) => segment.type === 'scheduled' && segment.service?.tripId)
      .map((segment) => this.tripGo.getServiceDetails(
        segment,
        this.transloco.getActiveLang() || 'de',
        route.id === latestRouteId
      ).pipe(
        map((details) => ({ routeId: route.id, segmentId: segment.id, details })),
        catchError(() => of(null))
      )));
    if (requests.length === 0) return;

    forkJoin(requests).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((results) => {
      const detailsBySegment = new Map(results
        .filter((result) => result !== null)
        .map((result) => [`${result.routeId}:${result.segmentId}`, result.details]));
      if (detailsBySegment.size === 0) return;

      const currentRouteIds = new Set(this.routes().map((route) => route.id));
      if (!routes.some((route) => currentRouteIds.has(route.id))) return;
      const enrichedRoutes = routes.map((route) => ({
        ...route,
        segments: route.segments.map((segment) => {
          const details = detailsBySegment.get(`${route.id}:${segment.id}`);
          if (!details || !segment.service) return segment;
          const liveStops = new Map((segment.service.realTimeStops || [])
            .map((stop) => [stop.stopCode, stop]));
          const stops = (details.stops || []).map((stop) => ({
            ...stop,
            ...(stop.stopCode ? liveStops.get(stop.stopCode) : undefined)
          }));
          return {
            ...segment,
            liveDetails: route.id === latestRouteId ? details : undefined,
            detailedGeometry: details.geometry || [],
            service: {
              ...segment.service,
              intermediateStops: stops.length > 2 ? stops.slice(1, -1) : []
            }
          };
        })
      }));
      this.routes.set(enrichedRoutes);
      const selectedRouteId = this.selectedRoute()?.id;
      if (selectedRouteId) {
        this.selectedRoute.set(enrichedRoutes.find((route) => route.id === selectedRouteId) || null);
      }
    });
  }

  private timelineConnectionStateBefore(
    route: TripGoRouteOption,
    segmentIndex: number
  ): 'tight' | 'missed' | null {
    let tight = false;
    for (let index = 0; index < segmentIndex; index += 1) {
      const state = this.connectionStateAfter(route, index);
      if (state === 'missed') return 'missed';
      if (state === 'tight') tight = true;
    }
    return tight ? 'tight' : null;
  }

  private connectionStateAfter(
    route: TripGoRouteOption,
    segmentIndex: number
  ): 'tight' | 'missed' | null {
    const segment = route.segments[segmentIndex];
    if (segment?.type !== 'scheduled') return null;
    const nextIndex = route.segments.findIndex((candidate, index) => index > segmentIndex
      && candidate.type === 'scheduled');
    if (nextIndex < 0) return null;
    const nextSegment = route.segments[nextIndex];
    const currentLive = segment.liveDetails;
    const nextLive = nextSegment.liveDetails;
    const hasPrediction = currentLive?.realTime === true
      || segment.service?.realTime === true
      || nextLive?.realTime === true
      || nextSegment.service?.realTime === true;
    if (!hasPrediction) return null;
    if (currentLive?.cancelled || nextLive?.cancelled) return 'missed';

    const arrival = currentLive?.arrivalTime || segment.endTime;
    const departure = nextLive?.departureTime || nextSegment.startTime;
    if (!arrival || !departure) return null;
    const transferSeconds = route.segments
      .slice(segmentIndex + 1, nextIndex)
      .filter((candidate) => candidate.type !== 'stationary')
      .reduce((total, candidate) => total + (candidate.durationSeconds || 0), 0);
    const marginSeconds = (Date.parse(departure) - Date.parse(arrival)) / 1000 - transferSeconds;
    if (!Number.isFinite(marginSeconds)) return null;
    if (marginSeconds < 0) return 'missed';
    return marginSeconds < 300 ? 'tight' : null;
  }

  private distanceInMeters(first: Location, second: Location): number {
    const earthRadiusMeters = 6_371_000;
    const toRadians = (degrees: number) => degrees * Math.PI / 180;
    const latitudeDelta = toRadians(second.latitude - first.latitude);
    const longitudeDelta = toRadians(second.longitude - first.longitude);
    const firstLatitude = toRadians(first.latitude);
    const secondLatitude = toRadians(second.latitude);
    const haversine = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
    return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
  }

  private resolveRoutePoint(kind: RoutePointKind, location: Location): void {
    this.nominatim.getNominatimPlaceByLocation(location).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => this.applyRoutePointDetails(kind, location, response),
      error: () => this.setFallbackRoutePointDetails(kind, location)
    });
  }

  private applyRoutePointDetails(
    kind: RoutePointKind,
    requestedLocation: Location,
    response: GetNominatimAddressResponse
  ): void {
    if (!this.isCurrentRoutePoint(kind, requestedLocation)) return;
    const place = response.nominatimPlace;
    if (response.status !== 200 || !place || place.error) {
      this.setFallbackRoutePointDetails(kind, requestedLocation);
      return;
    }
    const address = this.nominatim.getFormattedAddress(place, ', ');
    const details: RoutePointDetails = {
      name: this.routePointName(place, requestedLocation),
      address
    };
    this.routePointDetailsSignal(kind).set(details);
  }

  private routePointName(place: NominatimPlace, fallback: Location): string {
    const address = place.address;
    const locality = address?.city || address?.town || address?.village || address?.hamlet;
    return place.name?.trim()
      || this.nominatim.getFormattedStreet(place, ' ').trim()
      || locality?.trim()
      || place.display_name?.split(',')[0]?.trim()
      || fallback.plusCode;
  }

  private setFallbackRoutePointDetails(kind: RoutePointKind, location: Location): void {
    if (!this.isCurrentRoutePoint(kind, location)) return;
    this.routePointDetailsSignal(kind).set({ name: location.plusCode, address: '' });
  }

  private routePointDetailsSignal(kind: RoutePointKind) {
    return kind === 'origin' ? this.originDetails : this.destinationDetails;
  }

  private isCurrentRoutePoint(kind: RoutePointKind, requested: Location): boolean {
    const current = kind === 'origin' ? this.origin() : this.destination();
    return current?.latitude === requested.latitude && current.longitude === requested.longitude;
  }

  private withPlusCode(location: Location): Location {
    return {
      ...location,
      plusCode: location.plusCode?.trim()
        || this.geolocation.getPlusCode(location.latitude, location.longitude)
    };
  }

  private isNestedInteractiveElement(event: Event): boolean {
    const target = event.target;
    const currentTarget = event.currentTarget;
    return target instanceof Element
      && target !== currentTarget
      && target.closest('button, a, input, select, textarea') !== null;
  }
}
