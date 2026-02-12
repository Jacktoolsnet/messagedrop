import { AfterViewInit, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import * as leaflet from 'leaflet';
import { BoundingBox } from '../../../../../interfaces/bounding-box';
import { Location } from '../../../../../interfaces/location';

export type HashtagMapItemType = 'place' | 'message' | 'experience' | 'contact';

export interface HashtagMapItem {
  id: string;
  type: HashtagMapItemType;
  label: string;
  location: Location;
}

const placeMarkerIcon = leaflet.icon({
  iconUrl: 'assets/markers/location-marker.svg',
  iconSize: [32, 40],
  iconAnchor: [16, 40]
});

const messageMarkerIcon = leaflet.icon({
  iconUrl: 'assets/markers/message-marker.svg',
  iconSize: [32, 40],
  iconAnchor: [16, 40]
});

const experienceMarkerIcon = leaflet.icon({
  iconUrl: 'assets/markers/my-experience-marker.svg',
  iconSize: [32, 40],
  iconAnchor: [16, 40]
});

const contactMarkerIcon = leaflet.icon({
  iconUrl: 'assets/markers/user-marker.svg',
  iconSize: [32, 40],
  iconAnchor: [16, 40]
});

const selectedMarkerIcon = leaflet.icon({
  iconUrl: 'assets/markers/selected-marker.svg',
  iconSize: [32, 40],
  iconAnchor: [16, 40]
});

@Component({
  selector: 'app-hashtag-results-map',
  standalone: true,
  templateUrl: './hashtag-results-map.component.html',
  styleUrl: './hashtag-results-map.component.css'
})
export class HashtagResultsMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() items: HashtagMapItem[] = [];
  @Input() initialCenter?: Location;
  @Input() initialZoom?: number;
  @Input() selectedItemId: string | null = null;

  @Output() itemSelected = new EventEmitter<string>();
  @Output() viewChange = new EventEmitter<{ center: Location; zoom: number; bounds: BoundingBox }>();

  readonly mapId = `hashtag-results-map-${Math.random().toString(36).slice(2)}`;
  private map?: leaflet.Map;
  private markerLayer?: leaflet.LayerGroup;
  private readonly markersByItemId = new Map<string, leaflet.Marker>();
  private activeSelectedItemId?: string;

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items'] && this.map) {
      this.updateMarkers(true);
    }
    if (changes['selectedItemId'] && this.map && !changes['selectedItemId'].firstChange) {
      this.applySelection(this.selectedItemId ?? undefined);
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initMap(): void {
    const center = this.initialCenter ?? { latitude: 0, longitude: 0, plusCode: '' };
    const zoom = this.initialZoom ?? 3;

    this.map = leaflet.map(this.mapId, {
      center: [center.latitude, center.longitude],
      zoom,
      worldCopyJump: true
    });

    this.map.setMaxBounds([[-90, -180], [90, 180]]);

    leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 2,
      noWrap: true,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);

    this.markerLayer = leaflet.layerGroup().addTo(this.map);
    this.updateMarkers(true);
    this.map.on('moveend', () => this.emitViewChange());
    setTimeout(() => this.map?.invalidateSize(), 0);
    this.emitViewChange();
  }

  private updateMarkers(fitToMarkers: boolean): void {
    if (!this.map || !this.markerLayer) return;

    this.markerLayer.clearLayers();
    this.markersByItemId.clear();
    this.activeSelectedItemId = undefined;

    const markerBounds: leaflet.LatLngExpression[] = [];

    for (const item of this.items) {
      const latitude = Number(item.location.latitude);
      const longitude = Number(item.location.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        continue;
      }

      const marker = leaflet.marker([latitude, longitude], { icon: this.getIconForType(item.type) });
      if (item.label.trim()) {
        marker.bindTooltip(item.label, { direction: 'top', offset: [0, -6] });
      }
      marker.on('click', () => {
        this.applySelection(item.id);
        this.itemSelected.emit(item.id);
      });
      marker.addTo(this.markerLayer);
      this.markersByItemId.set(item.id, marker);
      markerBounds.push([latitude, longitude]);
    }

    this.applySelection(this.selectedItemId ?? undefined);

    if (fitToMarkers) {
      this.fitToMarkers(markerBounds);
    }
  }

  private fitToMarkers(markerBounds: leaflet.LatLngExpression[]): void {
    if (!this.map || markerBounds.length === 0) {
      return;
    }

    if (markerBounds.length === 1) {
      const [lat, lon] = markerBounds[0] as [number, number];
      const targetZoom = Math.max(this.map.getZoom(), 13);
      this.map.setView([lat, lon], targetZoom);
      return;
    }

    const bounds = leaflet.latLngBounds(markerBounds);
    this.map.fitBounds(bounds, { padding: [24, 24] });
  }

  private applySelection(itemId?: string): void {
    if (this.activeSelectedItemId !== undefined) {
      const previousMarker = this.markersByItemId.get(this.activeSelectedItemId);
      const previousItem = this.items.find((item) => item.id === this.activeSelectedItemId);
      if (previousMarker && previousItem) {
        previousMarker.setIcon(this.getIconForType(previousItem.type));
      }
    }

    if (!itemId) {
      this.activeSelectedItemId = undefined;
      return;
    }

    const marker = this.markersByItemId.get(itemId);
    if (!marker) {
      this.activeSelectedItemId = undefined;
      return;
    }

    marker.setIcon(selectedMarkerIcon);
    this.activeSelectedItemId = itemId;
  }

  private getIconForType(type: HashtagMapItemType): leaflet.Icon {
    switch (type) {
      case 'place':
        return placeMarkerIcon;
      case 'message':
        return messageMarkerIcon;
      case 'experience':
        return experienceMarkerIcon;
      case 'contact':
        return contactMarkerIcon;
      default:
        return placeMarkerIcon;
    }
  }

  private emitViewChange(): void {
    if (!this.map) return;
    const bounds = this.map.getBounds();
    const southWest = bounds.getSouthWest();
    const northEast = bounds.getNorthEast();

    this.viewChange.emit({
      center: {
        latitude: this.map.getCenter().lat,
        longitude: this.map.getCenter().lng,
        plusCode: ''
      },
      zoom: this.map.getZoom(),
      bounds: {
        latMin: southWest.lat,
        lonMin: southWest.lng,
        latMax: northEast.lat,
        lonMax: northEast.lng
      }
    });
  }
}
