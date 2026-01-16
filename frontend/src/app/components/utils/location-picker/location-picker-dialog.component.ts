import { AfterViewInit, Component, inject, OnDestroy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import * as leaflet from 'leaflet';
import { Location } from '../../../interfaces/location';
import { GeolocationService } from '../../../services/geolocation.service';

type MarkerKind = 'message' | 'note';

interface LocationPickerDialogData {
  location: Location;
  markerType: MarkerKind;
}

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
  selector: 'app-location-picker-dialog',
  standalone: true,
  imports: [MatDialogTitle, MatDialogContent, MatDialogActions, MatButtonModule, MatIcon, TranslocoPipe],
  templateUrl: './location-picker-dialog.component.html',
  styleUrl: './location-picker-dialog.component.css'
})
export class LocationPickerDialogComponent implements AfterViewInit, OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<LocationPickerDialogComponent>);
  private readonly geolocationService = inject(GeolocationService);
  readonly data = inject<LocationPickerDialogData>(MAT_DIALOG_DATA);

  readonly mapId = `location-picker-map-${Math.random().toString(36).slice(2)}`;
  private map?: leaflet.Map;
  private marker?: leaflet.Marker;
  private location: Location = { ...this.data.location };

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  cancel(): void {
    this.dialogRef.close();
  }

  apply(): void {
    this.dialogRef.close({ ...this.location });
  }

  private initMap(): void {
    const { latitude, longitude } = this.location;
    this.map = leaflet.map(this.mapId, {
      center: [latitude, longitude],
      zoom: 14,
      worldCopyJump: true
    });

    this.map.setMaxBounds([[-90, -180], [90, 180]]);

    leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 3,
      noWrap: true,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);

    this.marker = leaflet.marker([latitude, longitude], {
      icon: markerIcons[this.data.markerType]
    }).addTo(this.map);

    this.map.on('click', (event: leaflet.LeafletMouseEvent) => {
      const { lat, lng } = event.latlng;
      this.location = {
        latitude: lat,
        longitude: lng,
        plusCode: this.geolocationService.getPlusCode(lat, lng)
      };
      this.marker?.setLatLng(event.latlng);
    });

    setTimeout(() => this.map?.invalidateSize(), 0);
  }
}
