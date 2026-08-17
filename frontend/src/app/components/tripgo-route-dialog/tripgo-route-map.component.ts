import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Input,
  OnChanges,
  OnDestroy,
  output,
  signal,
  SimpleChanges
} from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import * as leaflet from 'leaflet';
import { Subscription, catchError, forkJoin, from, map, mergeMap, of, retry, tap, timer, toArray } from 'rxjs';
import { Location } from '../../interfaces/location';
import { MarkerLocation } from '../../interfaces/marker-location';
import { MarkerType } from '../../interfaces/marker-type';
import { DEFAULT_SEARCH_SETTINGS, SearchSettings } from '../../interfaces/search-settings';
import { TripGoLocation, TripGoRouteOption, TripGoRouteSegment, TripGoStop, TripGoTurnInstruction } from '../../interfaces/tripgo';
import { WikipediaArticle } from '../../interfaces/wikipedia';
import { GeolocationService } from '../../services/geolocation.service';
import { overpassPlacesMarker, overpassPoiMarker, publicTransportStopMarker } from '../../services/map.service';
import { TripGoRouteContent, TripGoRouteContentService } from '../../services/tripgo-route-content.service';
import { WikipediaService } from '../../services/wikipedia.service';
import { DisplayMessage } from '../utils/display-message/display-message.component';
import { TripGoTimelineWeatherComponent } from './tripgo-timeline-weather.component';
import {
  tripGoDisplayLocationName,
  tripGoFollowingBoardingPlatform,
  tripGoRouteIcons,
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
  turnInstruction?: TripGoTurnInstruction;
  updateOverlay?: boolean;
  showOverlay: boolean;
  showWeather?: boolean;
}

const wikipediaMarker = leaflet.icon({
  iconUrl: 'assets/markers/wikipedia-marker.svg',
  iconSize: [32, 40],
  iconAnchor: [16, 40]
});
const routeContentIcons: Partial<Record<MarkerType, leaflet.Icon>> = {
  [MarkerType.PUBLIC_MESSAGE]: leaflet.icon({ iconUrl: 'assets/markers/message-marker.svg', iconSize: [32, 40], iconAnchor: [16, 40] }),
  [MarkerType.PRIVATE_NOTE]: leaflet.icon({ iconUrl: 'assets/markers/note-marker.svg', iconSize: [32, 40], iconAnchor: [16, 40] }),
  [MarkerType.PRIVATE_IMAGE]: leaflet.icon({ iconUrl: 'assets/markers/image-marker.svg', iconSize: [32, 40], iconAnchor: [16, 40] }),
  [MarkerType.PRIVATE_DOCUMENT]: leaflet.icon({ iconUrl: 'assets/markers/document-marker.svg', iconSize: [32, 40], iconAnchor: [16, 40] }),
  [MarkerType.EXPERIENCE_DESTINATION]: leaflet.icon({ iconUrl: 'assets/markers/experience-marker.svg', iconSize: [32, 40], iconAnchor: [16, 40] }),
  [MarkerType.MY_EXPERIENCE]: leaflet.icon({ iconUrl: 'assets/markers/my-experience-marker.svg', iconSize: [32, 40], iconAnchor: [16, 40] }),
  [MarkerType.SECRET_DROP]: leaflet.icon({ iconUrl: 'assets/markers/secretdrop-marker.svg', iconSize: [32, 40], iconAnchor: [16, 40] }),
  [MarkerType.MULTI]: leaflet.icon({ iconUrl: 'assets/markers/multi-marker.svg', iconSize: [32, 40], iconAnchor: [16, 40] })
};
const WIKIPEDIA_ROUTE_RADIUS_METERS = 200;
const MAX_WIKIPEDIA_SIMULATION_SEARCHES = 80;
const OVERPASS_POI_GROUP_RADIUS_METERS = 10;
const EMPTY_ROUTE_CONTENT: TripGoRouteContent = {
  messages: [], notes: [], images: [], documents: [], experiences: [], myExperiences: [], secretDrops: [], overpassPois: []
};

