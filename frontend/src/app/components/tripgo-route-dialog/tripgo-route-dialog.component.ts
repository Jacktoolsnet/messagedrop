import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
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
import { tripGoFollowingBoardingPlatform, tripGoSegmentIcon } from './tripgo-route.util';
import { TripGoTimelineWeatherComponent } from './tripgo-timeline-weather.component';

export interface TripGoRouteDialogData {
  destination: Location;
}

type RouteDialogState = 'locating' | 'routing' | 'ready' | 'arrived' | 'error';
type RoutePointKind = 'origin' | 'destination';

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

  segmentLabel(route: TripGoRouteOption, segment: TripGoRouteSegment, segmentIndex: number): string {
    const label = segment.type === 'stationary'
      ? this.transloco.translate('common.tripGo.waitingTime')
      : segment.service?.number || segment.modeLabel || segment.modeIdentifier || '';
    const platform = tripGoFollowingBoardingPlatform(route, segmentIndex);
    return platform
      ? this.transloco.translate(
        segment.type === 'stationary' ? 'common.tripGo.atPlatform' : 'common.tripGo.toPlatform',
        { mode: label, platform }
      )
      : label;
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
      },
      error: () => {
        this.errorKey.set('common.tripGo.errors.route');
        this.state.set('error');
      }
    });
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
}
