import { AfterViewInit, ChangeDetectionStrategy, Component, Input, OnDestroy, output } from '@angular/core';
import * as leaflet from 'leaflet';
import { Location } from '../../interfaces/location';
import { TripGoRouteOption, TripGoRouteSegment } from '../../interfaces/tripgo';
import { tripGoSegmentIcon } from './tripgo-route.util';

export interface TripGoRouteMapPointSelection {
  kind: 'segment' | 'arrival';
  segmentIndex: number;
}

@Component({
  selector: 'app-tripgo-route-map',
  standalone: true,
  template: '<div class="route-map" [id]="mapId"></div>',
  styleUrl: './tripgo-route-map.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TripGoRouteMapComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) route!: TripGoRouteOption;
  @Input({ required: true }) origin!: Location;
  @Input({ required: true }) destination!: Location;
  readonly pointSelected = output<TripGoRouteMapPointSelection>();

  readonly mapId = `tripgo-route-map-${Math.random().toString(36).slice(2)}`;
  private map?: leaflet.Map;

  ngAfterViewInit(): void {
    this.createMap();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private createMap(): void {
    this.map = leaflet.map(this.mapId, {
      center: [this.origin.latitude, this.origin.longitude],
      zoom: 14,
      worldCopyJump: true
    });
    this.map.setMaxBounds([[-90, -180], [90, 180]]);

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
      this.map.fitBounds(bounds, { padding: [32, 32], maxZoom: 17 });
    }
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private drawRoute(bounds: leaflet.LatLngBounds): void {
    for (const segment of this.route.segments) {
      const color = safeColor(segment.color);
      let drewGeometry = false;
      for (const encodedPath of segment.geometry) {
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
        segment.from?.name,
        index,
        'segment'
      );
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