@Component({
  selector: 'app-tripgo-route-map',
  standalone: true,
  imports: [MatIconModule, TranslocoPipe, TripGoTimelineWeatherComponent],
  template: `
    <div class="route-map-shell">
      <div class="route-map" [id]="mapId"></div>
      @if (!activeSimulationPoint()) {
        <aside class="route-summary-overlay" role="status" aria-live="polite"
          [attr.aria-label]="routeCategoryLabel()">
          <div class="route-summary-overlay__main">
            <span class="route-summary-overlay__modes">
              @for (icon of routeTransportIcons(); track icon) {
                <mat-icon class="route-summary-overlay__mode" aria-hidden="true">{{ icon }}</mat-icon>
              }
            </span>
            <div class="route-summary-overlay__times">
              <strong>{{ formatTime(route.departureTime) }}</strong>
              <mat-icon aria-hidden="true">arrow_forward</mat-icon>
              <strong>{{ formatTime(route.arrivalTime) }}</strong>
            </div>
          </div>
          <div class="route-summary-overlay__facts">
            <span>
              <mat-icon aria-hidden="true">schedule</mat-icon>
              {{ formatDuration(route.durationSeconds) }}
            </span>
            <span>
              @if (route.transfers === 0) {
                {{ 'common.tripGo.direct' | transloco }}
              } @else if (route.transfers === 1) {
                {{ 'common.tripGo.oneTransfer' | transloco }}
              } @else {
                {{ 'common.tripGo.transfers' | transloco:{ count: route.transfers } }}
              }
            </span>
          </div>
        </aside>
      }
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
            @if (point.turnInstruction; as instruction) {
              <span class="simulation-overlay__instruction">
                <mat-icon aria-hidden="true">{{ turnInstructionIcon(instruction) }}</mat-icon>
                <strong>{{ turnInstructionLabel(instruction) }}</strong>
              </span>
            }
            <span class="simulation-overlay__time">
              <mat-icon aria-hidden="true">schedule</mat-icon>
              @if (simulatedTime(); as time) { {{ formatTime(time) }} } @else { &ndash; }
            </span>
            @if (point.segment; as segment) {
              <span><mat-icon aria-hidden="true">{{ segmentIcon(segment) }}</mat-icon>{{ segmentLabel(segment) }}</span>
              @if (segment.service?.direction) {
                <span><mat-icon aria-hidden="true">signpost</mat-icon>{{ segment.service?.direction }}</span>
              }
              @if (segment.service?.startPlatform) {
                <span><mat-icon aria-hidden="true">pin_drop</mat-icon>{{ 'common.tripGo.platform' | transloco:{ platform: segment.service?.startPlatform } }}</span>
              }
            }
            @if (point.showWeather) {
              <app-tripgo-timeline-weather [location]="point.location"></app-tripgo-timeline-weather>
            }
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
  @Input() searchSettings: SearchSettings = structuredClone(DEFAULT_SEARCH_SETTINGS);
  readonly pointSelected = output<TripGoRouteMapPointSelection>();
  readonly stopSelected = output<TripGoStop>();
  readonly wikipediaSelected = output<WikipediaArticle[]>();
  readonly routeContentSelected = output<MarkerLocation>();
  readonly searchSettingsClick = output<void>();
  readonly simulationStateChange = output<TripGoSimulationState>();
  readonly activeSimulationPoint = signal<TripGoSimulationPoint | null>(null);
  readonly simulatedTime = signal<string | null>(null);

  readonly mapId = `tripgo-route-map-${Math.random().toString(36).slice(2)}`;
  private readonly transloco = inject(TranslocoService);
  private readonly geolocation = inject(GeolocationService);
  private readonly wikipedia = inject(WikipediaService);
  private readonly routeContent = inject(TripGoRouteContentService);
  private readonly dialog = inject(MatDialog);
  private map?: leaflet.Map;
  private routeBounds?: leaflet.LatLngBounds;
  private simulationMarker?: leaflet.Marker;
  private simulationPoints: TripGoSimulationPoint[] = [];
  private readonly segmentGeometryDistanceCache = new Map<string, number>();
  private segmentGeometryLocationsCache?: Map<TripGoRouteSegment, TripGoLocation[]>;
  private simulationIndex = -1;
  private simulationTimer?: ReturnType<typeof setTimeout>;
  private simulationAnimationFrame?: number;
  private currentSimulationDelayMs = 3_000;
  private simulationState: TripGoSimulationState = 'idle';
  private viewInitialized = false;
  private zoomLevelButton?: HTMLButtonElement;
  private wikipediaMarkers: leaflet.Marker[] = [];
  private wikipediaRequest?: Subscription;
  private wikipediaLoadTimer?: ReturnType<typeof setTimeout>;
  private wikipediaPreparation?: Subscription;
  private wikipediaPreparationDialog?: MatDialogRef<DisplayMessage>;
  private wikipediaPreparing = false;
  private wikipediaPrepared = false;
  private wikipediaSuppressedForSimulation = false;
  private preparedWikipediaArticles: WikipediaArticle[] = [];
  private preparedRouteContent: TripGoRouteContent = structuredClone(EMPTY_ROUTE_CONTENT);
  private routeContentMarkers: leaflet.Marker[] = [];
  private routeContentLoadToken = 0;
  readonly wikipediaPreparationCompleted = signal(0);
  readonly wikipediaPreparationTotal = signal(0);
  readonly wikipediaPreparationProgress = computed(() => {
    const total = this.wikipediaPreparationTotal();
    return total > 0 ? this.wikipediaPreparationCompleted() / total * 100 : 0;
  });
  readonly wikipediaPreparationText = computed(() => this.transloco.translate(
    'common.tripGo.simulation.wikipediaProgress',
    { completed: this.wikipediaPreparationCompleted(), total: this.wikipediaPreparationTotal() }
  ));

  ngAfterViewInit(): void {
    this.viewInitialized = true;
    this.createMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.viewInitialized && changes['searchSettings'] && !changes['route']) {
      this.resetWikipediaPreparation();
      this.scheduleWikipediaLoad();
    }
    if (!this.viewInitialized || !changes['route'] || changes['route'].firstChange) return;
    this.clearSimulationTimer();
    this.cancelSimulationAnimation();
    this.removeSimulationMarker();
    this.activeSimulationPoint.set(null);
    this.simulatedTime.set(null);
    this.simulationIndex = -1;
    this.setSimulationState('idle');
    this.map?.remove();
    this.map = undefined;
    this.cancelWikipediaLoad();
    this.resetWikipediaPreparation();
    this.clearWikipediaMarkers();
    this.clearRouteContentMarkers();
    this.routeBounds = undefined;
    this.segmentGeometryDistanceCache.clear();
    this.segmentGeometryLocationsCache = undefined;
    this.createMap();
  }

  ngOnDestroy(): void {
    this.clearSimulationTimer();
    this.cancelSimulationAnimation();
    this.removeSimulationMarker();
    this.cancelWikipediaLoad();
    this.resetWikipediaPreparation();
    this.clearWikipediaMarkers();
    this.clearRouteContentMarkers();
    this.map?.remove();
  }

  startSimulation(): void {
    if (!this.map) return;
    this.simulationPoints = this.createSimulationPoints();
    if (!this.simulationPoints.length) return;
    if (this.shouldPrepareWikipediaForSimulation()) {
      this.prepareWikipediaForSimulation();
      return;
    }
    this.beginSimulation();
  }

  private beginSimulation(): void {
    if (!this.simulationPoints.length) return;
    this.setSimulationState('playing');
    this.showSimulationPoint(0, true);
  }

  pauseSimulation(): void {
    if (this.simulationState !== 'playing') return;
    this.clearSimulationTimer();
    this.cancelSimulationAnimation();
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
    this.simulatedTime.set(null);
    this.simulationIndex = -1;
    this.setSimulationState('idle');
    this.showEntireRoute();
    this.finishWikipediaSuppression();
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

  formatDuration(seconds: number): string {
    const minutes = Math.max(1, Math.round(seconds / 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return hours > 0 ? `${hours} h ${remainingMinutes} min` : `${minutes} min`;
  }

  routeTransportIcons(): string[] {
    return tripGoRouteIcons(this.route);
  }

  routeCategoryLabel(): string {
    return this.transloco.translate(`common.tripGo.routeCategories.${this.route.category || 'walk-transit'}`);
  }

  turnInstructionLabel(instruction: TripGoTurnInstruction): string {
    const actionKeys: Record<string, string> = {
      HEAD_TOWARDS: 'start',
      CONTINUE_STRAIGHT: 'straight',
      TURN_LEFT: 'left',
      TURN_RIGHT: 'right',
      TURN_SLIGHTLY_LEFT: 'slightlyLeft',
      TURN_SLIGHTLY_RIGHT: 'slightlyRight',
      TURN_SHARPLY_LEFT: 'sharplyLeft',
      TURN_SHARPLY_RIGHT: 'sharplyRight',
      U_TURN: 'uTurn',
      ENTER_ROUNDABOUT: 'roundabout',
      EXIT_ROUNDABOUT: 'exitRoundabout'
    };
    const key = actionKeys[instruction.action || ''] || 'continue';
    const action = this.transloco.translate(`common.tripGo.turnInstructions.${key}`);
    return instruction.streetName
      ? this.transloco.translate('common.tripGo.turnInstructions.ontoStreet', {
        instruction: action,
        street: instruction.streetName
      })
      : action;
  }

  turnInstructionIcon(instruction: TripGoTurnInstruction): string {
    switch (instruction.action) {
      case 'TURN_LEFT': return 'turn_left';
      case 'TURN_RIGHT': return 'turn_right';
      case 'TURN_SLIGHTLY_LEFT': return 'turn_slight_left';
      case 'TURN_SLIGHTLY_RIGHT': return 'turn_slight_right';
      case 'TURN_SHARPLY_LEFT': return 'turn_sharp_left';
      case 'TURN_SHARPLY_RIGHT': return 'turn_sharp_right';
      case 'U_TURN': return 'u_turn_left';
      case 'ENTER_ROUNDABOUT':
      case 'EXIT_ROUNDABOUT': return 'roundabout_right';
      case 'CONTINUE_STRAIGHT': return 'straight';
      default: return 'navigation';
    }
  }

  private createMap(): void {
    this.map = leaflet.map(this.mapId, {
      center: [this.origin.latitude, this.origin.longitude],
      zoom: 14,
      worldCopyJump: true
    });
    this.map.setMaxBounds([[-90, -180], [90, 180]]);
    this.map.on('click', (event) => this.toggleSimulationFromMapClick(event));
    this.map.on('dragstart', () => this.pauseSimulation());
    this.map.on('zoomend', () => {
      this.updateZoomLevelButton();
      this.scheduleWikipediaLoad();
    });
    this.map.on('moveend', () => this.scheduleWikipediaLoad());
    this.addZoomLevelButton();
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
    this.scheduleWikipediaLoad();
  }

  private toggleSimulationFromMapClick(event: leaflet.LeafletMouseEvent): void {
    // Marker clicks open details and must not also toggle the simulation. Marker
    // click events bubble to the map with the marker as their source target.
    if (event.sourceTarget instanceof leaflet.Marker
      || event.sourceTarget instanceof leaflet.CircleMarker) {
      return;
    }
    if (this.simulationState === 'playing') {
      this.pauseSimulation();
    } else if (this.simulationState === 'paused') {
      this.resumeSimulation();
    }
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
      showOverlay: true,
      showWeather: true
    });

    this.route.segments.forEach((segment, segmentIndex) => {
      const geometryPoints = this.segmentGeometryLocations(segment);
      const turnInstructions = this.turnInstructionsWithLocations(segment);
      let progressOverlayAdded = false;
      const displayedPoints = geometryPoints.length >= 2
        ? geometryPoints
        : this.fallbackSimulationGeometry(segment);
      const interpolatedTimes = this.interpolateSegmentTimes(segment, displayedPoints);
      if (segmentIndex > 0 && this.validTripGoLocation(segment.from)) {
        const geometryStart = displayedPoints[0];
        points.push({
          kind: 'segment',
          location: this.validTripGoLocation(geometryStart)
            ? { ...segment.from, latitude: geometryStart.latitude, longitude: geometryStart.longitude }
            : segment.from,
          title: segment.from.name || segment.from.address || this.transloco.translate('common.tripGo.simulation.routePoint'),
          time: segment.startTime,
          segment,
          showOverlay: true,
          showWeather: true
        });
      }

      for (let pointIndex = 0; pointIndex < displayedPoints.length; pointIndex += 1) {
        const location = displayedPoints[pointIndex];
        const turnInstruction = turnInstructions.find((entry) =>
          this.distanceInMeters(entry.location, location) <= 3)?.instruction;
        const previousPoint = points.at(-1);
        if (this.isSameSimulationLocation(previousPoint?.location, location)) {
          if (turnInstruction && previousPoint) {
            previousPoint.turnInstruction = turnInstruction;
            previousPoint.showOverlay = true;
          }
          continue;
        }
        const intermediateStop = segment.service?.intermediateStops?.find((stop) =>
          this.isSameSimulationLocation(stop, location));
        const showGenericProgress: boolean = segment.type === 'unscheduled'
          && turnInstructions.length === 0
          && !progressOverlayAdded;
        progressOverlayAdded ||= showGenericProgress;
        points.push({
          kind: 'segment',
          location,
          title: intermediateStop?.name || turnInstruction?.streetName
            || (showGenericProgress
              ? this.transloco.translate('common.tripGo.simulation.underway')
              : segment.from?.name || segment.from?.address
                || this.transloco.translate('common.tripGo.simulation.routePoint')),
          time: intermediateStop?.actualArrivalTime || intermediateStop?.actualDepartureTime
            || intermediateStop?.arrivalTime || intermediateStop?.departureTime
            || interpolatedTimes[pointIndex] || segment.startTime,
          segment,
          turnInstruction,
          updateOverlay: showGenericProgress,
          showOverlay: !!intermediateStop || !!turnInstruction
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
      showOverlay: true,
      showWeather: true
    });
    return points;
  }

  private showSimulationPoint(index: number, initial = false): void {
    const point = this.simulationPoints[index];
    if (!point || !this.map) return;
    const previousPoint = this.simulationPoints[this.simulationIndex];
    this.clearSimulationTimer();
    this.simulationIndex = index;
    if (point.showOverlay || point.updateOverlay) {
      this.activeSimulationPoint.set(point);
    }

    const animate = !this.prefersReducedMotion();
    const movementDuration = animate ? this.simulationMovementDuration(index, initial, point.showOverlay) : 0;
    const targetZoom = this.simulationZoom(point);
    if (initial && this.validTripGoLocation(point.location)) {
      const target = leaflet.latLng(point.location.latitude, point.location.longitude);
      const zoom = targetZoom ?? this.map.getZoom();
      const alreadyAtStart = this.map.distance(this.map.getCenter(), target) < 1
        && this.map.getZoom() === zoom;
      if (!alreadyAtStart) {
        // Move and zoom in one operation. Zooming at the route overview first
        // and panning afterwards looked like a detour via an unrelated place.
        this.map.setView(target, zoom, { animate, duration: movementDuration });
      }
    } else if (targetZoom !== undefined && this.map.getZoom() !== targetZoom) {
      this.map.setZoom(targetZoom, { animate });
    }
    this.moveSimulationMarker(point, movementDuration, previousPoint?.time);
    const movementDelayMs = Math.round(movementDuration * 1_000);
    const stopDelayMs = point.showOverlay
      ? (this.prefersReducedMotion() ? 1_500 : 3_000)
      : (this.prefersReducedMotion() ? 0 : 70);
    // Wait until the cursor has actually reached the new geometry point. This is
    // especially important for intermediate stops: otherwise their overlay delay
    // can end before a longer movement and the following leg cuts across the line.
    this.currentSimulationDelayMs = movementDelayMs + stopDelayMs;
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
        this.showNextSimulationLeg();
      }
    }, this.currentSimulationDelayMs);
  }

  /**
   * Moves through all geometry points of one TripGo segment in a single
   * animation. Starting a separate animation for every geometry point caused
   * a visible stop-and-go effect, especially for detailed walking geometries.
   */
  private showNextSimulationLeg(): void {
    const nextIndex = this.simulationIndex + 1;
    const nextPoint = this.simulationPoints[nextIndex];
    if (!nextPoint) {
      this.finishSimulation();
      return;
    }

    const currentPoint = this.simulationPoints[this.simulationIndex];
    const startsNewSegment = nextPoint.kind === 'arrival'
      || !nextPoint.segment
      || nextPoint.segment !== currentPoint?.segment;
    if (startsNewSegment) {
      this.showSimulationPoint(nextIndex);
      return;
    }

    let endIndex = nextIndex;
    while (endIndex + 1 < this.simulationPoints.length) {
      const candidate = this.simulationPoints[endIndex + 1];
      if (candidate.kind === 'arrival' || candidate.segment !== nextPoint.segment) break;
      endIndex += 1;
    }
    this.animateSimulationRange(nextIndex, endIndex, nextPoint.segment!);
  }

  private animateSimulationRange(
    startIndex: number,
    endIndex: number,
    segment: TripGoRouteSegment
  ): void {
    if (!this.map || !this.simulationMarker) {
      this.showSimulationPoint(startIndex);
      return;
    }
    this.clearSimulationTimer();
    this.cancelSimulationAnimation();

    const path: Array<{ index: number; point: TripGoSimulationPoint; latLng: leaflet.LatLng }> = [{
      index: this.simulationIndex,
      point: {
        ...this.simulationPoints[this.simulationIndex],
        time: this.simulatedTime() || this.simulationPoints[this.simulationIndex]?.time
      },
      latLng: this.simulationMarker.getLatLng()
    }];
    for (let index = startIndex; index <= endIndex; index += 1) {
      const point = this.simulationPoints[index];
      if (!point || !this.validTripGoLocation(point.location)) continue;
      const latLng = leaflet.latLng(point.location.latitude, point.location.longitude);
      if (latLng.distanceTo(path.at(-1)!.latLng) < .05) {
        path[path.length - 1] = { index, point, latLng };
      } else {
        path.push({ index, point, latLng });
      }
    }
    if (path.length < 2 || this.prefersReducedMotion()) {
      this.showSimulationPoint(endIndex);
      return;
    }

    const projectionZoom = this.map.getZoom();
    const projected = path.map(({ latLng }) => this.map!.project(latLng, projectionZoom));
    const distances = [0];
    for (let index = 1; index < path.length; index += 1) {
      distances[index] = distances[index - 1] + path[index - 1].latLng.distanceTo(path[index].latLng);
    }
    const distanceMeters = distances.at(-1) || 0;
    if (distanceMeters <= 0) {
      this.showSimulationPoint(endIndex);
      return;
    }

    const durationMilliseconds = this.simulationRangeDuration(segment, distanceMeters) * 1_000;
    const startedAt = performance.now();
    let reachedPathIndex = 0;
    this.currentSimulationDelayMs = 0;
    this.setSimulationCursorIcon(tripGoSegmentIcon(segment));
    const targetZoom = this.simulationZoom(path[1].point);
    if (targetZoom !== undefined && this.map.getZoom() !== targetZoom) {
      this.map.setZoom(targetZoom, { animate: true });
    }

    const animateFrame = (timestamp: number): void => {
      if (!this.map || !this.simulationMarker) return;
      const progress = Math.min(1, (timestamp - startedAt) / durationMilliseconds);
      const travelled = distanceMeters * progress;
      while (reachedPathIndex + 1 < path.length && distances[reachedPathIndex + 1] <= travelled) {
        reachedPathIndex += 1;
        this.applySimulationMilestone(path[reachedPathIndex]);
      }

      const targetPathIndex = Math.min(path.length - 1, reachedPathIndex + 1);
      const edgeStartDistance = distances[reachedPathIndex];
      const edgeDistance = Math.max(0.0001, distances[targetPathIndex] - edgeStartDistance);
      const edgeProgress = targetPathIndex === reachedPathIndex
        ? 1
        : Math.min(1, Math.max(0, (travelled - edgeStartDistance) / edgeDistance));
      const projectedStart = projected[reachedPathIndex];
      const projectedTarget = projected[targetPathIndex];
      const current = this.map.unproject(leaflet.point(
        projectedStart.x + (projectedTarget.x - projectedStart.x) * edgeProgress,
        projectedStart.y + (projectedTarget.y - projectedStart.y) * edgeProgress
      ), projectionZoom);
      this.simulationMarker.setLatLng(current);
      // Keep marker and camera in the same animation frame. Updating the marker
      // at 60 fps but the map only at 30 fps made the cursor alternate between
      // moving away from the centre and snapping back to it.
      this.map.panTo(current, { animate: false });
      this.updateSimulatedTime(
        path[reachedPathIndex].point?.time || this.simulatedTime() || undefined,
        path[targetPathIndex].point?.time,
        edgeProgress
      );

      if (progress < 1) {
        this.simulationAnimationFrame = requestAnimationFrame(animateFrame);
        return;
      }

      while (reachedPathIndex + 1 < path.length) {
        reachedPathIndex += 1;
        this.applySimulationMilestone(path[reachedPathIndex]);
      }
      this.simulationIndex = endIndex;
      this.simulationAnimationFrame = undefined;
      this.currentSimulationDelayMs = 0;
      this.scheduleWikipediaLoad();
      if (this.simulationState === 'playing') this.scheduleNextSimulationPoint();
    };
    this.simulationAnimationFrame = requestAnimationFrame(animateFrame);
  }

  private applySimulationMilestone(entry: { index: number; point: TripGoSimulationPoint }): void {
    this.simulationIndex = entry.index;
    if (entry.point.showOverlay || entry.point.updateOverlay) {
      this.activeSimulationPoint.set(entry.point);
    }
  }

  private simulationRangeDuration(segment: TripGoRouteSegment, distanceMeters: number): number {
    const segmentDistance = this.segmentGeometryDistance(segment);
    const identifier = `${segment.modeIdentifier || ''} ${tripGoSegmentIcon(segment)}`;
    let compression = 45;
    let fallbackMetersPerSecond = 250;
    let minimumDuration = 3;
    let maximumDuration = 600;

    if (identifier.includes('walk')) {
      compression = 18;
      fallbackMetersPerSecond = 45;
      maximumDuration = 900;
    } else if (identifier.includes('bic') || identifier.includes('bike')) {
      compression = 30;
      fallbackMetersPerSecond = 110;
      maximumDuration = 900;
    } else if (identifier.includes('car')) {
      compression = 45;
      fallbackMetersPerSecond = 250;
      maximumDuration = 900;
    } else if (identifier.includes('train') || identifier.includes('subway')) {
      compression = 60;
      fallbackMetersPerSecond = 450;
      minimumDuration = 4;
      maximumDuration = 600;
    } else if (identifier.includes('flight') || identifier.includes('air')) {
      compression = 120;
      fallbackMetersPerSecond = 1_500;
      minimumDuration = 4;
      maximumDuration = 120;
    }

    // Limit only unusually long complete segments. Small caps made an hour-long
    // route rush past in a few seconds and left no time to notice nearby places.
    const fullDuration = segment.durationSeconds
      ? Math.min(maximumDuration, Math.max(minimumDuration, segment.durationSeconds / compression))
      : Math.min(maximumDuration, Math.max(minimumDuration, segmentDistance / fallbackMetersPerSecond));
    if (segmentDistance <= 0) return Math.max(.1, distanceMeters / fallbackMetersPerSecond);
    return Math.max(.1, fullDuration * distanceMeters / segmentDistance);
  }

  private finishSimulation(): void {
    this.clearSimulationTimer();
    this.cancelSimulationAnimation();
    this.removeSimulationMarker();
    this.activeSimulationPoint.set(null);
    this.simulatedTime.set(null);
    this.simulationIndex = -1;
    this.setSimulationState('idle');
    this.showEntireRoute();
    this.finishWikipediaSuppression();
  }

  private finishWikipediaSuppression(): void {
    if (!this.wikipediaSuppressedForSimulation) return;
    this.wikipediaSuppressedForSimulation = false;
    this.scheduleWikipediaLoad();
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
      case 'directions_bike':
        return 18;
      case 'directions_car':
        return 16;
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

  private moveSimulationMarker(
    point: TripGoSimulationPoint,
    durationSeconds: number,
    previousTime?: string
  ): void {
    if (!this.map) return;
    const latLng = leaflet.latLng(Number(point.location.latitude), Number(point.location.longitude));
    const cursorIcon = point.kind === 'arrival'
      ? 'location_on'
      : point.segment
        ? tripGoSegmentIcon(point.segment)
        : 'gps_fixed';
    if (this.simulationMarker) {
      this.setSimulationCursorIcon(cursorIcon);
      this.animateSimulationMovement(latLng, durationSeconds, previousTime, point.time);
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
    this.simulatedTime.set(point.time || null);
  }

  private setSimulationCursorIcon(icon: string): void {
    const iconElement = this.simulationMarker?.getElement()
      ?.querySelector<HTMLElement>('.material-symbols-outlined');
    if (iconElement) iconElement.textContent = icon;
  }

  private removeSimulationMarker(): void {
    if (this.simulationMarker && this.map) {
      this.simulationMarker.removeFrom(this.map);
    }
    this.simulationMarker = undefined;
  }

  private animateSimulationMovement(
    target: leaflet.LatLng,
    durationSeconds: number,
    startTime?: string,
    endTime?: string
  ): void {
    if (!this.map || !this.simulationMarker) return;
    this.cancelSimulationAnimation();
    const start = this.simulationMarker.getLatLng();
    if (durationSeconds <= 0) {
      this.simulationMarker.setLatLng(target);
      this.map.panTo(target, { animate: false });
      this.simulatedTime.set(endTime || startTime || null);
      return;
    }

    const startedAt = performance.now();
    const durationMilliseconds = durationSeconds * 1_000;
    const projectionZoom = this.map.getZoom();
    const projectedStart = this.map.project(start, projectionZoom);
    const projectedTarget = this.map.project(target, projectionZoom);
    const animateFrame = (timestamp: number): void => {
      if (!this.map || !this.simulationMarker) return;
      const progress = Math.min(1, (timestamp - startedAt) / durationMilliseconds);
      // Leaflet renders a polyline as a straight segment in projected map
      // coordinates. Interpolating there keeps the marker exactly on that line;
      // a linear latitude/longitude interpolation can visibly drift beside it.
      const current = this.map.unproject(leaflet.point(
        projectedStart.x + (projectedTarget.x - projectedStart.x) * progress,
        projectedStart.y + (projectedTarget.y - projectedStart.y) * progress
      ), projectionZoom);
      this.simulationMarker.setLatLng(current);
      this.map.panTo(current, { animate: false });
      this.updateSimulatedTime(startTime, endTime, progress);
      if (progress < 1) {
        this.simulationAnimationFrame = requestAnimationFrame(animateFrame);
      } else {
        this.simulationAnimationFrame = undefined;
        this.scheduleWikipediaLoad();
      }
    };
    this.simulationAnimationFrame = requestAnimationFrame(animateFrame);
  }

  private updateSimulatedTime(startTime: string | undefined, endTime: string | undefined, progress: number): void {
    const start = startTime ? Date.parse(startTime) : Number.NaN;
    const end = endTime ? Date.parse(endTime) : Number.NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      if (progress >= 1) this.simulatedTime.set(endTime || startTime || null);
      return;
    }
    const value = start + (end - start) * progress;
    const current = this.simulatedTime() ? Date.parse(this.simulatedTime()!) : Number.NaN;
    if (progress >= 1 || !Number.isFinite(current) || Math.floor(current / 60_000) !== Math.floor(value / 60_000)) {
      this.simulatedTime.set(new Date(value).toISOString());
    }
  }

  private interpolateSegmentTimes(segment: TripGoRouteSegment, points: TripGoLocation[]): Array<string | undefined> {
    const startValue = segment.startTime || segment.scheduledStartTime;
    const endValue = segment.endTime || segment.scheduledEndTime;
    const start = startValue ? Date.parse(startValue) : Number.NaN;
    const end = endValue ? Date.parse(endValue) : Number.NaN;
    if (!points.length || !Number.isFinite(start) || !Number.isFinite(end)) {
      return points.map(() => startValue);
    }
    const distances = [0];
    for (let index = 1; index < points.length; index += 1) {
      distances[index] = distances[index - 1] + this.distanceInMeters(points[index - 1], points[index]);
    }
    const totalDistance = distances.at(-1) || 0;
    return distances.map((distance, index) => {
      const progress = totalDistance > 0 ? distance / totalDistance : index / Math.max(1, points.length - 1);
      return new Date(start + (end - start) * progress).toISOString();
    });
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

  private turnInstructionsWithLocations(segment: TripGoRouteSegment): {
    instruction: TripGoTurnInstruction;
    location: TripGoLocation & { latitude: number; longitude: number };
  }[] {
    return (segment.turnInstructions || []).flatMap((instruction) => {
      if (!instruction.encodedGeometry) return [];
      const firstPoint = decodePolyline(instruction.encodedGeometry)[0];
      return firstPoint ? [{
        instruction,
        location: { latitude: firstPoint[0], longitude: firstPoint[1] }
      }] : [];
    });
  }

  private segmentGeometryLocations(segment: TripGoRouteSegment): TripGoLocation[] {
    if (!this.segmentGeometryLocationsCache) {
      const geometries = this.route.segments.map((routeSegment) =>
        this.rawSegmentGeometryLocations(routeSegment));
      const snappedGeometries = snapNearbyGeometryBoundaries(
        geometries,
        10,
        this.route.segments.map((routeSegment) => routeSegment.from)
      );
      this.segmentGeometryLocationsCache = new Map(this.route.segments.map((routeSegment, index) =>
        [routeSegment, snappedGeometries[index]]));
    }
    return this.segmentGeometryLocationsCache.get(segment) || [];
  }

  private rawSegmentGeometryLocations(segment: TripGoRouteSegment): TripGoLocation[] {
    const detailedGeometry = (segment.detailedGeometry || []).filter((location) =>
      this.validTripGoLocation(location));
    const geometry = detailedGeometry.length >= 2 ? detailedGeometry : segment.geometry
      .flatMap((encodedPath) => decodePolyline(encodedPath))
      .map(([latitude, longitude]) => ({ latitude, longitude }));
    return insertStopsIntoGeometry(geometry, segment.service?.intermediateStops || []);
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
      const detailedPoints = this.segmentGeometryLocations(segment)
        .filter((location) => this.validTripGoLocation(location))
        .map((location): leaflet.LatLngTuple => [location.latitude, location.longitude]);
      if (detailedPoints.length >= 2) {
        leaflet.polyline(detailedPoints, { color: '#ffffff', weight: 9, opacity: 0.8 }).addTo(this.map!);
        leaflet.polyline(detailedPoints, { color, weight: 6, opacity: 0.9 }).addTo(this.map!);
        for (const point of detailedPoints) bounds.extend(point);
      } else {
        this.drawGeometryFallback(segment, color, bounds);
      }
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

    this.addPublicTransportStopMarkers(bounds);
  }

  private addIntermediateStopMarkers(
    segment: TripGoRouteSegment,
    segmentIndex: number,
    bounds: leaflet.LatLngBounds
  ): void {
    const color = safeColor(segment.color);
    for (const stop of segment.service?.intermediateStops || []) {
      if (!this.validTripGoLocation(stop)) continue;
      // Stops with a TripGo stop code receive the full, clickable transport
      // pin below. Keep the circle only as a fallback for incomplete data.
      if (stop.stopCode) continue;
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

  private addPublicTransportStopMarkers(bounds: leaflet.LatLngBounds): void {
    for (const stop of this.routePublicTransportStops()) {
      const marker = leaflet.marker([stop.latitude, stop.longitude], {
        icon: publicTransportStopMarker(stop),
        title: stop.name,
        alt: stop.name,
        zIndexOffset: 2_000
      }).addTo(this.map!);
      marker.on('click', (event) => {
        leaflet.DomEvent.stopPropagation(event.originalEvent);
        this.pauseSimulation();
        this.stopSelected.emit(stop);
      });
      const tooltip = document.createElement('span');
      tooltip.textContent = stop.name;
      marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -16] });
      bounds.extend([stop.latitude, stop.longitude]);
    }
  }

  private addZoomLevelButton(): void {
    const container = this.map?.zoomControl.getContainer();
    if (!container) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'leaflet-control-zoom-level-button';
    button.addEventListener('click', () => this.searchSettingsClick.emit());
    leaflet.DomEvent.disableClickPropagation(button);
    leaflet.DomEvent.disableScrollPropagation(button);
    container.appendChild(button);
    this.zoomLevelButton = button;
    this.updateZoomLevelButton();
  }

  private updateZoomLevelButton(): void {
    if (!this.map || !this.zoomLevelButton) return;
    const zoomLevel = String(Math.round(this.map.getZoom())).padStart(2, '0');
    const label = this.transloco.translate('common.menu.searchSettings');
    this.zoomLevelButton.textContent = zoomLevel;
    this.zoomLevelButton.title = label;
    this.zoomLevelButton.setAttribute('aria-label', `${label}: ${zoomLevel}`);
  }

  private shouldPrepareWikipediaForSimulation(): boolean {
    return Object.values(this.searchSettings).some((setting) => setting.enabled)
      && !this.wikipediaPrepared
      && !this.wikipediaSuppressedForSimulation
      && !this.wikipediaPreparing;
  }

  private prepareWikipediaForSimulation(): void {
    if (!this.map || this.wikipediaPreparing) return;
    const searches = this.wikipediaSearchBounds();
    if (!searches.length) {
      this.wikipediaPrepared = true;
      this.beginSimulation();
      return;
    }

    this.wikipediaPreparing = true;
    this.wikipediaRequest?.unsubscribe();
    this.wikipediaRequest = undefined;
    this.clearWikipediaMarkers();
    this.clearRouteContentMarkers();
    this.wikipediaPreparationCompleted.set(0);
    this.wikipediaPreparationTotal.set(searches.length);
    const firstPoint = this.simulationPoints[0];
    if (firstPoint && this.validTripGoLocation(firstPoint.location)) {
      const startZoom = this.simulationZoom(firstPoint) ?? Math.max(14, this.searchSettings.wikipedia.minZoom);
      // setView changes centre and zoom together without flyTo's intentional
      // zoom-out arc, which can look as though the map visits another place.
      this.map.setView(
        [firstPoint.location.latitude, firstPoint.location.longitude],
        startZoom,
        { animate: !this.prefersReducedMotion(), duration: 1.2 }
      );
    }

    const dialogRef = this.dialog.open(DisplayMessage, {
      data: {
        showAlways: true,
        title: this.transloco.translate('common.tripGo.simulation.wikipediaTitle'),
        image: '',
        icon: 'menu_book',
        message: this.transloco.translate('common.tripGo.simulation.wikipediaMessage'),
        button: this.transloco.translate('common.tripGo.simulation.withoutWikipedia'),
        delay: 0,
        showSpinner: true,
        progress: this.wikipediaPreparationProgress,
        progressText: this.wikipediaPreparationText,
        primaryAction: () => this.skipWikipediaPreparation(),
        autoclose: false
      },
      width: 'min(520px, 95vw)',
      maxWidth: '95vw',
      maxHeight: '90vh',
      autoFocus: false,
      hasBackdrop: true,
      backdropClass: 'route-wikipedia-preparation-backdrop',
      disableClose: true
    });
    this.wikipediaPreparationDialog = dialogRef;

    const language = this.transloco.getActiveLang() || 'de';
    const zoom = Math.max(14, this.searchSettings.wikipedia.minZoom);
    this.wikipediaPreparation = from(searches).pipe(
      mergeMap((bounds) => forkJoin({
        articles: this.searchSettings.wikipedia.enabled
          ? this.wikipedia.getNearby({ ...bounds, zoom, language, limit: 100 }).pipe(
            retry({ count: 2, delay: (_error, retryCount) => timer(retryCount * 1_500) }),
            map((response) => response.articles),
            catchError(() => of([] as WikipediaArticle[])))
          : of([] as WikipediaArticle[]),
        content: from(this.routeContent.loadBounds(this.toBoundingBox(bounds), this.searchSettings, 19))
          .pipe(catchError(() => of(structuredClone(EMPTY_ROUTE_CONTENT))))
      }).pipe(
        tap(() => this.wikipediaPreparationCompleted.update((value) => value + 1))
      ), 1),
      toArray()
    ).subscribe({
      next: (results) => {
        if (!this.wikipediaPreparing) return;
        const uniqueArticles = new Map<number, WikipediaArticle>();
        results.flatMap((result) => result.articles).forEach((article) => {
          if (this.distanceToRouteInMeters(article) <= WIKIPEDIA_ROUTE_RADIUS_METERS) {
            uniqueArticles.set(article.pageId, article);
          }
        });
        this.preparedWikipediaArticles = [...uniqueArticles.values()];
        this.preparedRouteContent = this.mergeRouteContent(results.map((result) => result.content));
        this.wikipediaPrepared = true;
        this.wikipediaPreparing = false;
        this.wikipediaPreparation = undefined;
        this.wikipediaPreparationDialog?.close();
        this.wikipediaPreparationDialog = undefined;
        this.renderPreparedWikipediaMarkers();
        this.renderPreparedRouteContentMarkers();
        this.beginSimulation();
      }
    });
  }

  private skipWikipediaPreparation(): void {
    if (!this.wikipediaPreparing) return;
    this.wikipediaPreparation?.unsubscribe();
    this.wikipediaPreparation = undefined;
    this.wikipediaPreparing = false;
    this.wikipediaSuppressedForSimulation = true;
    this.preparedWikipediaArticles = [];
    this.preparedRouteContent = structuredClone(EMPTY_ROUTE_CONTENT);
    this.clearWikipediaMarkers();
    this.clearRouteContentMarkers();
    this.beginSimulation();
  }

  private wikipediaSearchBounds(): Array<{ north: number; south: number; east: number; west: number }> {
    const routeLines: Array<{ points: TripGoLocation[]; intervalMeters?: number }> = [];
    for (const segment of this.route.segments) {
      const icon = tripGoSegmentIcon(segment);
      const publicTransport = segment.type === 'scheduled'
        || ['directions_bus', 'tram', 'subway', 'train', 'directions_boat', 'flight']
          .includes(icon);
      if (publicTransport || segment.type === 'stationary') {
        const stops = [
          segment.from,
          ...(segment.service?.intermediateStops || []),
          segment.to
        ].filter((location) => this.validTripGoLocation(location));
        stops.forEach((location) => routeLines.push({ points: [location] }));
        continue;
      }
      const geometry = this.segmentGeometryLocations(segment).filter((point) => this.validTripGoLocation(point));
      const line = geometry.length ? geometry : this.fallbackSimulationGeometry(segment);
      if (line.length) routeLines.push({
        points: line,
        intervalMeters: this.wikipediaSearchIntervalMeters(icon)
      });
    }
    if (!routeLines.length) return [];

    // Walking and cycling retain the dense two-kilometre sampling and cars use
    // a wider grid. Public transport is searched only at the boarding,
    // intermediate and alighting stops collected above.
    const centers: TripGoLocation[] = [];
    for (const { points: line, intervalMeters } of routeLines) {
      centers.push(line[0]);
      if (!intervalMeters) continue;
      let distanceSinceCenter = 0;
      for (let index = 1; index < line.length; index += 1) {
        const start = line[index - 1];
        const end = line[index];
        const distance = this.distanceInMeters(start, end);
        if (!Number.isFinite(distance) || distance <= 0) continue;
        let consumed = 0;
        while (distanceSinceCenter + distance - consumed >= intervalMeters) {
          const needed = intervalMeters - distanceSinceCenter;
          consumed += needed;
          const ratio = Math.min(1, consumed / distance);
          centers.push({
            latitude: Number(start.latitude) + (Number(end.latitude) - Number(start.latitude)) * ratio,
            longitude: Number(start.longitude) + (Number(end.longitude) - Number(start.longitude)) * ratio
          });
          distanceSinceCenter = 0;
        }
        distanceSinceCenter += distance - consumed;
      }
      const lastPoint = line.at(-1)!;
      if (this.distanceInMeters(centers.at(-1)!, lastPoint) > 1_000) centers.push(lastPoint);
    }

    const uniqueCenters = centers.filter((center, index) => centers.findIndex((candidate) =>
      this.distanceInMeters(center, candidate) < 500) === index);
    const limitedCenters = uniqueCenters.length <= MAX_WIKIPEDIA_SIMULATION_SEARCHES
      ? uniqueCenters
      : Array.from({ length: MAX_WIKIPEDIA_SIMULATION_SEARCHES }, (_, index) =>
        uniqueCenters[Math.round(index * (uniqueCenters.length - 1)
          / (MAX_WIKIPEDIA_SIMULATION_SEARCHES - 1))]);
    const halfSizeMeters = 1_300;
    return limitedCenters.map((center) => {
      const latitudeDelta = halfSizeMeters / 110_540;
      const longitudeDelta = halfSizeMeters
        / Math.max(1, 111_320 * Math.cos(Number(center.latitude) * Math.PI / 180));
      return {
        north: Math.min(90, Number(center.latitude) + latitudeDelta),
        south: Math.max(-90, Number(center.latitude) - latitudeDelta),
        east: Math.min(180, Number(center.longitude) + longitudeDelta),
        west: Math.max(-180, Number(center.longitude) - longitudeDelta)
      };
    });
  }

  private wikipediaSearchIntervalMeters(icon: string): number {
    switch (icon) {
      case 'directions_walk':
      case 'directions_bike':
        return 2_000;
      case 'directions_car':
        return 15_000;
      default:
        return 10_000;
    }
  }

  private renderPreparedWikipediaMarkers(): void {
    if (!this.map || !this.wikipediaPrepared || !this.searchSettings.wikipedia.enabled
      || this.map.getZoom() < this.searchSettings.wikipedia.minZoom) {
      this.clearWikipediaMarkers();
      return;
    }
    this.drawWikipediaMarkers(this.preparedWikipediaArticles);
  }

  private resetWikipediaPreparation(): void {
    this.wikipediaPreparation?.unsubscribe();
    this.wikipediaPreparation = undefined;
    this.wikipediaPreparationDialog?.close();
    this.wikipediaPreparationDialog = undefined;
    this.wikipediaPreparing = false;
    this.wikipediaPrepared = false;
    this.wikipediaSuppressedForSimulation = false;
    this.preparedWikipediaArticles = [];
    this.preparedRouteContent = structuredClone(EMPTY_ROUTE_CONTENT);
    this.clearRouteContentMarkers();
    this.wikipediaPreparationCompleted.set(0);
    this.wikipediaPreparationTotal.set(0);
  }

  private scheduleWikipediaLoad(): void {
    if (this.wikipediaLoadTimer) clearTimeout(this.wikipediaLoadTimer);
    this.wikipediaLoadTimer = setTimeout(() => this.loadWikipediaMarkers(), 200);
  }

  private loadWikipediaMarkers(): void {
    this.wikipediaLoadTimer = undefined;
    if (this.wikipediaPreparing || this.wikipediaSuppressedForSimulation) {
      this.clearWikipediaMarkers();
      this.clearRouteContentMarkers();
      return;
    }
    if (this.wikipediaPrepared) {
      this.renderPreparedWikipediaMarkers();
      this.renderPreparedRouteContentMarkers();
      return;
    }
    this.loadRouteContentMarkersForCurrentView();
    if (!this.map || !this.searchSettings.wikipedia.enabled
      || this.map.getZoom() < this.searchSettings.wikipedia.minZoom) {
      this.wikipediaRequest?.unsubscribe();
      this.wikipediaRequest = undefined;
      this.clearWikipediaMarkers();
      return;
    }
    const bounds = this.map.getBounds();
    if (bounds.getWest() > bounds.getEast()) return;
    this.wikipediaRequest?.unsubscribe();
    this.wikipediaRequest = this.wikipedia.getNearby({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
      zoom: Math.round(this.map.getZoom()),
      language: this.transloco.getActiveLang() || 'de',
      limit: 100
    }).subscribe({
      next: (response) => {
        const articles = response.articles.filter((article) =>
          this.distanceToRouteInMeters(article) <= WIKIPEDIA_ROUTE_RADIUS_METERS);
        this.drawWikipediaMarkers(articles);
      },
      error: () => this.clearWikipediaMarkers()
    });
  }

  private drawWikipediaMarkers(articles: WikipediaArticle[]): void {
    this.clearWikipediaMarkers();
    if (!this.map) return;
    for (const article of articles) {
      const marker = leaflet.marker([article.latitude, article.longitude], {
        icon: wikipediaMarker,
        title: article.title,
        alt: article.title,
        zIndexOffset: 1_500
      }).addTo(this.map);
      marker.on('click', (event) => {
        leaflet.DomEvent.stopPropagation(event.originalEvent);
        this.pauseSimulation();
        this.wikipediaSelected.emit([article]);
      });
      const tooltip = document.createElement('span');
      tooltip.textContent = article.title;
      marker.bindTooltip(tooltip, { direction: 'top', offset: [0, -16] });
      this.wikipediaMarkers.push(marker);
    }
  }

  private clearWikipediaMarkers(): void {
    for (const marker of this.wikipediaMarkers) marker.remove();
    this.wikipediaMarkers = [];
  }

  private loadRouteContentMarkersForCurrentView(): void {
    if (!this.map) return;
    const bounds = this.map.getBounds();
    if (bounds.getWest() > bounds.getEast()) return;
    const token = ++this.routeContentLoadToken;
    const zoom = Math.round(this.map.getZoom());
    void this.routeContent.loadBounds({
      latMin: bounds.getSouth(),
      lonMin: bounds.getWest(),
      latMax: bounds.getNorth(),
      lonMax: bounds.getEast()
    }, this.searchSettings, zoom).then((content) => {
      if (token !== this.routeContentLoadToken || this.wikipediaPrepared || this.wikipediaPreparing) return;
      this.drawRouteContentMarkers(this.filterRouteContent(content), zoom);
    }).catch(() => {
      if (token === this.routeContentLoadToken) this.clearRouteContentMarkers();
    });
  }

  private renderPreparedRouteContentMarkers(): void {
    if (!this.map || !this.wikipediaPrepared) {
      this.clearRouteContentMarkers();
      return;
    }
    this.drawRouteContentMarkers(this.preparedRouteContent, Math.round(this.map.getZoom()));
  }

  private drawRouteContentMarkers(content: TripGoRouteContent, zoom: number): void {
    this.clearRouteContentMarkers();
    if (!this.map) return;
    const groups = new Map<string, MarkerLocation>();
    const add = (
      type: MarkerType,
      item: unknown,
      location?: Location,
      keyOverride?: string,
      overpassGrouped = false
    ) => {
      if (!location || !Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) return;
      const key = keyOverride || `${Number(location.latitude).toFixed(5)}:${Number(location.longitude).toFixed(5)}`;
      let group = groups.get(key);
      if (!group) {
        group = {
          location: { ...location, plusCode: location.plusCode || `route:${key}` },
          messages: [], notes: [], images: [], documents: [], experiences: [], myExperiences: [], secretDrops: [],
          overpassPois: [], overpassGrouped,
          type
        };
        groups.set(key, group);
      } else if (group.type !== type) {
        group.type = MarkerType.MULTI;
      }
      switch (type) {
        case MarkerType.PUBLIC_MESSAGE: group.messages.push(item as typeof group.messages[number]); break;
        case MarkerType.PRIVATE_NOTE: group.notes.push(item as typeof group.notes[number]); break;
        case MarkerType.PRIVATE_IMAGE: group.images.push(item as typeof group.images[number]); break;
        case MarkerType.PRIVATE_DOCUMENT: group.documents.push(item as typeof group.documents[number]); break;
        case MarkerType.EXPERIENCE_DESTINATION: group.experiences?.push(item as NonNullable<typeof group.experiences>[number]); break;
        case MarkerType.MY_EXPERIENCE: group.myExperiences?.push(item as NonNullable<typeof group.myExperiences>[number]); break;
        case MarkerType.SECRET_DROP: group.secretDrops?.push(item as NonNullable<typeof group.secretDrops>[number]); break;
        case MarkerType.OVERPASS_POI:
          group.overpassPoi ??= item as NonNullable<typeof group.overpassPoi>;
          group.overpassPois?.push(item as NonNullable<typeof group.overpassPois>[number]);
          group.overpassGrouped ||= overpassGrouped || (group.overpassPois?.length ?? 0) > 1;
          break;
      }
    };

    if (this.routeContentVisible('publicMessages', zoom)) {
      content.messages.forEach((item) => add(MarkerType.PUBLIC_MESSAGE, item, item.location));
    }
    if (this.routeContentVisible('privateNotes', zoom)) {
      content.notes.forEach((item) => add(MarkerType.PRIVATE_NOTE, item, item.location));
    }
    if (this.routeContentVisible('privateImages', zoom)) {
      content.images.filter((item) => item.showOnMap !== false)
        .forEach((item) => add(MarkerType.PRIVATE_IMAGE, item, item.location));
    }
    if (this.routeContentVisible('privateDocuments', zoom)) {
      content.documents.forEach((item) => add(MarkerType.PRIVATE_DOCUMENT, item, item.location));
    }
    if (this.routeContentVisible('experiences', zoom)) {
      content.experiences.forEach((item) => add(MarkerType.EXPERIENCE_DESTINATION, item,
        item.center ? { latitude: item.center.latitude ?? 0, longitude: item.center.longitude ?? 0,
          plusCode: item.plusCode || '' } : undefined));
    }
    if (this.routeContentVisible('myExperiences', zoom)) {
      content.myExperiences.forEach((item) => add(MarkerType.MY_EXPERIENCE, item.result, item.location));
    }
    if (this.routeContentVisible('secretDrops', zoom)) {
      content.secretDrops.filter((item) => (item.discoveryZoomLevel ?? 18) <= zoom).forEach((item) =>
        add(MarkerType.SECRET_DROP, item, {
          latitude: Number(item.latitude ?? item.location?.latitude),
          longitude: Number(item.longitude ?? item.location?.longitude),
          plusCode: item.plusCode || item.discoveryPlusCode || item.location?.plusCode || ''
        }));
    }
    content.overpassPois.forEach((poi) => {
      if (!this.routeContentVisible(poi.category, zoom)
        || !this.searchSettings[poi.category].subcategories[poi.subtype]) return;
      const sourceLocation: Location = {
        latitude: poi.latitude,
        longitude: poi.longitude,
        plusCode: this.geolocation.getPlusCode(poi.latitude, poi.longitude)
      };
      if (zoom > 17) {
        // Separate OSM objects can share practically the same coordinates.
        // A Plus-Code boundary can run directly between two practically
        // adjacent objects. Prefer an existing nearby POI group in that case
        // so their pins cannot cover each other during the simulation.
        const nearbyGroupKey = [...groups.entries()].find(([, group]) =>
          (group.overpassPois?.length ?? 0) > 0
          && this.geolocation.areLocationsNear(
            group.location,
            sourceLocation,
            OVERPASS_POI_GROUP_RADIUS_METERS
          ))?.[0];
        add(
          MarkerType.OVERPASS_POI,
          poi,
          sourceLocation,
          nearbyGroupKey || `overpass-location:${sourceLocation.plusCode}`
        );
        return;
      }
      const plusCode = this.geolocation.getGroupedPlusCodeBasedOnMapZoom(sourceLocation, zoom);
      const area = this.geolocation.getGridFromPlusCode(plusCode);
      add(MarkerType.OVERPASS_POI, poi, {
        latitude: area.latitudeCenter,
        longitude: area.longitudeCenter,
        plusCode
      }, `overpass-group:${plusCode}`, true);
    });

    groups.forEach((group) => {
      const icon = group.type === MarkerType.OVERPASS_POI && group.overpassPoi
        ? (group.overpassGrouped ? overpassPlacesMarker() : overpassPoiMarker(group.overpassPoi))
        : routeContentIcons[group.type] ?? routeContentIcons[MarkerType.MULTI];
      if (!icon) return;
      const marker = leaflet.marker([group.location.latitude, group.location.longitude], {
        icon, zIndexOffset: 1_450
      }).addTo(this.map!);
      marker.on('click', (event) => {
        leaflet.DomEvent.stopPropagation(event.originalEvent);
        this.pauseSimulation();
        this.routeContentSelected.emit(group);
      });
      this.routeContentMarkers.push(marker);
    });
  }

  private clearRouteContentMarkers(): void {
    this.routeContentLoadToken += 1;
    for (const marker of this.routeContentMarkers) marker.remove();
    this.routeContentMarkers = [];
  }

  private routeContentVisible(key: keyof SearchSettings, zoom: number): boolean {
    const setting = this.searchSettings[key];
    return setting.enabled && zoom >= setting.minZoom;
  }

  private filterRouteContent(content: TripGoRouteContent): TripGoRouteContent {
    return {
      messages: content.messages.filter((item) => this.distanceToRouteInMeters(item.location) <= WIKIPEDIA_ROUTE_RADIUS_METERS),
      notes: content.notes.filter((item) => this.distanceToRouteInMeters(item.location) <= WIKIPEDIA_ROUTE_RADIUS_METERS),
      images: content.images.filter((item) => this.distanceToRouteInMeters(item.location) <= WIKIPEDIA_ROUTE_RADIUS_METERS),
      documents: content.documents.filter((item) => this.distanceToRouteInMeters(item.location) <= WIKIPEDIA_ROUTE_RADIUS_METERS),
      experiences: content.experiences.filter((item) => item.center
        && this.distanceToRouteInMeters(item.center as TripGoLocation) <= WIKIPEDIA_ROUTE_RADIUS_METERS),
      myExperiences: content.myExperiences.filter((item) =>
        this.distanceToRouteInMeters(item.location) <= WIKIPEDIA_ROUTE_RADIUS_METERS),
      secretDrops: content.secretDrops.filter((item) => this.distanceToRouteInMeters({
        latitude: Number(item.latitude ?? item.location?.latitude),
        longitude: Number(item.longitude ?? item.location?.longitude)
      }) <= WIKIPEDIA_ROUTE_RADIUS_METERS),
      overpassPois: content.overpassPois.filter((item) =>
        this.distanceToRouteInMeters({ latitude: item.latitude, longitude: item.longitude })
          <= WIKIPEDIA_ROUTE_RADIUS_METERS)
    };
  }

  private mergeRouteContent(contents: TripGoRouteContent[]): TripGoRouteContent {
    const unique = <T>(items: T[], key: (item: T) => string | number) =>
      [...new Map(items.map((item) => [key(item), item])).values()];
    return this.filterRouteContent({
      messages: unique(contents.flatMap((item) => item.messages), (item) => item.uuid || item.id),
      notes: unique(contents.flatMap((item) => item.notes), (item) => item.id),
      images: unique(contents.flatMap((item) => item.images), (item) => item.id),
      documents: unique(contents.flatMap((item) => item.documents), (item) => item.id),
      experiences: unique(contents.flatMap((item) => item.experiences), (item) => item.destinationId),
      myExperiences: unique(contents.flatMap((item) => item.myExperiences), (item) => item.result.productCode || item.result.trackId),
      secretDrops: unique(contents.flatMap((item) => item.secretDrops), (item) => item.uuid),
      overpassPois: unique(contents.flatMap((item) => item.overpassPois), (item) => item.id)
    });
  }

  private toBoundingBox(bounds: { north: number; south: number; east: number; west: number }) {
    return { latMin: bounds.south, lonMin: bounds.west, latMax: bounds.north, lonMax: bounds.east };
  }

  private cancelWikipediaLoad(): void {
    if (this.wikipediaLoadTimer) clearTimeout(this.wikipediaLoadTimer);
    this.wikipediaLoadTimer = undefined;
    this.wikipediaRequest?.unsubscribe();
    this.wikipediaRequest = undefined;
    this.routeContentLoadToken += 1;
  }

  private distanceToRouteInMeters(location: TripGoLocation): number {
    let shortestDistance = Number.POSITIVE_INFINITY;
    for (const segment of this.route.segments) {
      if (tripGoSegmentIcon(segment) === 'flight') {
        if (this.validTripGoLocation(segment.from)) {
          shortestDistance = Math.min(shortestDistance, this.distanceInMeters(location, segment.from));
        }
        if (this.validTripGoLocation(segment.to)) {
          shortestDistance = Math.min(shortestDistance, this.distanceInMeters(location, segment.to));
        }
        continue;
      }
      const geometry = this.segmentGeometryLocations(segment).filter((point) => this.validTripGoLocation(point));
      const points = geometry.length >= 2 ? geometry : this.fallbackSimulationGeometry(segment);
      if (points.length === 1) {
        shortestDistance = Math.min(shortestDistance, this.distanceInMeters(location, points[0]));
        continue;
      }
      for (let index = 1; index < points.length; index += 1) {
        shortestDistance = Math.min(shortestDistance,
          this.distanceToLineSegmentInMeters(location, points[index - 1], points[index]));
        if (shortestDistance <= WIKIPEDIA_ROUTE_RADIUS_METERS) return shortestDistance;
      }
    }
    return shortestDistance;
  }

  private distanceToLineSegmentInMeters(
    point: TripGoLocation,
    start: TripGoLocation,
    end: TripGoLocation
  ): number {
    const latitude = Number(point.latitude) * Math.PI / 180;
    const metersPerLongitudeDegree = 111_320 * Math.cos(latitude);
    const metersPerLatitudeDegree = 110_540;
    const startX = (Number(start.longitude) - Number(point.longitude)) * metersPerLongitudeDegree;
    const startY = (Number(start.latitude) - Number(point.latitude)) * metersPerLatitudeDegree;
    const endX = (Number(end.longitude) - Number(point.longitude)) * metersPerLongitudeDegree;
    const endY = (Number(end.latitude) - Number(point.latitude)) * metersPerLatitudeDegree;
    const deltaX = endX - startX;
    const deltaY = endY - startY;
    const squaredLength = deltaX * deltaX + deltaY * deltaY;
    const progress = squaredLength > 0
      ? Math.max(0, Math.min(1, -(startX * deltaX + startY * deltaY) / squaredLength))
      : 0;
    return Math.hypot(startX + deltaX * progress, startY + deltaY * progress);
  }

  private routePublicTransportStops(): TripGoStop[] {
    const stops: TripGoStop[] = [];
    const addStop = (
      location: TripGoLocation | undefined,
      segment: TripGoRouteSegment,
      platform?: string
    ) => {
      if (!this.validTripGoLocation(location) || !location.stopCode) return;
      const name = tripGoDisplayLocationName(location.name) || location.address || location.stopCode;
      let stop = stops.find((candidate) => candidate.region === (location.region || segment.from?.region || '')
        && (candidate.platforms.some((entry) => entry.stopCode === location.stopCode)
          || (candidate.name === name && this.distanceInMeters(candidate, location) <= 150)));
      if (!stop) {
        stop = {
          id: `${location.region || segment.from?.region || ''}|${location.stopCode}`,
          name,
          address: location.address,
          latitude: location.latitude!,
          longitude: location.longitude!,
          region: location.region || segment.from?.region || '',
          modeIdentifiers: [],
          modeIcons: [],
          modeLabels: [],
          stopTypes: [],
          services: [],
          operators: [],
          platforms: []
        };
        stops.push(stop);
      }
      this.addUnique(stop.modeIdentifiers, segment.modeIdentifier);
      this.addUnique(stop.modeIcons!, segment.icon);
      this.addUnique(stop.modeLabels, segment.modeLabel);
      this.addUnique(stop.stopTypes, segment.modeIdentifier);
      this.addUnique(stop.services, tripGoServiceLabel(segment) || segment.service?.number);
      if (segment.service?.operator) {
        const operatorId = segment.service.operatorId;
        if (!stop.operators.some((operator) => (operator.id || operator.name) === (operatorId || segment.service!.operator))) {
          stop.operators.push({ id: operatorId, name: segment.service.operator });
        }
      }
      const existingPlatform = stop.platforms.find((entry) => entry.stopCode === location.stopCode);
      if (existingPlatform) {
        this.addUnique(existingPlatform.services, tripGoServiceLabel(segment) || segment.service?.number);
      } else {
        stop.platforms.push({
          stopCode: location.stopCode,
          platform,
          latitude: location.latitude!,
          longitude: location.longitude!,
          services: [tripGoServiceLabel(segment) || segment.service?.number].filter((value): value is string => !!value)
        });
      }
    };

    for (const segment of this.route.segments) {
      if (segment.type !== 'scheduled' && !segment.modeIdentifier?.startsWith('pt_')) continue;
      addStop(segment.from, segment, segment.service?.startPlatform);
      for (const stop of segment.service?.intermediateStops || []) addStop(stop, segment, stop.platform);
      addStop(segment.to, segment, segment.service?.endPlatform);
    }
    return stops;
  }

  private addUnique(values: string[], value?: string): void {
    if (value && !values.includes(value)) values.push(value);
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

export function insertStopsIntoGeometry(
  geometry: TripGoLocation[],
  stops: TripGoLocation[]
): TripGoLocation[] {
  const valid = (location: TripGoLocation): location is TripGoLocation & { latitude: number; longitude: number } =>
    Number.isFinite(location.latitude) && Number.isFinite(location.longitude);
  const merged = geometry.filter(valid).map((location) => ({ ...location }));
  if (merged.length < 2) return merged;

  let minimumSegmentIndex = 0;
  for (const stop of stops.filter(valid)) {
    const existingIndex = merged.findIndex((point, index) => index >= minimumSegmentIndex
      && sameCoordinates(point, stop));
    if (existingIndex >= 0) {
      merged[existingIndex] = { ...merged[existingIndex], ...stop };
      minimumSegmentIndex = existingIndex;
      continue;
    }

    let bestSegmentIndex = Math.min(minimumSegmentIndex, merged.length - 2);
    let smallestDetour = Number.POSITIVE_INFINITY;
    for (let index = bestSegmentIndex; index < merged.length - 1; index += 1) {
      const detour = coordinateDistance(merged[index], stop)
        + coordinateDistance(stop, merged[index + 1])
        - coordinateDistance(merged[index], merged[index + 1]);
      if (detour < smallestDetour) {
        smallestDetour = detour;
        bestSegmentIndex = index;
      }
    }
    merged.splice(bestSegmentIndex + 1, 0, { ...stop });
    minimumSegmentIndex = bestSegmentIndex + 1;
  }
  return merged;
}

function sameCoordinates(left: TripGoLocation, right: TripGoLocation): boolean {
  return Math.abs(Number(left.latitude) - Number(right.latitude)) < 0.000001
    && Math.abs(Number(left.longitude) - Number(right.longitude)) < 0.000001;
}

function coordinateDistance(left: TripGoLocation, right: TripGoLocation): number {
  const latitudeScale = Math.cos((Number(left.latitude) + Number(right.latitude)) * Math.PI / 360);
  const latitude = Number(left.latitude) - Number(right.latitude);
  const longitude = (Number(left.longitude) - Number(right.longitude)) * latitudeScale;
  return Math.hypot(latitude, longitude);
}

export function snapNearbyGeometryBoundaries(
  geometries: TripGoLocation[][],
  maximumDistanceMeters = 10,
  preferredStarts: (TripGoLocation | undefined)[] = []
): TripGoLocation[][] {
  const snapped = geometries.map((geometry) => geometry.map((location) => ({ ...location })));
  for (let index = 1; index < snapped.length; index += 1) {
    const previousGeometry = snapped[index - 1];
    const currentGeometry = snapped[index];
    const previousEnd = previousGeometry.at(-1);
    const currentStart = currentGeometry[0];
    if (!previousEnd || !currentStart
      || locationDistanceInMeters(previousEnd, currentStart) >= maximumDistanceMeters) continue;

    const preferredStart = preferredStarts[index];
    const joint = preferredStart
      && Number.isFinite(preferredStart.latitude)
      && Number.isFinite(preferredStart.longitude)
      && locationDistanceInMeters(previousEnd, preferredStart) < maximumDistanceMeters
      && locationDistanceInMeters(currentStart, preferredStart) < maximumDistanceMeters
      ? preferredStart
      : currentStart;
    // Prefer the declared boarding position so its map marker also sits exactly
    // on the joined line. Otherwise the following geometry start is authoritative.
    previousGeometry[previousGeometry.length - 1] = {
      ...previousEnd,
      latitude: joint.latitude,
      longitude: joint.longitude
    };
    currentGeometry[0] = {
      ...currentStart,
      latitude: joint.latitude,
      longitude: joint.longitude
    };
  }
  return snapped;
}

function locationDistanceInMeters(from: TripGoLocation, to: TripGoLocation): number {
  const toRadians = (degrees: number): number => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(Number(to.latitude) - Number(from.latitude));
  const longitudeDelta = toRadians(Number(to.longitude) - Number(from.longitude));
  const firstLatitude = toRadians(Number(from.latitude));
  const secondLatitude = toRadians(Number(to.latitude));
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(haversine));
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
