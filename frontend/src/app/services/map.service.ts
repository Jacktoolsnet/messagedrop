import { EventEmitter, inject, Injectable, signal } from '@angular/core';
import * as leaflet from 'leaflet';
import { BoundingBox } from '../interfaces/bounding-box';
import { Location } from '../interfaces/location';
import { MarkerLocation } from '../interfaces/marker-location';
import { MarkerType } from '../interfaces/marker-type';
import { PlusCodeArea } from '../interfaces/plus-code-area';
import { GeolocationService } from './geolocation.service';

const messageMarker = leaflet.icon({
  iconUrl: 'assets/markers/message-marker.svg',

  iconSize: [32, 40], // size of the icon
  iconAnchor: [16, 40], // point of the icon which will correspond to marker's location
});

const noteMarker = leaflet.icon({
  iconUrl: 'assets/markers/note-marker.svg',

  iconSize: [32, 40], // size of the icon
  iconAnchor: [16, 40], // point of the icon which will correspond to marker's location
});

const multiMarker = leaflet.icon({
  iconUrl: 'assets/markers/multi-marker.svg',

  iconSize: [32, 40], // size of the icon
  iconAnchor: [16, 40], // point of the icon which will correspond to marker's location
});

const userMarker = leaflet.icon({
  iconUrl: 'assets/markers/user-marker.svg',

  iconSize: [32, 40], // size of the icon
  iconAnchor: [16, 40], // point of the icon which will correspond to marker's location
});

const imageMarker = leaflet.icon({
  iconUrl: 'assets/markers/image-marker.svg',

  iconSize: [32, 40], // size of the icon
  iconAnchor: [16, 40], // point of the icon which will correspond to marker's location
});

@Injectable({
  providedIn: 'root'
})
export class MapService {

  private _mapSet = signal(0);
  readonly mapSet = this._mapSet.asReadonly();

  private map?: leaflet.Map;
  private userMarker?: leaflet.Marker;
  private searchRectangle?: leaflet.Rectangle;
  private circleMarker?: leaflet.CircleMarker;
  private location: Location = { latitude: 0, longitude: 0, plusCode: '' };

  private markerClickEvent?: EventEmitter<MarkerLocation>;

  private messageMarkers: leaflet.Marker[] = [];

  private ready = false;

  private readonly geolocationService = inject(GeolocationService);

  public initMap() {
    this.ready = true;
    this._mapSet.update(trigger => trigger + 1);
  }

  public initMapEvents(location: Location, clickEvent: EventEmitter<Location>, moveEndEvent: EventEmitter<Location>, markerClickEvent: EventEmitter<MarkerLocation>): void {
    this.markerClickEvent = markerClickEvent;

    this.map = leaflet.map('map', {
      center: [location.latitude, location.longitude],
      zoom: 3,
      worldCopyJump: true
    });

    this.map.setMaxBounds([[-90, -180], [90, 180]]);
    this.setCircleMarker();

    this.map.on('click', (event: leaflet.LeafletMouseEvent) => {
      this.location.latitude = event.latlng.lat;
      this.location.longitude = event.latlng.lng;
      this.location.plusCode = this.geolocationService.getPlusCode(event.latlng.lat, event.latlng.lng);
      clickEvent.emit(this.location);
    });

    this.map.on('zoomstart', () => {
      if (this.map) {
        this.circleMarker?.removeFrom(this.map);
      } else {
        this.circleMarker?.remove();
      }
    });

    // MoveEnd fires always.
    this.map.on('moveend', () => {
      if (this.getMapZoom() < 17) {
        this.removeUserMarker();
      } else {
        this.restoreUserMarker();
      }
      moveEndEvent.emit(this.location);
    });

    const tiles = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 3,
      noWrap: true,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    tiles.addTo(this.map);

    // Fire event to load first messagens
    this.location.plusCode = this.geolocationService.getPlusCode(0, 0);
    this.searchRectangle = leaflet.rectangle([[0, 0], [0, 0]], { color: "#ffdbb5", weight: 1 }).addTo(this.map);
    // this.drawSearchRectange(this.location);

    this._mapSet.update(trigger => trigger + 1);
  }

