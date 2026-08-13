import { ChangeDetectionStrategy, Component, DestroyRef, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Subscription, catchError, concatMap, forkJoin, from, map, of, switchMap } from 'rxjs';
import { GetNominatimAddressResponse } from '../../interfaces/get-nominatim-address-response copy';
import { Location } from '../../interfaces/location';
import { MarkerLocation } from '../../interfaces/marker-location';
import { DEFAULT_ROUTE_OPTIONS, RouteOptions, normalizeRouteOptions } from '../../interfaces/route-options';
import { DEFAULT_SEARCH_SETTINGS, SearchSettings } from '../../interfaces/search-settings';
import { WikipediaArticle } from '../../interfaces/wikipedia';
import { NominatimPlace } from '../../interfaces/nominatim-place';
import { TripGoRouteCategory, TripGoRouteOption, TripGoRouteSegment, TripGoRoutingResult, TripGoStop } from '../../interfaces/tripgo';
import { GeolocationService } from '../../services/geolocation.service';
import { NominatimService } from '../../services/nominatim.service';
import { TripGoService } from '../../services/tripgo.service';
import { TripGoRoutePointDetails, TripGoRouteSessionService } from '../../services/tripgo-route-session.service';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { LocationPickerDialogComponent } from '../utils/location-picker-dialog/location-picker-dialog.component';
import { RouteOptionsComponent } from '../utils/route-options/route-options.component';
import { SearchSettingsComponent } from '../utils/search-settings/search-settings.component';
import { TripGoRouteMapComponent, TripGoSimulationState } from './tripgo-route-map.component';
import { TripGoRouteMapPointSelection } from './tripgo-route-map.component';
import { TripGoRoutePointDialogComponent } from './tripgo-route-point-dialog.component';
import { TripGoStopDialogComponent } from '../tripgo-stop-dialog/tripgo-stop-dialog.component';
import {
  tripGoDisplayLocationName,
  tripGoFollowingBoardingPlatform,
  tripGoRouteIcons,
  tripGoServiceLabel,
  tripGoSegmentIcon,
  tripGoSegmentInstructionLocation
} from './tripgo-route.util';
import { TripGoTimelineWeatherComponent } from './tripgo-timeline-weather.component';

export interface TripGoRouteDialogData {
  destination: Location;
  origin?: Location;
  calculateImmediately?: boolean;
  routeOptions?: RouteOptions;
  routeOptionsChanged?: (options: RouteOptions) => void;
  routePointsChanged?: (origin: Location, destination: Location) => void;
  searchSettings?: SearchSettings;
  searchSettingsChanged?: (settings: SearchSettings) => void;
  wikipediaArticlesSelected?: (articles: WikipediaArticle[]) => void;
  routeContentSelected?: (content: MarkerLocation) => void;
}

type RouteDialogState = 'idle' | 'locating' | 'routing' | 'ready' | 'arrived' | 'error';
type RoutePointKind = 'origin' | 'destination';
type TimelineLiveState = 'unavailable' | 'on-time' | 'delayed' | 'missed';

interface TimelineLiveIndicator {
  state: TimelineLiveState;
  time?: string;
}

interface RouteCategoryConfig {
  category: TripGoRouteCategory;
  primaryModes: string[];
  fallbackModes?: string[];
}

const CAR_CATEGORY: RouteCategoryConfig = {
  category: 'car-transit',
  primaryModes: ['me_car']
};

const FLIGHT_CATEGORY: RouteCategoryConfig = {
  category: 'flight',
  primaryModes: ['in_air', 'pt_pub']
};

const DESTINATION_REACHED_RADIUS_METERS = 50;
const MAX_ROUTE_ENDPOINT_SNAP_METERS = 250;
const MIN_FLIGHT_DISTANCE_METERS = 300_000;

