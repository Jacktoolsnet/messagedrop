import { AfterViewInit, Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import * as leaflet from 'leaflet';
import { Location } from '../../../interfaces/location';
import { LocationPickerDialogComponent } from '../location-picker-dialog/location-picker-dialog.component';

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
  selector: 'app-location-picker-tile',
  standalone: true,
  imports: [MatButtonModule, MatIcon, TranslocoPipe],
  templateUrl: './location-picker-tile.component.html',
  styleUrl: './location-picker-tile.component.css'
})
export class LocationPickerTileComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) location!: Location;
  @Input() markerType: MarkerKind = 'message';
  @Output() locationChange = new EventEmitter<Location>();

  readonly mapId = `location-preview-map-${Math.random().toString(36).slice(2)}`;
  private map?: leaflet.Map;
  private marker?: leaflet.Marker;
  private isDialogOpen = false;

  private readonly dialog = inject(MatDialog);

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

  openPicker(): void {
    if (this.isDialogOpen) return;
    this.isDialogOpen = true;
    const dialogRef = this.dialog.open(LocationPickerDialogComponent, {
      data: { location: this.location, markerType: this.markerType },
      maxWidth: '95vw',
      maxHeight: '95vh',
      width: '95vw',
      height: '95vh',
      autoFocus: false,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop-transparent',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((result?: Location) => {
      this.isDialogOpen = false;
      if (!result) return;
      this.locationChange.emit(result);
      this.updateMap(result);
    });
  }

  private initMap(): void {
    if (!this.location) return;
    const { latitude, longitude } = this.location;
    this.map = leaflet.map(this.mapId, {
      center: [latitude, longitude],
      zoom: 13,
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

    this.map.on('click', () => this.openPicker());

    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private updateMap(location: Location): void {
    if (!this.map) return;
    const latLng = leaflet.latLng(location.latitude, location.longitude);
    this.map.setView(latLng, this.map.getZoom());
    if (this.marker) {
      this.marker.setLatLng(latLng);
      return;
    }
    this.marker = leaflet.marker(latLng, { icon: markerIcons[this.markerType] }).addTo(this.map);
  }
}
