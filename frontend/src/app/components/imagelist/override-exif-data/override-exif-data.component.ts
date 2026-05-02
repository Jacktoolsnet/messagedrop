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

  ngAfterViewInit(): void {
    this.initPreviewMap();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private initPreviewMap(): void {
    const imageLocation = this.data.imageLocation;
    const mapLocation = this.data.mapLocation;

    if (!imageLocation || !mapLocation) {
      return;
    }

    this.map = leaflet.map(this.mapId, {
      center: [imageLocation.latitude, imageLocation.longitude],
      zoom: 15,
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

    const imageLatLng = leaflet.latLng(imageLocation.latitude, imageLocation.longitude);
    const mapLatLng = leaflet.latLng(mapLocation.latitude, mapLocation.longitude);

    leaflet.marker(imageLatLng, { icon: imageLocationMarker, zIndexOffset: 20 }).addTo(this.map);
    leaflet.marker(mapLatLng, { icon: mapLocationMarker, zIndexOffset: 10 }).addTo(this.map);

    const fitLocations = () => {
      if (!this.map) {
        return;
      }
      const bounds = leaflet.latLngBounds([imageLatLng, mapLatLng]);
      if (imageLatLng.equals(mapLatLng)) {
        this.map.setView(imageLatLng, 16);
      } else {
        this.map.fitBounds(bounds, {
          padding: [32, 32],
          maxZoom: 16
        });
      }
    };

    fitLocations();
    setTimeout(() => {
      this.map?.invalidateSize();
      fitLocations();
    }, 0);
  }
}
