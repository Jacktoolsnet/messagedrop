import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  output,
  signal,
  SimpleChanges
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import * as leaflet from 'leaflet';
import { Location } from '../../interfaces/location';
import { TripGoLocation, TripGoRouteOption, TripGoRouteSegment } from '../../interfaces/tripgo';
import { TripGoTimelineWeatherComponent } from './tripgo-timeline-weather.component';
import {
  tripGoDisplayLocationName,
  tripGoFollowingBoardingPlatform,
  tripGoServiceLabel,
  tripGoSegmentIcon,
  tripGoSegmentInstructionLocation
} from './tripgo-route.util';

export interface TripGoRouteMapPointSelection {
  kind: 'segment' | 'arrival';
  segmentIndex: number;
}

export type TripGoSimulationState = 'idle' | 'playing' | 'paused';

interface TripGoSimulationPoint {
  kind: 'start' | 'segment' | 'arrival';
  location: TripGoLocation;
  title: string;
  time?: string;
  segment?: TripGoRouteSegment;
  showOverlay: boolean;
}

@Component({
  selector: 'app-tripgo-route-map',
  standalone: true,
  imports: [MatIconModule, TranslocoPipe, TripGoTimelineWeatherComponent],
  template: `
    <div class="route-map-shell">
      <div class="route-map" [id]="mapId"></div>
      @if (activeSimulationPoint(); as point) {
        <aside class="simulation-overlay" role="status" aria-live="polite"
          [style.--simulation-color]="simulationPointColor(point)"
          [style.--simulation-contrast]="simulationPointContrast(point)">
          <header>
            <mat-icon aria-hidden="true">{{ simulationPointIcon(point) }}</mat-icon>
            <div>
              <small>{{ simulationPointKindKey(point) | transloco }}</small>
              <strong>{{ point.title }}</strong>
            </div>
          </header>
          <div class="simulation-overlay__facts">
            @if (point.time) {
              <span><mat-icon aria-hidden="true">schedule</mat-icon>{{ formatTime(point.time) }}</span>
            }
            @if (point.segment; as segment) {
              <span><mat-icon aria-hidden="true">{{ segmentIcon(segment) }}</mat-icon>{{ segmentLabel(segment) }}</span>
              @if (segment.service?.direction) {
                <span><mat-icon aria-hidden="true">signpost</mat-icon>{{ segment.service?.direction }}</span>
              }
              @if (segment.service?.startPlatform) {
                <span><mat-icon aria-hidden="true">pin_drop</mat-icon>{{ 'common.tripGo.platform' | transloco:{ platform: segment.service?.startPlatform } }}</span>
              }
            }
            <app-tripgo-timeline-weather [location]="point.location"></app-tripgo-timeline-weather>
          </div>
        </aside>
      }
    </div>
  `,
  styleUrl: './tripgo-route-map.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TripGoRouteMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) route!: TripGoRouteOption;
  @Input({ required: true }) origin!: Location;
  @Input({ required: true }) destination!: Location;
  readonly pointSelected = output<TripGoRouteMapPointSelection>();
  readonly simulationStateChange = output<TripGoSimulationState>();
  readonly activeSimulationPoint = signal<TripGoSimulationPoint | null>(null);

  readonly mapId = `tripgo-route-map-${Math.random().toString(36).slice(2)}`;
  private readonly transloco = inject(TranslocoService);
  private map?: leaflet.Map;
  private routeBounds?: leaflet.LatLngBounds;
  private simulationMarker?: leaflet.Marker;
  private simulationPoints: TripGoSimulationPoint[] = [];
  private readonly segmentGeometryDistanceCache = new Map<string, number>();
  private simulationIndex = -1;
  private simulationTimer?: ReturnType<typeof setTimeout>;
  private simulationAnimationFrame?: number;
  private currentSimulationDelayMs = 3_000;
  private simulationState: TripGoSimulationState = 'idle';
  private viewInitialized = false;

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.createMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewInitialized || !changes['route'] || changes['route'].firstChange) return;
    this.clearSimulationTimer();
    this.cancelSimulationAnimation();
    this.removeSimulationMarker();
    this.activeSimulationPoint.set(null);
    this.simulationIndex = -1;
    this.setSimulationState('idle');
    this.map?.remove();
    this.map = undefined;
    this.routeBounds = undefined;
    this.segmentGeometryDistanceCache.clear();
    this.createMap();
  }

  ngOnDestroy(): void {
    this.clearSimulationTimer();
    this.cancelSimulationAnimation();
    this.removeSimulationMarker();
    this.map?.remove();
  }

  startSimulation(): void {
    if (!this.map) return;
    this.simulationPoints = this.createSimulationPoints();
    if (!this.simulationPoints.length) return;
    this.setSimulationState('playing');
    this.showSimulationPoint(0, true);
  }

  pauseSimulation(): void {
    if (this.simulationState !== 'playing') return;
    this.clearSimulationTimer();
    this.setSimulationState('paused');
  }

  resumeSimulation(): void {
    if (this.simulationState !== 'paused') return;
    this.setSimulationState('playing');
    this.scheduleNextSimulationPoint();
  }

  showPreviousSimulationPoint(): void {
    if (this.simulationState === 'idle') return;
    this.showSimulationPoint(Math.max(0, this.simulationIndex - 1));
  }

  showNextSimulationPoint(): void {
    if (this.simulationState === 'idle') return;
    if (this.simulationIndex >= this.simulationPoints.length - 1) {
      this.finishSimulation();
      return;
    }
    this.showSimulationPoint(this.simulationIndex + 1);
  }

  stopSimulation(): void {
    this.clearSimulationTimer();
    this.cancelSimulationAnimation();
    this.removeSimulationMarker();
    this.activeSimulationPoint.set(null);
    this.simulationIndex = -1;
    this.setSimulationState('idle');
    this.showEntireRoute();
  }

  simulationPointIcon(point: TripGoSimulationPoint): string {
    if (point.kind === 'start') return 'my_location';
    if (point.kind === 'arrival') return 'location_on';
    return point.segment ? tripGoSegmentIcon(point.segment) : 'location_on';
  }

  simulationPointKindKey(point: TripGoSimulationPoint): string {
    if (point.kind === 'start') return 'common.tripGo.simulation.startPoint';
    if (point.kind === 'arrival') return 'common.tripGo.simulation.destinationPoint';
    return 'common.tripGo.simulation.routePoint';
  }

  simulationPointColor(point: TripGoSimulationPoint): string {
    return point.segment ? safeColor(point.segment.color) : '#000000';
  }

  simulationPointContrast(point: TripGoSimulationPoint): string {
    return contrastColor(this.simulationPointColor(point));
  }

  segmentIcon(segment: TripGoRouteSegment): string {
    return tripGoSegmentIcon(segment);
  }

  segmentLabel(segment: TripGoRouteSegment): string {
    if (segment.type === 'scheduled') {
      const service = tripGoServiceLabel(segment) || segment.modeIdentifier || '';
      const destination = tripGoDisplayLocationName(segment.to?.name);
      return destination
        ? this.transloco.translate('common.tripGo.serviceToLocation', { service, location: destination })
        : service;
    }
    const label = segment.type === 'stationary'
      ? this.transloco.translate('common.tripGo.waitingTime')
      : segment.service?.number || segment.modeLabel || segment.modeIdentifier || '';
    const segmentIndex = this.route.segments.indexOf(segment);
    const platform = tripGoFollowingBoardingPlatform(this.route, segmentIndex);
    const location = tripGoSegmentInstructionLocation(this.route, segmentIndex);
    if (segment.type === 'stationary') {
      return location
        ? this.transloco.translate('common.tripGo.waitingAt', { mode: label, location })
        : label;
    }
    if (location && platform) {
      return this.transloco.translate('common.tripGo.toLocationPlatform', { mode: label, location, platform });
    }
    return location
      ? this.transloco.translate('common.tripGo.toLocation', { mode: label, location })
      : label;
  }

  formatTime(value: string): string {
    return new Intl.DateTimeFormat(this.transloco.getActiveLang() || 'de', {
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(value));
  }

  private createMap(): void {
    this.map = leaflet.map(this.mapId, {
      center: [this.origin.latitude, this.origin.longitude],
      zoom: 14,
      worldCopyJump: true
    });
    this.map.setMaxBounds([[-90, -180], [90, 180]]);
    this.map.on('dragstart', () => this.pauseSimulation());
    const simulationPane = this.map.createPane('tripgoSimulationPane');
    simulationPane.style.zIndex = '1200';
    simulationPane.style.pointerEvents = 'none';

    leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 3,
      noWrap: true,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);

    const bounds = leaflet.latLngBounds([]);
    this.drawRoute(bounds);
    this.drawTimelineMarkers(bounds);

    if (bounds.isValid()) {
      this.routeBounds = bounds;
      this.showEntireRoute();
    }
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private createSimulationPoints(): TripGoSimulationPoint[] {
    const firstSegment = this.route.segments[0];
    const lastSegment = this.route.segments.at(-1);
    if (!firstSegment || !lastSegment) return [];

    const points: TripGoSimulationPoint[] = [];
    const start = firstSegment.from || {
      latitude: this.origin.latitude,
      longitude: this.origin.longitude
    };
    points.push({
      kind: 'start',
      location: start,
      title: start.name || start.address || this.transloco.translate('common.tripGo.origin'),
      time: this.route.departureTime,
      segment: firstSegment,
      showOverlay: true
    });

    this.route.segments.forEach((segment, segmentIndex) => {
      if (segmentIndex > 0 && this.validTripGoLocation(segment.from)) {
        points.push({
          kind: 'segment',
          location: segment.from,
          title: segment.from.name || segment.from.address || this.transloco.translate('common.tripGo.simulation.routePoint'),
          time: segment.startTime,
          segment,
          showOverlay: true
        });
      }

      const geometryPoints = this.segmentGeometryLocations(segment);
      const displayedPoints = geometryPoints.length >= 2
        ? geometryPoints
        : this.fallbackSimulationGeometry(segment);
      for (const location of displayedPoints) {
        if (this.isSameSimulationLocation(points.at(-1)?.location, location)) continue;
        const intermediateStop = segment.service?.intermediateStops?.find((stop) =>
          this.isSameSimulationLocation(stop, location));
        points.push({
          kind: 'segment',
          location,
          title: intermediateStop?.name || segment.from?.name || segment.from?.address
            || this.transloco.translate('common.tripGo.simulation.routePoint'),
          time: intermediateStop ? undefined : segment.startTime,
          segment,
          showOverlay: !!intermediateStop
        });
      }
    });

    const arrival = this.validTripGoLocation(lastSegment.to)
      ? lastSegment.to
      : { latitude: this.destination.latitude, longitude: this.destination.longitude };
    points.push({
      kind: 'arrival',
      location: arrival,
      title: arrival.name || arrival.address || this.transloco.translate('common.tripGo.destination'),
      time: this.route.arrivalTime,
      showOverlay: true
    });
    return points;
  }

  private showSimulationPoint(index: number, initial = false): void {
    const point = this.simulationPoints[index];
    if (!point || !this.map) return;
    this.clearSimulationTimer();
    this.simulationIndex = index;
    if (point.showOverlay) {
      this.activeSimulationPoint.set(point);
    }

    const animate = !this.prefersReducedMotion();
    const movementDuration = animate ? this.simulationMovementDuration(index, initial, point.showOverlay) : 0;
    const targetZoom = this.simulationZoom(point);
    if (targetZoom !== undefined && (initial || this.map.getZoom() !== targetZoom)) {
      this.map.setZoom(targetZoom, { animate });
    }
    this.moveSimulationMarker(point, movementDuration, initial);
    this.currentSimulationDelayMs = point.showOverlay
      ? (this.prefersReducedMotion() ? 1_500 : 3_000)
      : (this.prefersReducedMotion() ? 0 : Math.round(movementDuration * 1_000) + 70);
    if (this.simulationState === 'playing') {
      this.scheduleNextSimulationPoint();
    }
  }

  private scheduleNextSimulationPoint(): void {
    this.clearSimulationTimer();
    this.simulationTimer = setTimeout(() => {
      if (this.simulationIndex >= this.simulationPoints.length - 1) {
        this.finishSimulation();
      } else {
        this.showSimulationPoint(this.simulationIndex + 1);
      }
    }, this.currentSimulationDelayMs);
  }

  private finishSimulation(): void {
    this.clearSimulationTimer();
    this.cancelSimulationAnimation();
    this.removeSimulationMarker();
    this.activeSimulationPoint.set(null);
    this.simulationIndex = -1;
    this.setSimulationState('idle');
    this.showEntireRoute();
  }

  private showEntireRoute(): void {
    if (this.map && this.routeBounds?.isValid()) {
      this.map.fitBounds(this.routeBounds, { padding: [32, 32], maxZoom: 17 });
    }
  }

  private setSimulationState(state: TripGoSimulationState): void {
    this.simulationState = state;
    this.simulationStateChange.emit(state);
  }

  private clearSimulationTimer(): void {
    if (this.simulationTimer) {
      clearTimeout(this.simulationTimer);
      this.simulationTimer = undefined;
    }
  }

  private prefersReducedMotion(): boolean {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  }

  private simulationZoom(point: TripGoSimulationPoint): number | undefined {
    if (!point.segment || point.segment.type === 'stationary') return undefined;

    switch (tripGoSegmentIcon(point.segment)) {
      case 'directions_walk':
        return 19;
      case 'directions_bus':
      case 'tram':
        return 17;
      case 'train':
        return 15;
      case 'flight':
        return 14;
      default:
        return 17;
    }
  }

  private moveSimulationMarker(point: TripGoSimulationPoint, durationSeconds: number, initial: boolean): void {
    if (!this.map) return;
    const latLng = leaflet.latLng(Number(point.location.latitude), Number(point.location.longitude));
    const cursorIcon = point.kind === 'arrival'
      ? 'location_on'
      : point.segment
        ? tripGoSegmentIcon(point.segment)
        : 'gps_fixed';
    if (this.simulationMarker) {
      const iconElement = this.simulationMarker.getElement()?.querySelector<HTMLElement>('.material-symbols-outlined');
      if (iconElement) iconElement.textContent = cursorIcon;
      this.animateSimulationMovement(latLng, durationSeconds);
      return;
    }

    const icon = leaflet.divIcon({
      className: 'tripgo-simulation-cursor',
      html: `<span class="material-symbols-outlined" aria-hidden="true" style="display:grid;place-items:center;width:38px;height:38px;box-sizing:border-box;border:3px solid #fff;border-radius:50%;background:#000;color:#fff;box-shadow:0 3px 10px rgba(0,0,0,.5);font-size:23px;font-variation-settings:'FILL' 0,'wght' 650,'GRAD' 0,'opsz' 24">${cursorIcon}</span>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });
    this.simulationMarker = leaflet.marker(latLng, {
      icon,
      interactive: false,
      keyboard: false,
      pane: 'tripgoSimulationPane',
      zIndexOffset: 4_000
    }).addTo(this.map);
    this.map.panTo(latLng, {
      animate: durationSeconds > 0,
      duration: initial ? durationSeconds : 0
    });
  }

  private removeSimulationMarker(): void {
    if (this.simulationMarker && this.map) {
      this.simulationMarker.removeFrom(this.map);
    }
    this.simulationMarker = undefined;
  }

  private animateSimulationMovement(target: leaflet.LatLng, durationSeconds: number): void {
    if (!this.map || !this.simulationMarker) return;
    this.cancelSimulationAnimation();
    const start = this.simulationMarker.getLatLng();
    if (durationSeconds <= 0) {
      this.simulationMarker.setLatLng(target);
      this.map.panTo(target, { animate: false });
      return;
    }

    const startedAt = performance.now();
    const durationMilliseconds = durationSeconds * 1_000;
    const animateFrame = (timestamp: number): void => {
      if (!this.map || !this.simulationMarker) return;
      const progress = Math.min(1, (timestamp - startedAt) / durationMilliseconds);
      const current = leaflet.latLng(
        start.lat + (target.lat - start.lat) * progress,
        start.lng + (target.lng - start.lng) * progress
      );
      this.simulationMarker.setLatLng(current);
      this.map.panTo(current, { animate: false });
      if (progress < 1) {
        this.simulationAnimationFrame = requestAnimationFrame(animateFrame);
      } else {
        this.simulationAnimationFrame = undefined;
      }
    };
    this.simulationAnimationFrame = requestAnimationFrame(animateFrame);
  }

  private cancelSimulationAnimation(): void {
    if (this.simulationAnimationFrame !== undefined) {
      cancelAnimationFrame(this.simulationAnimationFrame);
      this.simulationAnimationFrame = undefined;
    }
  }

  private simulationMovementDuration(index: number, initial: boolean, routePoint: boolean): number {
    if (initial) return 1.1;
    const previous = this.simulationPoints[index - 1]?.location;
    const current = this.simulationPoints[index]?.location;
    if (!this.validTripGoLocation(previous) || !this.validTripGoLocation(current)) {
      return routePoint ? .7 : .28;
    }

    const distanceMeters = this.distanceInMeters(previous, current);
    if (routePoint && distanceMeters < 2) return .25;

    const segment = this.simulationPoints[index]?.segment;
    const segmentDistance = segment ? this.segmentGeometryDistance(segment) : 0;
    if (segment?.durationSeconds && segmentDistance > 0) {
      const identifier = segment.modeIdentifier || '';
      const isRail = identifier.includes('train') || identifier.includes('subway');
      const compressedSegmentDuration = isRail
        ? Math.min(30, Math.max(5, segment.durationSeconds / 30))
        : Math.min(20, Math.max(3, segment.durationSeconds / 45));
      const proportionalDuration = compressedSegmentDuration * distanceMeters / segmentDistance;
      return Math.min(isRail ? 30 : 10, Math.max(.24, proportionalDuration));
    }

    return Math.min(8, Math.max(.24, distanceMeters / 100));
  }

  private segmentGeometryDistance(segment: TripGoRouteSegment): number {
    const cached = this.segmentGeometryDistanceCache.get(segment.id);
    if (cached !== undefined) return cached;

    const locations = this.segmentGeometryLocations(segment);
    const points = locations.length >= 2 ? locations : this.fallbackSimulationGeometry(segment);
    let distance = 0;
    for (let index = 1; index < points.length; index += 1) {
      distance += this.distanceInMeters(points[index - 1], points[index]);
    }
    this.segmentGeometryDistanceCache.set(segment.id, distance);
    return distance;
  }

  private distanceInMeters(from: TripGoLocation, to: TripGoLocation): number {
    const toRadians = (degrees: number): number => degrees * Math.PI / 180;
    const latitudeDelta = toRadians(Number(to.latitude) - Number(from.latitude));
    const longitudeDelta = toRadians(Number(to.longitude) - Number(from.longitude));
    const firstLatitude = toRadians(Number(from.latitude));
    const secondLatitude = toRadians(Number(to.latitude));
    const haversine = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
    return 2 * 6_371_000 * Math.asin(Math.sqrt(haversine));
  }

  private validTripGoLocation(location: TripGoLocation | undefined): location is TripGoLocation & { latitude: number; longitude: number } {
    return Number.isFinite(location?.latitude) && Number.isFinite(location?.longitude);
  }

  private fallbackSimulationGeometry(segment: TripGoRouteSegment): TripGoLocation[] {
    const points: TripGoLocation[] = [];
    if (this.validTripGoLocation(segment.from)) points.push(segment.from);
    if (this.validTripGoLocation(segment.to)) points.push(segment.to);
    return points;
  }

  private segmentGeometryLocations(segment: TripGoRouteSegment): TripGoLocation[] {
    const detailedGeometry = (segment.detailedGeometry || []).filter((location) =>
      this.validTripGoLocation(location));
    if (detailedGeometry.length >= 2) return detailedGeometry;
    return segment.geometry
      .flatMap((encodedPath) => decodePolyline(encodedPath))
      .map(([latitude, longitude]) => ({ latitude, longitude }));
  }

  private isSameSimulationLocation(
    left: TripGoLocation | undefined,
    right: TripGoLocation | undefined
  ): boolean {
    if (!this.validTripGoLocation(left) || !this.validTripGoLocation(right)) return false;
    return Math.abs(left.latitude - right.latitude) < 0.000001
      && Math.abs(left.longitude - right.longitude) < 0.000001;
  }

  private drawRoute(bounds: leaflet.LatLngBounds): void {
    for (const segment of this.route.segments) {
      const color = safeColor(segment.color);
      let drewGeometry = false;
      const detailedPoints = (segment.detailedGeometry || [])
        .filter((location) => this.validTripGoLocation(location))
        .map((location): leaflet.LatLngTuple => [location.latitude, location.longitude]);
      const hasDetailedGeometry = detailedPoints.length >= 2;
      if (hasDetailedGeometry) {
        drewGeometry = true;
        leaflet.polyline(detailedPoints, { color: '#ffffff', weight: 9, opacity: 0.8 }).addTo(this.map!);
        leaflet.polyline(detailedPoints, { color, weight: 6, opacity: 0.9 }).addTo(this.map!);
        for (const point of detailedPoints) bounds.extend(point);
      }
      for (const encodedPath of segment.geometry) {
        if (hasDetailedGeometry) break;
        const points = decodePolyline(encodedPath);
        if (points.length < 2) continue;
        drewGeometry = true;
        leaflet.polyline(points, { color: '#ffffff', weight: 9, opacity: 0.8 }).addTo(this.map!);
        leaflet.polyline(points, { color, weight: 6, opacity: 0.9 }).addTo(this.map!);
        for (const point of points) bounds.extend(point);
      }
      if (!drewGeometry) this.drawGeometryFallback(segment, color, bounds);
    }
  }

  private drawTimelineMarkers(bounds: leaflet.LatLngBounds): void {
    this.route.segments.forEach((segment, index) => {
      const location = this.segmentLocation(segment, 'from') || (index === 0 ? this.origin : null);
      if (!location) return;
      this.addModeMarker(
        location,
        tripGoSegmentIcon(segment),
        safeColor(segment.color),
        [segment.from?.name, this.segmentLabel(segment)].filter(Boolean).join(' · '),
        index,
        'segment'
      );
      this.addIntermediateStopMarkers(segment, index, bounds);
      bounds.extend([location.latitude, location.longitude]);
    });

    const lastSegment = this.route.segments.at(-1);
    const arrival = lastSegment ? this.segmentLocation(lastSegment, 'to') : null;
    const destination = arrival || this.destination;
    this.addModeMarker(
      destination,
      'location_on',
      safeColor(lastSegment?.color),
      lastSegment?.to?.name,
      this.route.segments.length,
      'arrival'
    );
    bounds.extend([destination.latitude, destination.longitude]);
  }

  private addIntermediateStopMarkers(
    segment: TripGoRouteSegment,
    segmentIndex: number,
    bounds: leaflet.LatLngBounds
  ): void {
    const color = safeColor(segment.color);
    for (const stop of segment.service?.intermediateStops || []) {
      if (!this.validTripGoLocation(stop)) continue;
      const marker = leaflet.circleMarker([stop.latitude, stop.longitude], {
        radius: 5,
        color: '#ffffff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1
      }).addTo(this.map!);
      if (stop.name) {
        const tooltip = document.createElement('span');
        tooltip.textContent = stop.name;
        marker.bindTooltip(tooltip, { direction: 'top' });
      }
      marker.on('click', () => this.pointSelected.emit({ kind: 'segment', segmentIndex }));
      bounds.extend([stop.latitude, stop.longitude]);
    }
  }

  private addModeMarker(
    location: Location,
    iconName: string,
    color: string,
    label: string | undefined,
    index: number,
    kind: TripGoRouteMapPointSelection['kind']
  ): void {
    const icon = leaflet.divIcon({
      className: '',
      html: `<span class="material-symbols-outlined" aria-hidden="true" style="display:grid;place-items:center;width:34px;height:34px;box-sizing:border-box;border:3px solid #fff;border-radius:50%;background:${color};color:${contrastColor(color)};box-shadow:0 2px 7px rgba(0,0,0,.4);font-size:19px;cursor:pointer;font-variation-settings:'FILL' 0,'wght' 600,'GRAD' 0,'opsz' 24">${iconName}</span>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });
    const marker = leaflet.marker([location.latitude, location.longitude], {
      icon,
      title: label,
      zIndexOffset: 1000 + index
    }).addTo(this.map!);
    marker.on('click', () => this.pointSelected.emit({ kind, segmentIndex: index }));
    if (label) {
      const tooltip = document.createElement('span');
      tooltip.textContent = label;
      marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -16] });
    }
  }

  private drawGeometryFallback(segment: TripGoRouteSegment, color: string, bounds: leaflet.LatLngBounds): void {
    const from = this.segmentLocation(segment, 'from');
    const to = this.segmentLocation(segment, 'to');
    if (!from || !to) return;
    const points: leaflet.LatLngTuple[] = [
      [from.latitude, from.longitude],
      [to.latitude, to.longitude]
    ];
    leaflet.polyline(points, { color: '#ffffff', weight: 8, opacity: 0.75, dashArray: '7 7' }).addTo(this.map!);
    leaflet.polyline(points, { color, weight: 5, opacity: 0.85, dashArray: '7 7' }).addTo(this.map!);
    bounds.extend(points[0]);
    bounds.extend(points[1]);
  }

  private segmentLocation(segment: TripGoRouteSegment, endpoint: 'from' | 'to'): Location | null {
    const location = segment[endpoint];
    if (!Number.isFinite(location?.latitude) || !Number.isFinite(location?.longitude)) return null;
    return {
      latitude: Number(location?.latitude),
      longitude: Number(location?.longitude),
      plusCode: ''
    };
  }
}

