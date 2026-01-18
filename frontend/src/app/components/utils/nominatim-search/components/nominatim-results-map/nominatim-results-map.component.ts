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
  @Output() placeSelected = new EventEmitter<NominatimPlace>();
  @Output() viewChange = new EventEmitter<{ center: Location; zoom: number; bounds: BoundingBox }>();

  readonly mapId = `nominatim-results-map-${Math.random().toString(36).slice(2)}`;
  private map?: leaflet.Map;
  private markerLayer?: leaflet.LayerGroup;

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['places'] && this.map) {
      this.updateMarkers();
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

    this.places.forEach(place => {
      const latitude = Number(place.lat);
      const longitude = Number(place.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }
      const marker = leaflet.marker([latitude, longitude], { icon: markerIcon });
      marker.on('click', () => this.placeSelected.emit(place));
      marker.addTo(this.markerLayer!);
    });

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