  isReady(): boolean {
    return this.ready;
  }

  public fitMapToBounds(boundingBox: BoundingBox, paddingX = 20, paddingY = 20): void {
    if (!this.map) return;
    const bounds = leaflet.latLngBounds(
      [boundingBox.latMin, boundingBox.lonMin],
      [boundingBox.latMax, boundingBox.lonMax]
    );
    this.map.fitBounds(bounds, { padding: [paddingX, paddingY] });
  }

  public setMapMinMaxZoom(minZoom: number, maxZoom: number) {
    this.map?.setMinZoom(minZoom);
    this.map?.setMaxZoom(maxZoom);
  }

  public setMapZoom(zoom: number) {
    this.map?.setZoom(zoom);
  }

  public getMapZoom(): number {
    return undefined == this.map ? 3 : this.map.getZoom()
  }

  public getMapLocation(): Location {
    return this.location;
  }

  public setMaplocation(location: Location): void {
    this.location = location;
  }

  private normalizeLon(lon: number): number {
    const normalized = ((lon + 180) % 360 + 360) % 360 - 180;
    const epsilon = 1e-9;
    if (Math.abs(normalized + 180) < epsilon && lon > 0) {
      return 180;
    }
    return Object.is(normalized, -0) ? 0 : normalized;
  }

  private clampLon(lon: number): number {
    return Math.min(180, Math.max(-180, lon));
  }

  public getVisibleMapBoundingBox(): BoundingBox {
    const boundingBoxes = this.getVisibleMapBoundingBoxes();
    if (boundingBoxes.length === 0) {
      return { latMin: -90, lonMin: -180, latMax: 90, lonMax: 180 };
    }

    if (boundingBoxes.length === 1) {
      return boundingBoxes[0];
    }

    return {
      latMin: boundingBoxes[0].latMin,
      latMax: boundingBoxes[0].latMax,
      lonMin: boundingBoxes[0].lonMin,
      lonMax: boundingBoxes[1].lonMax
    };
  }

  public getVisibleMapBoundingBoxes(): BoundingBox[] {
    if (!this.map) {
      return [];
    }

    const bounds = this.map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    const latMin = sw.lat;
    const latMax = ne.lat;
    const lonMinRaw = sw.lng;
    const lonMaxRaw = ne.lng;

    const worldSpan = 360;
    const lonSpan = Math.abs(lonMaxRaw - lonMinRaw);
    if (lonSpan >= worldSpan) {
      return [{ latMin, latMax, lonMin: -180, lonMax: 180 }];
    }

    const lonMinWrapped = this.normalizeLon(lonMinRaw);
    const lonMaxWrapped = this.normalizeLon(lonMaxRaw);
    const exceedsWest = lonMinRaw < -180;
    const exceedsEast = lonMaxRaw > 180;

    if (exceedsWest && exceedsEast) {
      return [{ latMin, latMax, lonMin: -180, lonMax: 180 }];
    }

    if (exceedsWest) {
      return [{
        latMin,
        latMax,
        lonMin: -180,
        lonMax: this.clampLon(lonMaxRaw)
      }];
    }

    if (exceedsEast) {
      return [{
        latMin,
        latMax,
        lonMin: this.clampLon(lonMinRaw),
        lonMax: 180
      }];
    }

    if (lonMinWrapped <= lonMaxWrapped) {
      return [{
        latMin,
        latMax,
        lonMin: lonMinWrapped,
        lonMax: lonMaxWrapped
      }];
    }

    return [
      { latMin, latMax, lonMin: lonMinWrapped, lonMax: 180 },
      { latMin, latMax, lonMin: -180, lonMax: lonMaxWrapped }
    ];
  }

  public flyTo(location: Location): void {
    if (!this.map) {
      return;
    }
    this.map.flyTo(new leaflet.LatLng(location.latitude, location.longitude), this.map.getZoom());
  }

  public flyToWithZoom(location: Location, zoom: number): void {
    if (!this.map) {
      return;
    }
    this.map.setZoom(zoom);
    this.map.flyTo(new leaflet.LatLng(location.latitude, location.longitude), this.map.getZoom());
  }