function safeColor(value: string | undefined): string {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : '#6750a4';
}

function contrastColor(color: string): '#000000' | '#ffffff' {
  const red = Number.parseInt(color.slice(1, 3), 16);
  const green = Number.parseInt(color.slice(3, 5), 16);
  const blue = Number.parseInt(color.slice(5, 7), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance >= 150 ? '#000000' : '#ffffff';
}

export function decodePolyline(encoded: string, precision = 5): leaflet.LatLngTuple[] {
  const coordinates: leaflet.LatLngTuple[] = [];
  const factor = 10 ** precision;
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    const latitudeValue = decodeValue(encoded, index);
    if (!latitudeValue) break;
    index = latitudeValue.nextIndex;
    const longitudeValue = decodeValue(encoded, index);
    if (!longitudeValue) break;
    index = longitudeValue.nextIndex;
    latitude += latitudeValue.delta;
    longitude += longitudeValue.delta;
    coordinates.push([latitude / factor, longitude / factor]);
  }
  return coordinates;
}

function decodeValue(encoded: string, startIndex: number): { delta: number; nextIndex: number } | null {
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte: number;
  do {
    if (index >= encoded.length) return null;
    byte = encoded.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);
  return {
    delta: (result & 1) !== 0 ? ~(result >> 1) : result >> 1,
    nextIndex: index
  };
}
