import { AfterViewInit, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import * as leaflet from 'leaflet';
import { Location } from '../../../interfaces/location';

interface MapMarker {
  latitude: number;
  longitude: number;
  label?: string;
  id?: number;
}

const DEFAULT_MARKER_ICON_URL = 'assets/markers/location-marker.svg';

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
  @Input() interactive = false;
  @Input() markerIconUrl = DEFAULT_MARKER_ICON_URL;
  @Output() markerClick = new EventEmitter<MapMarker>();

  readonly mapId = `search-settings-map-${Math.random().toString(36).slice(2)}`;
  private map?: leaflet.Map;
  private markerLayer?: leaflet.LayerGroup;
  private zoomControl?: leaflet.Control.Zoom;
  private markerIcon?: leaflet.Icon;
  private markerIconUrlCache?: string;

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
    if (changes['markers'] || changes['markerIconUrl']) {
      this.markerIcon = undefined;
      this.updateMarkers();
    }
    if (changes['interactive'] || changes['disabled']) {
      this.updateInteractivity();
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initMap(): void {
    if (!this.center) {
      return;
    }

    const interactive = this.isInteractive();
    this.map = leaflet.map(this.mapId, {
      center: [this.center.latitude, this.center.longitude],
      zoom: this.zoom,
      attributionControl: false,
      zoomControl: false,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      touchZoom: interactive
    });

    if (interactive) {
      this.zoomControl = leaflet.control.zoom();
      this.zoomControl.addTo(this.map);
    }

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

  private isInteractive(): boolean {
    return this.interactive && !this.disabled;
  }

  private updateInteractivity(): void {
    if (!this.map) return;
    const interactive = this.isInteractive();
    const toggle = (handler?: { enable: () => void; disable: () => void }) => {
      if (!handler) return;
      if (interactive) {
        handler.enable();
      } else {
        handler.disable();
      }
    };
    toggle(this.map.dragging);
    toggle(this.map.scrollWheelZoom);
    toggle(this.map.doubleClickZoom);
    toggle(this.map.boxZoom);
    toggle(this.map.keyboard);
    toggle(this.map.touchZoom);

    if (interactive) {
      if (!this.zoomControl) {
        this.zoomControl = leaflet.control.zoom();
      }
      this.zoomControl.addTo(this.map);
    } else if (this.zoomControl) {
      this.zoomControl.remove();
    }
  }

  private updateMarkers(): void {
    if (!this.map || !this.markerLayer) return;
    this.markerLayer.clearLayers();
    const bounds: leaflet.LatLngTuple[] = [];
    const icon = this.getMarkerIcon();
    this.markers.forEach((marker) => {
      if (!Number.isFinite(marker.latitude) || !Number.isFinite(marker.longitude)) {
        return;
      }
      const latLng: leaflet.LatLngTuple = [marker.latitude, marker.longitude];
      const leafletMarker = leaflet.marker(latLng, { icon });
      if (marker.label) {
        leafletMarker.bindTooltip(marker.label, { direction: 'top', offset: [0, -6] });
      }
      leafletMarker.on('click', () => this.markerClick.emit(marker));
      leafletMarker.addTo(this.markerLayer!);
      bounds.push(latLng);
    });

    if (this.fitMarkers && bounds.length > 0) {
      const fitBounds = leaflet.latLngBounds(bounds);
      this.map.fitBounds(fitBounds, { padding: [24, 24], maxZoom: 8 });
    }
  }

  private getMarkerIcon(): leaflet.Icon {
    const url = this.markerIconUrl || DEFAULT_MARKER_ICON_URL;
    if (!this.markerIcon || this.markerIconUrlCache !== url) {
      this.markerIconUrlCache = url;
      this.markerIcon = leaflet.icon({
        iconUrl: url,
        iconSize: [28, 36],
        iconAnchor: [14, 36]
      });
    }
    return this.markerIcon;
  }
}
