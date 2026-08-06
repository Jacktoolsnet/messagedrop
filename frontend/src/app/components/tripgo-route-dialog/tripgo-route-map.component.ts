import { AfterViewInit, ChangeDetectionStrategy, Component, Input, OnDestroy } from '@angular/core';
import * as leaflet from 'leaflet';
import { Location } from '../../interfaces/location';
import { TripGoRouteOption } from '../../interfaces/tripgo';

const startIcon = leaflet.icon({
  iconUrl: 'assets/markers/location-marker.svg',
  iconSize: [32, 40],
  iconAnchor: [16, 40]
});

const destinationIcon = leaflet.icon({
  iconUrl: 'assets/markers/selected-marker.svg',
  iconSize: [32, 40],
  iconAnchor: [16, 40]
});

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
    this.addEndpoint(this.origin, startIcon, bounds);
    this.drawRoute(bounds);
    this.addEndpoint(this.destination, destinationIcon, bounds);

    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [32, 32], maxZoom: 17 });
    }
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private drawRoute(bounds: leaflet.LatLngBounds): void {
    for (const segment of this.route.segments) {
      const color = segment.color || '#6750a4';
      for (const encodedPath of segment.geometry) {
        const points = decodePolyline(encodedPath);
        if (points.length < 2) continue;
        leaflet.polyline(points, { color: '#ffffff', weight: 9, opacity: 0.8 }).addTo(this.map!);
        leaflet.polyline(points, { color, weight: 6, opacity: 0.9 }).addTo(this.map!);
        for (const point of points) bounds.extend(point);
      }
    }
  }

  private addEndpoint(location: Location, icon: leaflet.Icon, bounds: leaflet.LatLngBounds): void {
    const point = leaflet.latLng(location.latitude, location.longitude);
    leaflet.marker(point, { icon }).addTo(this.map!);
    bounds.extend(point);
  }
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