type RoutePointDetails = TripGoRoutePointDetails;

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
export class TripGoRouteDialogComponent implements OnInit, OnDestroy {
  @ViewChild(TripGoRouteMapComponent) private routeMap?: TripGoRouteMapComponent;
  private readonly data = inject<TripGoRouteDialogData>(MAT_DIALOG_DATA);
  private routeOptions = normalizeRouteOptions(this.data.routeOptions ?? DEFAULT_ROUTE_OPTIONS);
  searchSettings = structuredClone(this.data.searchSettings ?? DEFAULT_SEARCH_SETTINGS);
  private readonly dialogRef = inject(MatDialogRef<TripGoRouteDialogComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly geolocation = inject(GeolocationService);
  private readonly nominatim = inject(NominatimService);
  private readonly tripGo = inject(TripGoService);
  private readonly routeSession = inject(TripGoRouteSessionService);
  private readonly transloco = inject(TranslocoService);
  private routeLoadSubscription?: Subscription;
  private serviceDetailsSubscription?: Subscription;
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
  readonly requestedRouteCategories = signal<TripGoRouteCategory[]>([]);
  readonly loadingRouteCategories = signal<ReadonlySet<TripGoRouteCategory>>(new Set());
  // Keep every requested variant visible after routing has finished. A missing
  // flight result should use the same placeholder card as car, bicycle and
  // walking instead of making the complete column disappear.
  readonly visibleRouteCategories = computed(() => this.requestedRouteCategories());
  readonly expandedRouteIds = signal<ReadonlySet<string>>(new Set());
  readonly errorKey = signal('common.tripGo.errors.route');
  readonly isBusy = computed(() => this.state() === 'locating' || this.state() === 'routing');

  ngOnInit(): void {
    const restoredSession = this.routeSession.restore(this.data.destination, this.data.origin);
    if (restoredSession) {
      this.origin.set(restoredSession.origin);
      this.destination.set(restoredSession.destination);
      this.originDetails.set(restoredSession.originDetails);
      this.destinationDetails.set(restoredSession.destinationDetails);
      this.routes.set(restoredSession.routes);
      this.requestedRouteCategories.set(restoredSession.requestedRouteCategories);
      this.expandedRouteIds.set(new Set(restoredSession.expandedRouteIds));
      this.state.set('ready');
      return;
    }
    if (!this.isUnsetLocation(this.destination())) {
      this.resolveRoutePoint('destination', this.destination());
    }
    if (this.data.origin && !this.isUnsetLocation(this.data.origin)) {
      const origin = this.withPlusCode(this.data.origin);
      this.origin.set(origin);
      this.resolveRoutePoint('origin', origin);
      this.state.set('idle');
      if (this.data.calculateImmediately) {
        this.calculateRoute();
      }
      return;
    }
    this.useCurrentPosition('origin', true);
  }

  ngOnDestroy(): void {
    this.saveRouteSession();
  }

  calculateRoute(): void {
    const origin = this.origin();
    if (!origin || this.isBusy()) return;
    this.showList();
    this.loadRoutes(origin, this.destination());
  }

  useCurrentPosition(kind: RoutePointKind, initial = false): void {
    if (!initial) this.routeSession.clear();
    this.cancelRouteRequests();
    this.showList();
    this.routes.set([]);
    this.requestedRouteCategories.set([]);
    this.loadingRouteCategories.set(new Set());
    this.expandedRouteIds.set(new Set());
    this.selectedRoute.set(null);
    this.routeMap?.stopSimulation();
    this.simulationState.set('idle');
    this.state.set('locating');
    this.geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20_000
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (position) => {
        const location: Location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          plusCode: this.geolocation.getPlusCode(position.coords.latitude, position.coords.longitude)
        };
        if (kind === 'origin') {
          this.origin.set(location);
          this.originDetails.set(null);
        } else {
          this.destination.set(location);
          this.destinationDetails.set(null);
        }
        this.resolveRoutePoint(kind, location);
        if (initial && this.isUnsetLocation(this.destination())) {
          const destination = { ...location };
          this.destination.set(destination);
          this.destinationDetails.set(null);
          this.resolveRoutePoint('destination', destination);
        }
        this.state.set('idle');
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

  swapRoutePoints(): void {
    const origin = this.origin();
    if (!origin || this.isBusy()) return;
    const destination = this.destination();
    const originDetails = this.originDetails();
    const destinationDetails = this.destinationDetails();
    this.origin.set(destination);
    this.destination.set(origin);
    this.originDetails.set(destinationDetails);
    this.destinationDetails.set(originDetails);
    this.showList();
    this.resetRouteResults();
  }

  close(): void {
    this.routeMap?.stopSimulation();
    this.dialogRef.close();
  }

  openRouteOptions(): void {
    const dialogRef = this.dialog.open<RouteOptionsComponent, { options: RouteOptions }, RouteOptions | undefined>(
      RouteOptionsComponent,
      {
        data: { options: structuredClone(this.routeOptions) },
        closeOnNavigation: true,
        width: '760px',
        maxWidth: '95vw',
        maxHeight: '90vh',
        autoFocus: false,
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        disableClose: false
      }
    );
    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((options) => {
      if (!options) return;
      this.routeOptions = normalizeRouteOptions(options);
      this.data.routeOptionsChanged?.(structuredClone(this.routeOptions));
      this.showList();
      this.resetRouteResults();
    });
  }

  showRouteOnMap(route: TripGoRouteOption): void {
    this.selectedRoute.set(route);
    this.viewMode.set('map');
  }

  showPreviousRoute(): void {
    this.showAdjacentRoute(-1);
  }

  showNextRoute(): void {
    this.showAdjacentRoute(1);
  }

  hasPreviousRoute(): boolean {
    return this.selectedRouteIndex() > 0;
  }

  hasNextRoute(): boolean {
    const index = this.selectedRouteIndex();
    return index >= 0 && index < this.routes().length - 1;
  }

  toggleRouteExpanded(event: Event, route: TripGoRouteOption): void {
    event.stopPropagation();
    const expanded = new Set(this.expandedRouteIds());
    if (expanded.has(route.id)) expanded.delete(route.id);
    else expanded.add(route.id);
    this.expandedRouteIds.set(expanded);
  }

  isRouteExpanded(route: TripGoRouteOption): boolean {
    return this.expandedRouteIds().has(route.id);
  }

  routeCategoryIcon(routeOrCategory: TripGoRouteOption | TripGoRouteCategory): string {
    const category = typeof routeOrCategory === 'string' ? routeOrCategory : routeOrCategory.category;
    switch (category) {
      case 'car-transit': return 'directions_car';
      case 'bicycle-transit': return 'directions_bike';
      case 'flight': return 'flight';
      default: return 'directions_walk';
    }
  }

  routeCategoryLabel(routeOrCategory: TripGoRouteOption | TripGoRouteCategory): string {
    const category = typeof routeOrCategory === 'string'
      ? routeOrCategory
      : routeOrCategory.category || 'walk-transit';
    return this.transloco.translate(`common.tripGo.routeCategories.${category}`);
  }

  routeTransportIcons(route: TripGoRouteOption): string[] {
    return tripGoRouteIcons(route);
  }

  routeForCategory(category: TripGoRouteCategory): TripGoRouteOption | undefined {
    return this.routes().find((route) => route.category === category);
  }

  isRouteCategoryLoading(category: TripGoRouteCategory): boolean {
    return this.loadingRouteCategories().has(category);
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

  showPublicTransportStop(stop: TripGoStop): void {
    this.routeMap?.pauseSimulation();
    this.dialog.open(TripGoStopDialogComponent, {
      data: stop,
      closeOnNavigation: true,
      width: 'min(680px, 95vw)',
      maxWidth: '95vw',
      maxHeight: '95vh',
      height: 'auto',
      autoFocus: false,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false
    });
  }

  showWikipediaArticles(articles: WikipediaArticle[]): void {
    this.routeMap?.pauseSimulation();
    this.data.wikipediaArticlesSelected?.(articles);
  }

  showRouteContent(content: MarkerLocation): void {
    this.routeMap?.pauseSimulation();
    this.data.routeContentSelected?.(content);
  }

  openSearchSettings(): void {
    const dialogRef = this.dialog.open<SearchSettingsComponent, unknown, SearchSettings | undefined>(
      SearchSettingsComponent,
      {
        data: { settings: structuredClone(this.searchSettings), location: this.destination() },
        closeOnNavigation: true,
        maxHeight: '90vh',
        width: '900px',
        maxWidth: '95vw',
        autoFocus: false,
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        disableClose: false
      }
    );
    dialogRef.afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((settings) => {
      if (!settings) return;
      this.searchSettings = structuredClone(settings);
      this.data.searchSettingsChanged?.(structuredClone(settings));
    });
  }

  editRoutePoint(kind: RoutePointKind): void {
    const current = kind === 'origin' ? this.origin() : this.destination();
    if (!current || this.state() === 'locating') return;

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
      this.resetRouteResults();
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
    this.data.routePointsChanged?.({ ...origin }, { ...destination });
    this.cancelRouteRequests();
    this.routes.set([]);
    this.requestedRouteCategories.set([]);
    this.loadingRouteCategories.set(new Set());
    this.expandedRouteIds.set(new Set());
    const distanceMeters = this.distanceInMeters(origin, destination);
    if (distanceMeters <= DESTINATION_REACHED_RADIUS_METERS) {
      this.state.set('arrived');
      return;
    }
    this.state.set('routing');
    const locale = this.transloco.getActiveLang() || 'de';
    const categories: RouteCategoryConfig[] = [];
    if (this.routeOptions.car) {
      categories.push({
        ...CAR_CATEGORY,
        fallbackModes: this.routeOptions.carPublicTransport ? ['me_car', 'pt_pub'] : undefined
      });
    }
    if (this.routeOptions.bicycle) {
      const bicycleOnly = !this.routeOptions.bicyclePublicTransport
        || distanceMeters <= this.routeOptions.bicyclePureMaxKm * 1_000;
      categories.push({
        category: 'bicycle-transit',
        primaryModes: bicycleOnly ? ['me_mic_bic'] : ['me_mic_bic', 'pt_pub'],
        fallbackModes: bicycleOnly && this.routeOptions.bicyclePublicTransport
          ? ['me_mic_bic', 'pt_pub']
          : undefined
      });
    }
    if (this.routeOptions.walking) {
      const walkingOnly = !this.routeOptions.walkingPublicTransport
        || distanceMeters <= this.routeOptions.walkingPureMaxKm * 1_000;
      categories.push({
        category: 'walk-transit',
        primaryModes: walkingOnly ? ['wa_wal'] : ['wa_wal', 'pt_pub'],
        fallbackModes: walkingOnly && this.routeOptions.walkingPublicTransport
          ? ['wa_wal', 'pt_pub']
          : undefined
      });
    }
    if (this.routeOptions.flights && distanceMeters >= MIN_FLIGHT_DISTANCE_METERS) {
      categories.push(FLIGHT_CATEGORY);
    }
    this.requestedRouteCategories.set(categories.map(({ category }) => category));
    this.loadingRouteCategories.set(new Set(categories.map(({ category }) => category)));
    let receivedResponse = false;
    // TripGo can reject a burst of several expensive routing requests with 503.
    // Process the route variants one after another instead of starting them all
    // at the same time.
    this.routeLoadSubscription = from(categories).pipe(
      concatMap(({ category, primaryModes, fallbackModes }) =>
        this.tripGo.calculateRoute(origin, destination, locale, primaryModes).pipe(
        catchError(() => of(null)),
        map((result) => this.filterDisconnectedRoutes(result, origin, destination)),
        switchMap((result) => result?.routes.length || !fallbackModes
          ? of(result)
          : this.tripGo.calculateRoute(origin, destination, locale, fallbackModes)
            .pipe(
              catchError(() => of(null)),
              map((fallbackResult) => this.filterDisconnectedRoutes(fallbackResult, origin, destination))
            )),
        map((result) => ({ category, result }))
        )),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: ({ category, result }) => {
        receivedResponse ||= result !== null;
        const bestRoute = category === 'flight'
          ? result?.routes.find((route) => route.segments.some((segment) =>
            tripGoSegmentIcon(segment) === 'flight'))
          : result?.routes[0];
        if (bestRoute) {
          const route: TripGoRouteOption = {
            ...bestRoute,
            id: `${category}:${bestRoute.id}`,
            category
          };
          this.routes.update((routes) => [...routes, route]);
          if (this.shouldExpandRoutesInitially()) {
            this.expandedRouteIds.update((ids) => new Set([...ids, route.id]));
          }
        }
        this.loadingRouteCategories.update((loading) => {
          const updated = new Set(loading);
          updated.delete(category);
          return updated;
        });
      },
      complete: () => {
        if (!receivedResponse) {
          this.errorKey.set('common.tripGo.errors.route');
          this.state.set('error');
          return;
        }
        this.state.set('ready');
        this.saveRouteSession();
        this.loadServiceDetails(this.routes());
      },
      error: () => {
        this.errorKey.set('common.tripGo.errors.route');
        this.state.set('error');
      }
    });
  }

  private showAdjacentRoute(offset: -1 | 1): void {
    const route = this.routes()[this.selectedRouteIndex() + offset];
    if (!route) return;
    this.routeMap?.stopSimulation();
    this.simulationState.set('idle');
    this.selectedRoute.set(route);
  }

  private selectedRouteIndex(): number {
    const selectedId = this.selectedRoute()?.id;
    return selectedId ? this.routes().findIndex((route) => route.id === selectedId) : -1;
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

    this.serviceDetailsSubscription = forkJoin(requests)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe((results) => {
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
      this.saveRouteSession();
      const selectedRouteId = this.selectedRoute()?.id;
      if (selectedRouteId) {
        this.selectedRoute.set(enrichedRoutes.find((route) => route.id === selectedRouteId) || null);
      }
    });
  }

  private cancelRouteRequests(): void {
    this.routeLoadSubscription?.unsubscribe();
    this.routeLoadSubscription = undefined;
    this.serviceDetailsSubscription?.unsubscribe();
    this.serviceDetailsSubscription = undefined;
  }

  private resetRouteResults(): void {
    this.routeSession.clear();
    this.cancelRouteRequests();
    this.routeMap?.stopSimulation();
    this.routes.set([]);
    this.requestedRouteCategories.set([]);
    this.loadingRouteCategories.set(new Set());
    this.expandedRouteIds.set(new Set());
    this.selectedRoute.set(null);
    this.simulationState.set('idle');
    this.state.set('idle');
  }

  private saveRouteSession(): void {
    const origin = this.origin();
    const routes = this.routes();
    if (!origin || this.state() !== 'ready' || routes.length === 0) return;
    this.routeSession.save({
      origin,
      destination: this.destination(),
      originDetails: this.originDetails(),
      destinationDetails: this.destinationDetails(),
      routes,
      requestedRouteCategories: this.requestedRouteCategories(),
      expandedRouteIds: [...this.expandedRouteIds()]
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

  private filterDisconnectedRoutes(
    result: TripGoRoutingResult | null,
    origin: Location,
    destination: Location
  ): TripGoRoutingResult | null {
    if (!result) return null;
    return {
      ...result,
      routes: result.routes.filter((route) => this.routeConnectsSelectedPoints(route, origin, destination))
    };
  }

  private routeConnectsSelectedPoints(
    route: TripGoRouteOption,
    origin: Location,
    destination: Location
  ): boolean {
    const firstLocation = route.segments.find((segment) =>
      Number.isFinite(segment.from?.latitude) && Number.isFinite(segment.from?.longitude))?.from;
    const lastLocation = [...route.segments].reverse().find((segment) =>
      Number.isFinite(segment.to?.latitude) && Number.isFinite(segment.to?.longitude))?.to;
    const startsNearby = !firstLocation || this.distanceInMeters(origin, {
      latitude: Number(firstLocation.latitude), longitude: Number(firstLocation.longitude), plusCode: ''
    }) <= MAX_ROUTE_ENDPOINT_SNAP_METERS;
    const endsNearby = !lastLocation || this.distanceInMeters(destination, {
      latitude: Number(lastLocation.latitude), longitude: Number(lastLocation.longitude), plusCode: ''
    }) <= MAX_ROUTE_ENDPOINT_SNAP_METERS;
    return startsNearby && endsNearby;
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

  private isUnsetLocation(location: Location): boolean {
    return location.latitude === 0 && location.longitude === 0;
  }

  private isNestedInteractiveElement(event: Event): boolean {
    const target = event.target;
    const currentTarget = event.currentTarget;
    return target instanceof Element
      && target !== currentTarget
      && target.closest('button, a, input, select, textarea') !== null;
  }

  private shouldExpandRoutesInitially(): boolean {
    return globalThis.matchMedia?.('(min-width: 700px)').matches ?? true;
  }
}
