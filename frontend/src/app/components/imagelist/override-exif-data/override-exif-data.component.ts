import { AfterViewInit, Component, inject, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import * as leaflet from 'leaflet';
import { Location } from '../../../interfaces/location';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../../utils/help-dialog/help-dialog.service';

const imageLocationMarker = leaflet.icon({
  iconUrl: 'assets/markers/image-marker.svg',
  iconSize: [32, 40],
  iconAnchor: [16, 40]
});

const mapLocationMarker = leaflet.icon({
  iconUrl: 'assets/markers/empty-marker.svg',
  iconSize: [32, 40],
  iconAnchor: [16, 40]
});

interface OverrideExifDataDialogData {
  previewUrl?: string;
  fileName?: string;
  imageLocation?: Location;
  mapLocation?: Location;
}

@Component({
  selector: 'app-override-exif-data',
  imports: [FormsModule, DialogHeaderComponent, MatButtonModule, MatSlideToggleModule, MatDialogActions, MatDialogClose, MatDialogContent, MatIcon, TranslocoPipe],
  templateUrl: './override-exif-data.component.html',
  styleUrl: './override-exif-data.component.css'
})
export class OverrideExifDataComponent implements AfterViewInit, OnDestroy {
  readonly dialogRef = inject(MatDialogRef<OverrideExifDataComponent>);
  readonly data = inject<OverrideExifDataDialogData>(MAT_DIALOG_DATA);
  readonly help = inject(HelpDialogService);
  readonly imageMapId = `override-exif-image-map-${Math.random().toString(36).slice(2)}`;
  readonly mapLocationMapId = `override-exif-current-map-${Math.random().toString(36).slice(2)}`;

  applyToAll = true;

  private maps: leaflet.Map[] = [];
  private readonly mapMarkerLocations = new Map<leaflet.Map, leaflet.LatLng>();
  private mapsInitialized = false;

  ngAfterViewInit(): void {
    this.dialogRef.afterOpened().subscribe(() => this.initChoiceMaps());
    setTimeout(() => this.initChoiceMaps(), 250);
  }

  ngOnDestroy(): void {
    for (const map of this.maps) {
      map.remove();
    }
    this.maps = [];
  }

  private initChoiceMaps(): void {
    if (this.mapsInitialized) {
      return;
    }

    const imageLocation = this.data.imageLocation;
    const mapLocation = this.data.mapLocation;

    if (!imageLocation || !mapLocation) {
      return;
    }

    this.mapsInitialized = true;
    this.maps = [
      this.createMiniMap(this.imageMapId, imageLocation, imageLocationMarker),
      this.createMiniMap(this.mapLocationMapId, mapLocation, mapLocationMarker)
    ];

    setTimeout(() => this.refreshChoiceMaps(), 0);
    setTimeout(() => this.refreshChoiceMaps(), 350);
  }

  private createMiniMap(containerId: string, location: Location, icon: leaflet.Icon): leaflet.Map {
    const latLng = leaflet.latLng(location.latitude, location.longitude);
    const map = leaflet.map(containerId, {
      center: latLng,
      zoom: 15,
      worldCopyJump: true,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false
    });

    map.setMaxBounds([[-90, -180], [90, 180]]);

    leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 3,
      noWrap: true,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    leaflet.marker(latLng, { icon, zIndexOffset: 20 }).addTo(map);
    this.mapMarkerLocations.set(map, latLng);
    this.centerMiniMapOnMarker(map, latLng);

    return map;
  }

  private refreshChoiceMaps(): void {
    for (const map of this.maps) {
      map.invalidateSize();
      const markerLocation = this.mapMarkerLocations.get(map);
      if (markerLocation) {
        this.centerMiniMapOnMarker(map, markerLocation);
      }
    }
  }

  private centerMiniMapOnMarker(map: leaflet.Map, markerLocation: leaflet.LatLng): void {
    map.setView(markerLocation, 15, { animate: false });
    map.panBy([0, -Math.round(map.getSize().y * 0.25)], { animate: false });
  }
}
