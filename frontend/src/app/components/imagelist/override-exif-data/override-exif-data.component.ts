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
  readonly mapId = `override-exif-map-${Math.random().toString(36).slice(2)}`;

  applyToAll = true;

  private map?: leaflet.Map;
  private mapInitialized = false;

  ngAfterViewInit(): void {
    this.dialogRef.afterOpened().subscribe(() => this.initPreviewMap());
    setTimeout(() => this.initPreviewMap(), 250);
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initPreviewMap(): void {
    if (this.mapInitialized) {
      return;
    }

    const imageLocation = this.data.imageLocation;
    const mapLocation = this.data.mapLocation;

    if (!imageLocation || !mapLocation) {
      return;
    }

    this.mapInitialized = true;
    this.map = leaflet.map(this.mapId, {
      center: [imageLocation.latitude, imageLocation.longitude],
      zoom: 3,
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

    const tiles = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 3,
      noWrap: true,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);

    const imageLatLng = leaflet.latLng(imageLocation.latitude, imageLocation.longitude);
    const mapLatLng = leaflet.latLng(mapLocation.latitude, mapLocation.longitude);

    leaflet.marker(imageLatLng, { icon: imageLocationMarker, zIndexOffset: 20 }).addTo(this.map);
    leaflet.marker(mapLatLng, { icon: mapLocationMarker, zIndexOffset: 10 }).addTo(this.map);

    const fitLocations = () => {
      if (!this.map) {
        return;
      }

      const bounds = leaflet.latLngBounds([imageLatLng, mapLatLng]);
      const center = this.getCenterLocation(imageLatLng, mapLatLng);

      if (imageLatLng.equals(mapLatLng)) {
        this.map.setView(center, 13, { animate: false });
        return;
      }

      const zoom = this.getZoomForBounds(bounds);
      this.map.setView(center, zoom, { animate: false });
    };

    fitLocations();
    tiles.once('load', fitLocations);
    setTimeout(() => {
      this.map?.invalidateSize();
      fitLocations();
    }, 0);
    setTimeout(() => {
      this.map?.invalidateSize();
      fitLocations();
    }, 350);
  }

  private getCenterLocation(first: leaflet.LatLng, second: leaflet.LatLng): leaflet.LatLng {
    return leaflet.latLng(
      (first.lat + second.lat) / 2,
      (first.lng + second.lng) / 2
    );
  }

  private getZoomForBounds(bounds: leaflet.LatLngBounds): number {
    if (!this.map) {
      return 3;
    }

    const boundsZoom = this.map.getBoundsZoom(bounds, false, leaflet.point(64, 76));
    const fallbackZoom = 3;
    const zoom = Number.isFinite(boundsZoom) ? boundsZoom : fallbackZoom;

    return Math.max(3, Math.min(13, zoom));
  }
}
