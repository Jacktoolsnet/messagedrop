import { EventEmitter, inject, Injectable, signal } from '@angular/core';
import * as leaflet from 'leaflet';
import { BoundingBox } from '../interfaces/bounding-box';
import { Location } from '../interfaces/location';
import { MarkerLocation } from '../interfaces/marker-location';
import { MapContextMenuEvent } from '../interfaces/map-context-menu-event';
import { MarkerType } from '../interfaces/marker-type';
import { TripGoStop } from '../interfaces/tripgo';
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

const imageMarker = leaflet.icon({
  iconUrl: 'assets/markers/image-marker.svg',

  iconSize: [32, 40], // size of the icon
  iconAnchor: [16, 40], // point of the icon which will correspond to marker's location
});

const documentMarker = leaflet.icon({
  iconUrl: 'assets/markers/document-marker.svg',

  iconSize: [32, 40], // size of the icon
  iconAnchor: [16, 40], // point of the icon which will correspond to marker's location
});

const experienceMarker = leaflet.icon({
  iconUrl: 'assets/markers/experience-marker.svg',

  iconSize: [32, 40], // size of the icon
  iconAnchor: [16, 40], // point of the icon which will correspond to marker's location
});


const secretDropMarker = leaflet.icon({
  iconUrl: 'assets/markers/secretdrop-marker.svg',

  iconSize: [32, 40], // size of the icon
  iconAnchor: [16, 40], // point of the icon which will correspond to marker's location
});

const myExperienceMarker = leaflet.icon({
  iconUrl: 'assets/markers/my-experience-marker.svg',

  iconSize: [32, 40], // size of the icon
  iconAnchor: [16, 40], // point of the icon which will correspond to marker's location
});

const wikipediaMarker = leaflet.icon({
  iconUrl: 'assets/markers/wikipedia-marker.svg',
  iconSize: [32, 40],
  iconAnchor: [16, 40],
});

function publicTransportStopMarker(stop: TripGoStop): leaflet.DivIcon {
  const icons = publicTransportIcons(stop);
  if (icons.length === 1) {
    return leaflet.divIcon({
      className: 'public-transport-stop-marker-host',
      html: `<svg class="public-transport-stop-marker" viewBox="0 0 32 40" aria-hidden="true">
        <image href="assets/markers/empty-marker.svg" x="0" y="0" width="32" height="40" />
        <text class="material-symbols-outlined public-transport-stop-marker__icon public-transport-stop-marker__icon--single"
          x="16" y="10">${icons[0]}</text>
      </svg>`,
      iconSize: [32, 40],
      iconAnchor: [16, 40]
    });
  }

  const markerExtensionHeight = (icons.length - 1) * 20;
  const markerHeight = 40 + markerExtensionHeight;
  const markerSplitY = 16.4;
  const markerLowerHeight = 40 - markerSplitY;
  const iconElements = icons.map((icon, index) =>
    `<text class="material-symbols-outlined public-transport-stop-marker__icon" x="16" y="${10 + index * 20}">${icon}</text>`
  ).join('');
  return leaflet.divIcon({
    className: 'public-transport-stop-marker-host',
    html: `<svg class="public-transport-stop-marker" viewBox="0 0 32 ${markerHeight}" aria-hidden="true">
      <rect class="public-transport-stop-marker__extension-border"
        x="0" y="${markerSplitY}" width="32" height="${markerExtensionHeight}" />
      <rect class="public-transport-stop-marker__extension-background"
        x="3.1" y="${markerSplitY}" width="25.8" height="${markerExtensionHeight}" />
      <svg x="0" y="0" width="32" height="${markerSplitY}"
        viewBox="0 0 32 ${markerSplitY}" preserveAspectRatio="none" overflow="hidden">
        <image href="assets/markers/empty-marker.svg" x="0" y="0" width="32" height="40" />
      </svg>
      <svg x="0" y="${markerSplitY + markerExtensionHeight}" width="32" height="${markerLowerHeight}"
        viewBox="0 ${markerSplitY} 32 ${markerLowerHeight}" preserveAspectRatio="none" overflow="hidden">
        <image href="assets/markers/empty-marker.svg" x="0" y="0" width="32" height="40" />
      </svg>
      ${iconElements}
    </svg>`,
    iconSize: [32, markerHeight],
    iconAnchor: [16, markerHeight]
  });
}

