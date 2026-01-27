import { AfterViewInit, Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import * as leaflet from 'leaflet';
import { Location } from '../../../interfaces/location';

interface MapMarker {
  latitude: number;
  longitude: number;
  label?: string;
}

const markerIcon = leaflet.icon({
  iconUrl: 'assets/markers/location-marker.svg',
  iconSize: [28, 36],
  iconAnchor: [14, 36]
});

@Component({
  selector: 'app-search-settings-map-preview',
  standalone: true,
  templateUrl: './search-settings-map-preview.component.html',
  styleUrl: './search-settings-map-preview.component.css'
})
export class SearchSettingsMapPreviewComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) center!: Location;
  @Input() zoom = 3;
  @Input() disabled = false;
  @Input() markers: MapMarker[] = [];
  @Input() fitMarkers = false;

  readonly mapId = `search-settings-map-${Math.random().toString(36).slice(2)}`;
  private map?: leaflet.Map;
  private markerLayer?: leaflet.LayerGroup;

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) {
      return;
    }
    if (changes['center'] || changes['zoom']) {
      if (this.fitMarkers && this.markers.length > 0) {
        this.updateMarkers();
        return;
      }
      this.map.setView([this.center.latitude, this.center.longitude], this.zoom);
    }
    if (changes['markers']) {
      this.updateMarkers();
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initMap(): void {
    if (!this.center) {
      return;
    }

    this.map = leaflet.map(this.mapId, {
      center: [this.center.latitude, this.center.longitude],
      zoom: this.zoom,
      attributionControl: false,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false
    });

    leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 3,
      noWrap: true,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);

    this.markerLayer = leaflet.layerGroup().addTo(this.map);
    this.updateMarkers();
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private updateMarkers(): void {
    if (!this.map || !this.markerLayer) return;
    this.markerLayer.clearLayers();
    const bounds: leaflet.LatLngTuple[] = [];
    this.markers.forEach((marker) => {
      if (!Number.isFinite(marker.latitude) || !Number.isFinite(marker.longitude)) {
        return;
      }
      const latLng: leaflet.LatLngTuple = [marker.latitude, marker.longitude];
      const leafletMarker = leaflet.marker(latLng, { icon: markerIcon });
      if (marker.label) {
        leafletMarker.bindTooltip(marker.label, { direction: 'top', offset: [0, -6] });
      }
      leafletMarker.addTo(this.markerLayer!);
      bounds.push(latLng);
    });

    if (this.fitMarkers && bounds.length > 0) {
      const fitBounds = leaflet.latLngBounds(bounds);
      this.map.fitBounds(fitBounds, { padding: [24, 24], maxZoom: 8 });
    }
  }
}
