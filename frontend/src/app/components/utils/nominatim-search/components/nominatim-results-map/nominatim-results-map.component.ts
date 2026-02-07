import { AfterViewInit, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import * as leaflet from 'leaflet';
import { BoundingBox } from '../../../../../interfaces/bounding-box';
import { Location } from '../../../../../interfaces/location';
import { NominatimPlace } from '../../../../../interfaces/nominatim-place';

const markerIcon = leaflet.icon({
  iconUrl: 'assets/markers/location-marker.svg',
  iconSize: [32, 40],
  iconAnchor: [16, 40]
});

const selectedMarkerIcon = leaflet.icon({
  iconUrl: 'assets/markers/selected-marker.svg',
  iconSize: [32, 40],
  iconAnchor: [16, 40]
});

@Component({
  selector: 'app-nominatim-results-map',
  standalone: true,
  templateUrl: './nominatim-results-map.component.html',
  styleUrl: './nominatim-results-map.component.css'
})
export class NominatimResultsMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() places: NominatimPlace[] = [];
  @Input() initialCenter?: Location;
  @Input() initialZoom?: number;
  @Input() selectedPlaceId: number | null = null;
  @Output() placeSelected = new EventEmitter<NominatimPlace>();
  @Output() viewChange = new EventEmitter<{ center: Location; zoom: number; bounds: BoundingBox }>();

  readonly mapId = `nominatim-results-map-${Math.random().toString(36).slice(2)}`;
  private map?: leaflet.Map;
  private markerLayer?: leaflet.LayerGroup;
  private readonly markersByPlaceId = new Map<number, leaflet.Marker>();
  private activeSelectedPlaceId?: number;
  private pendingBounds?: BoundingBox;
  private pendingView?: { center: Location; zoom?: number };

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['places'] && this.map) {
      this.updateMarkers();
    }
    if (changes['selectedPlaceId'] && this.map && !changes['selectedPlaceId'].firstChange) {
      this.applySelection(this.selectedPlaceId ?? undefined);
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initMap(): void {
    const { latitude, longitude } = this.getInitialCenter();
    const initialZoom = this.initialZoom ?? 2;

    this.map = leaflet.map(this.mapId, {
      center: [latitude, longitude],
      zoom: initialZoom,
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
    this.updateMarkers();
    this.applyPendingView();
    this.map.on('moveend', () => this.emitViewChange());
    setTimeout(() => this.map?.invalidateSize(), 0);
    this.emitViewChange();
  }

  private getInitialCenter(): Location {
    if (this.initialCenter) {
      return this.initialCenter;
    }
    return { latitude: 0, longitude: 0, plusCode: '' };
  }

  private updateMarkers(): void {
    if (!this.map || !this.markerLayer) return;
    this.markerLayer.clearLayers();
    this.markersByPlaceId.clear();
    this.activeSelectedPlaceId = undefined;

    this.places.forEach(place => {
      const latitude = Number(place.lat);
      const longitude = Number(place.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }
      const marker = leaflet.marker([latitude, longitude], { icon: markerIcon });
      const label = (place.name || '').trim();
      if (label) {
        marker.bindTooltip(label, { direction: 'top', offset: [0, -6] });
      }
      marker.on('click', () => {
        this.applySelection(place.place_id);
        this.placeSelected.emit(place);
      });
      marker.addTo(this.markerLayer!);
      this.markersByPlaceId.set(place.place_id, marker);
    });

    this.applySelection(this.selectedPlaceId ?? undefined);
  }

  private applySelection(placeId?: number): void {
    if (this.activeSelectedPlaceId !== undefined) {
      const previous = this.markersByPlaceId.get(this.activeSelectedPlaceId);
      if (previous) {
        previous.setIcon(markerIcon);
      }
    }

    if (placeId === undefined) {
      this.activeSelectedPlaceId = undefined;
      return;
    }

    const next = this.markersByPlaceId.get(placeId);
    if (!next) {
      this.activeSelectedPlaceId = undefined;
      return;
    }

    next.setIcon(selectedMarkerIcon);
    this.activeSelectedPlaceId = placeId;
  }

  setView(center: Location, zoom?: number): void {
    if (!this.map) {
      this.pendingView = { center, zoom };
      this.pendingBounds = undefined;
      return;
    }
    this.applyView(center, zoom);
  }

  fitBounds(bounds: BoundingBox, padding = 24): void {
    if (!this.map) {
      this.pendingBounds = bounds;
      this.pendingView = undefined;
      return;
    }
    this.applyBounds(bounds, padding);
  }

  private applyPendingView(): void {
    if (!this.map) return;
    if (this.pendingBounds) {
      this.applyBounds(this.pendingBounds, 24);
      this.pendingBounds = undefined;
      return;
    }
    if (this.pendingView) {
      this.applyView(this.pendingView.center, this.pendingView.zoom);
      this.pendingView = undefined;
    }
  }

  private applyView(center: Location, zoom?: number): void {
    if (!this.map) return;
    const nextZoom = zoom ?? this.map.getZoom();
    this.map.setView([center.latitude, center.longitude], nextZoom);
    this.emitViewChange();
  }

  private applyBounds(bounds: BoundingBox, padding: number): void {
    if (!this.map) return;
    this.map.fitBounds([
      [bounds.latMin, bounds.lonMin],
      [bounds.latMax, bounds.lonMax]
    ], { padding: [padding, padding] });
    this.emitViewChange();
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
