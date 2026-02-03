import { AfterViewInit, Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import * as leaflet from 'leaflet';
import { Location } from '../../../interfaces/location';

type MarkerKind = 'message' | 'note';

const markerIcons: Record<MarkerKind, leaflet.Icon> = {
  message: leaflet.icon({
    iconUrl: 'assets/markers/message-marker.svg',
    iconSize: [32, 40],
    iconAnchor: [16, 40]
  }),
  note: leaflet.icon({
    iconUrl: 'assets/markers/note-marker.svg',
    iconSize: [32, 40],
    iconAnchor: [16, 40]
  })
};

@Component({
  selector: 'app-location-preview',
  standalone: true,
  templateUrl: './location-preview.component.html',
  styleUrl: './location-preview.component.css'
})
export class LocationPreviewComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) location!: Location;
  @Input() markerType: MarkerKind = 'message';
  @Input() zoom = 15;

  readonly mapId = `location-preview-map-${Math.random().toString(36).slice(2)}`;
  private map?: leaflet.Map;
  private marker?: leaflet.Marker;

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['location'] && this.map && this.location) {
      this.updateMap(this.location);
    }
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initMap(): void {
    if (!this.location) {
      return;
    }
    const { latitude, longitude } = this.location;
    this.map = leaflet.map(this.mapId, {
      center: [latitude, longitude],
      zoom: this.zoom,
      worldCopyJump: true,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false
    });

    this.map.setMaxBounds([[-90, -180], [90, 180]]);

    leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 3,
      noWrap: true,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);

    this.marker = leaflet.marker([latitude, longitude], {
      icon: markerIcons[this.markerType]
    }).addTo(this.map);

    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private updateMap(location: Location): void {
    if (!this.map) {
      return;
    }
    const latLng = leaflet.latLng(location.latitude, location.longitude);
    this.map.setView(latLng, this.map.getZoom());
    if (this.marker) {
      this.marker.setLatLng(latLng);
      return;
    }
    this.marker = leaflet.marker(latLng, { icon: markerIcons[this.markerType] }).addTo(this.map);
  }
}