function publicTransportIcons(stop: TripGoStop): string[] {
  const identifiers = stop.modeIdentifiers.map((value) => value.toLowerCase());
  const apiIcons = (stop.modeIcons ?? []).map((value) => value.toLowerCase());
  const labels = [...stop.modeLabels, ...stop.stopTypes].map((value) => value.toLowerCase());
  const values = [...identifiers, ...apiIcons, ...labels];
  const icons: string[] = [];
  const add = (condition: boolean, icon: string) => {
    if (condition && !icons.includes(icon)) icons.push(icon);
  };

  add(values.some((value) => value.includes('bus') || value.includes('coach')), 'directions_bus');
  add(values.some((value) => value.includes('tram') || value.includes('streetcar')), 'tram');
  add(values.some((value) => value.includes('subway') || value.includes('metro') || value.includes('u-bahn')), 'subway');

  const hasSuburbanRail = values.some((value) => value.includes('s-bahn')
    || value.includes('suburban')
    || value.includes('train-germany-s'));
  const railApiIcons = apiIcons.filter((value) => value.includes('train') || value.includes('rail'));
  const hasExplicitOtherRail = railApiIcons.some((value) => !value.includes('train-germany-s'))
    || (railApiIcons.length === 0 && labels.some((value) =>
      (value.includes('train') || value.includes('rail') || value.includes('zug'))
      && !value.includes('s-bahn')
      && !value.includes('suburban')));
  const hasGenericRail = identifiers.some((value) => value.includes('train') || value.includes('rail'));
  add(hasSuburbanRail, 'train');
  add(hasExplicitOtherRail || (hasGenericRail && !hasSuburbanRail && railApiIcons.length === 0), 'directions_railway');

  add(values.some((value) => value.includes('ferry') || value.includes('boat')), 'directions_boat');
  add(values.some((value) => value.includes('funicular')), 'funicular');
  add(values.some((value) => value.includes('gondola') || value.includes('cablecar')), 'gondola_lift');

  return icons.length ? icons : ['directions_transit'];
}
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
  private zoomLevelButton?: HTMLButtonElement;
  private zoomLevelButtonLabel = 'Search settings';
  private location: Location = { latitude: 0, longitude: 0, plusCode: '' };

  private markerClickEvent?: EventEmitter<MarkerLocation>;

  private messageMarkers: leaflet.Marker[] = [];

  private ready = false;

  private readonly geolocationService = inject(GeolocationService);

  public initMap() {
    this.ready = true;
    this._mapSet.update(trigger => trigger + 1);
  }

  public initMapEvents(
    location: Location,
    clickEvent: EventEmitter<Location>,
    moveEndEvent: EventEmitter<Location>,
    markerClickEvent: EventEmitter<MarkerLocation>,
    searchSettingsClickEvent: EventEmitter<void>,
    contextMenuEvent: EventEmitter<MapContextMenuEvent>
  ): void {
    this.markerClickEvent = markerClickEvent;

    if (this.map) {
      this.map.remove();
      this.map = undefined;
    }

    const container = leaflet.DomUtil.get('map') as { _leaflet_id?: number } | null;
    if (container && container._leaflet_id) {
      delete container._leaflet_id;
    }

    this.map = leaflet.map('map', {
      center: [location.latitude, location.longitude],
      zoom: 3,
      worldCopyJump: true,
      tapHold: true
    });

    this.addZoomLevelButton(searchSettingsClickEvent);

    this.map.setMaxBounds([[-90, -180], [90, 180]]);
    this.setCircleMarker();

    let suppressNextMapClick = false;
    let longPressTimer: ReturnType<typeof setTimeout> | undefined;
    let longPressStart: leaflet.Point | undefined;
    const cancelLongPress = () => {
      if (longPressTimer) clearTimeout(longPressTimer);
      longPressTimer = undefined;
      longPressStart = undefined;
    };
    const suppressFollowingClick = () => {
      suppressNextMapClick = true;
      setTimeout(() => suppressNextMapClick = false, 1_000);
    };
    const emitContextMenu = (event: leaflet.LeafletMouseEvent) => {
      event.originalEvent?.preventDefault();
      const originalEvent = event.originalEvent as MouseEvent | undefined;
      const mapContainerBounds = this.map?.getContainer().getBoundingClientRect();
      const location: Location = {
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
        plusCode: this.geolocationService.getPlusCode(event.latlng.lat, event.latlng.lng)
      };
      contextMenuEvent.emit({
        location,
        clientX: Number.isFinite(originalEvent?.clientX) ? originalEvent!.clientX : (mapContainerBounds?.left ?? 0) + event.containerPoint.x,
        clientY: Number.isFinite(originalEvent?.clientY) ? originalEvent!.clientY : (mapContainerBounds?.top ?? 0) + event.containerPoint.y
      });
    };

    this.map.on('click', (event: leaflet.LeafletMouseEvent) => {
      if (suppressNextMapClick) {
        suppressNextMapClick = false;
        return;
      }
      this.location.latitude = event.latlng.lat;
      this.location.longitude = event.latlng.lng;
      this.location.plusCode = this.geolocationService.getPlusCode(event.latlng.lat, event.latlng.lng);
      clickEvent.emit(this.location);
    });

    // Leaflet maps a long touch to `contextmenu`; on desktop this also makes
    // the same action conveniently available via the right mouse button.
    this.map.on('contextmenu', (event: leaflet.LeafletMouseEvent) => {
      cancelLongPress();
      suppressFollowingClick();
      emitContextMenu(event);
    });

    // Leaflet has no desktop equivalent for tap-and-hold, so add one while
    // still cancelling it as soon as the user starts dragging the map.
    this.map.on('mousedown', (event: leaflet.LeafletMouseEvent) => {
      if ((event.originalEvent as MouseEvent | undefined)?.button !== 0) return;
      cancelLongPress();
      longPressStart = event.containerPoint;
      longPressTimer = setTimeout(() => {
        suppressFollowingClick();
        emitContextMenu(event);
        cancelLongPress();
      }, 600);
    });
    this.map.on('mousemove', (event: leaflet.LeafletMouseEvent) => {
      if (longPressStart && event.containerPoint.distanceTo(longPressStart) > 8) cancelLongPress();
    });
    this.map.on('mouseup mouseout dragstart', cancelLongPress);

    this.map.on('zoomstart', () => {
      if (this.map) {
        this.circleMarker?.removeFrom(this.map);
      } else {
        this.circleMarker?.remove();
      }
    });

    this.map.on('zoomend', () => this.updateZoomLevelButton());

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

    // When map is created after a full-screen gate/splash, Leaflet can start with a stale size.
    // Recalculate layout shortly after mount so bounds + marker hitboxes are reliable.
    const refreshMapLayout = () => {
      if (!this.map) return;
      this.map.invalidateSize();
      moveEndEvent.emit(this.location);
    };
    setTimeout(refreshMapLayout, 0);
    setTimeout(refreshMapLayout, 180);
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
    this.setMaplocation(this.geolocationService.getCenterOfBoundingBox(boundingBox));
    this.setCircleMarker();
  }

  public getMapZoom(): number {
    return undefined == this.map ? 3 : this.map.getZoom()
  }

  public setZoomLevelButtonLabel(label: string): void {
    this.zoomLevelButtonLabel = label;
    this.updateZoomLevelButton();
  }

  private addZoomLevelButton(searchSettingsClickEvent: EventEmitter<void>): void {
    const zoomControlContainer = this.map?.zoomControl.getContainer();
    if (!zoomControlContainer) {
      return;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'leaflet-control-zoom-level-button';
    button.addEventListener('click', () => searchSettingsClickEvent.emit());
    leaflet.DomEvent.disableClickPropagation(button);
    leaflet.DomEvent.disableScrollPropagation(button);
    zoomControlContainer.appendChild(button);
    this.zoomLevelButton = button;
    this.updateZoomLevelButton();
  }

  private updateZoomLevelButton(): void {
    if (!this.zoomLevelButton) {
      return;
    }

    const zoomLevel = String(Math.round(this.getMapZoom())).padStart(2, '0');
    this.zoomLevelButton.textContent = zoomLevel;
    this.zoomLevelButton.title = this.zoomLevelButtonLabel;
    this.zoomLevelButton.setAttribute('aria-label', `${this.zoomLevelButtonLabel}: ${zoomLevel}`);
  }

  public getMapLocation(): Location {
    return this.location;
  }

  public setMaplocation(location: Location): void {
    this.location = location;
    this.setCircleMarker();
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
    this.setMaplocation(location);
    this.map.flyTo(new leaflet.LatLng(location.latitude, location.longitude), this.map.getZoom());
  }

  public flyToWithZoom(location: Location, zoom: number): void {
    if (!this.map) {
      return;
    }
    this.setMaplocation(location);
    this.map.setZoom(zoom);
    this.map.flyTo(new leaflet.LatLng(location.latitude, location.longitude), this.map.getZoom());
  }

  public moveTo(location: Location): void {
    if (!this.map) {
      return;
    }
    this.setMaplocation(location);
    this.map?.panTo(new leaflet.LatLng(location.latitude, location.longitude));
  }

  public moveToWithZoom(location: Location, zoom: number): void {
    if (!this.map) {
      return;
    }
    this.setMaplocation(location);
    this.map.setZoom(zoom);
    this.map.panTo(new leaflet.LatLng(location.latitude, location.longitude));
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

    this.setCircleMarker();
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
      case MarkerType.PRIVATE_DOCUMENT:
        return leaflet.marker(latLng, { icon: documentMarker, zIndexOffset: 15 });
      case MarkerType.MULTI:
        return leaflet.marker(latLng, { icon: multiMarker, zIndexOffset: 5 });
      case MarkerType.EXPERIENCE_DESTINATION:
        return leaflet.marker(latLng, { icon: experienceMarker, zIndexOffset: 10 });
      case MarkerType.MY_EXPERIENCE:
        return leaflet.marker(latLng, { icon: myExperienceMarker, zIndexOffset: 12 });
      case MarkerType.SECRET_DROP:
        return leaflet.marker(latLng, { icon: secretDropMarker, zIndexOffset: 18 });
      case MarkerType.WIKIPEDIA:
        return leaflet.marker(latLng, { icon: wikipediaMarker, zIndexOffset: 10 });
      case MarkerType.PUBLIC_TRANSPORT_STOP:
        return markerLocation.publicTransportStop
          ? leaflet.marker(latLng, {
            icon: publicTransportStopMarker(markerLocation.publicTransportStop),
            zIndexOffset: 16,
            title: markerLocation.publicTransportStop.name,
            alt: markerLocation.publicTransportStop.name
          })
          : null;
      default:
        return null;
    }
  }

  private showDataFromMarker(markerLocation: MarkerLocation) {
    this.markerClickEvent?.emit(markerLocation);
  }

}
