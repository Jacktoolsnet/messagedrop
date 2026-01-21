import { AfterViewInit, Component, Input, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import * as leaflet from 'leaflet';
import { Location } from '../../../interfaces/location';

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

  readonly mapId = `search-settings-map-${Math.random().toString(36).slice(2)}`;
  private map?: leaflet.Map;

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) {
      return;
    }
    if (changes['center'] || changes['zoom']) {
      this.map.setView([this.center.latitude, this.center.longitude], this.zoom);
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

    setTimeout(() => this.map?.invalidateSize(), 0);
  }
}