  public moveTo(location: Location): void {
    this.map?.panTo(new leaflet.LatLng(location.latitude, location.longitude));
  }

  public moveToWithZoom(location: Location, zoom: number): void {
    if (!this.map) {
      return;
    }
    this.map.setZoom(zoom);
    this.map.panTo(new leaflet.LatLng(location.latitude, location.longitude));
  }

  public setUserMarker(location: Location): void {
    if (!this.map) {
      return;
    }
    if (!this.userMarker) {
      this.userMarker = leaflet.marker([location.latitude, location.longitude], { icon: userMarker, zIndexOffset: 0 }).addTo(this.map);
      return;
    }
    this.userMarker.setLatLng([location.latitude, location.longitude]);
  }

  public restoreUserMarker(): void {
    if (!this.map) {
      return;
    }
    this.userMarker?.addTo(this.map);
  }

  public removeUserMarker(): void {
    this.userMarker?.remove();
  }

  public setCircleMarker(): void {
    if (!this.map) {
      return;
    }
    this.circleMarker?.remove();
    this.circleMarker = leaflet.circleMarker([this.location.latitude, this.location.longitude]).addTo(this.map);
  }

  public drawSearchRectange(location: Location): void {
    if (!this.map || !this.searchRectangle) {
      return;
    }
    const zoom = this.map.getZoom();
    const plusCode = this.geolocationService.getPlusCodeBasedOnMapZoom(location, zoom);
    const plusCodeArea: PlusCodeArea = this.geolocationService.getGridFromPlusCode(plusCode);
    const bounds: leaflet.LatLngBoundsLiteral = [
      [plusCodeArea.latitudeLo, plusCodeArea.longitudeLo],
      [plusCodeArea.latitudeHi, plusCodeArea.longitudeHi]
    ];
    this.searchRectangle.setBounds(bounds);
  }

  public getSearchRectangeCenter(location: Location): [number, number] {
    const zoom = this.map?.getZoom() ?? 3;
    const plusCode = this.geolocationService.getPlusCodeBasedOnMapZoom(location, zoom);
    const plusCodeArea: PlusCodeArea = this.geolocationService.getGridFromPlusCode(plusCode);
    const center: [number, number] = [
      (plusCodeArea.latitudeLo + plusCodeArea.latitudeHi) / 2,
      (plusCodeArea.longitudeLo + plusCodeArea.longitudeHi) / 2
    ];
    return center;
  }

  public createMarkers(markerLocations: Map<string, MarkerLocation>): void {
    this.messageMarkers.forEach(marker => marker.remove());
    this.messageMarkers = [];

    markerLocations.forEach((markerLocation) => {
      const marker = this.createMarkerForType(markerLocation);
      if (!marker) {
        return;
      }
      marker.on('click', () => {
        this.location = markerLocation.location;
        this.setCircleMarker();
        this.showDataFromMarker(markerLocation);
      });
      this.messageMarkers.push(marker);
    });

    if (this.map) {
      const currentMap = this.map;
      this.messageMarkers.forEach(marker => marker.addTo(currentMap));
    }
  }

  private createMarkerForType(markerLocation: MarkerLocation): leaflet.Marker | null {
    const latLng: [number, number] = [markerLocation.location.latitude, markerLocation.location.longitude];
    switch (markerLocation.type) {
      case MarkerType.PUBLIC_MESSAGE:
        return leaflet.marker(latLng, { icon: messageMarker, zIndexOffset: 20 });
      case MarkerType.PRIVATE_NOTE:
        return leaflet.marker(latLng, { icon: noteMarker, zIndexOffset: 15 });
      case MarkerType.PRIVATE_IMAGE:
        return leaflet.marker(latLng, { icon: imageMarker, zIndexOffset: 15 });
      case MarkerType.MULTI:
        return leaflet.marker(latLng, { icon: multiMarker, zIndexOffset: 5 });
      default:
        return null;
    }
  }

  private showDataFromMarker(markerLocation: MarkerLocation) {
    this.markerClickEvent?.emit(markerLocation);
  }

}
