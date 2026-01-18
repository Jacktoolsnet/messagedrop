import { AfterViewInit, Component, inject, OnDestroy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import * as leaflet from 'leaflet';
import { Location } from '../../../interfaces/location';
import { NominatimPlace } from '../../../interfaces/nominatim-place';
import { GeolocationService } from '../../../services/geolocation.service';
import { NominatimService } from '../../../services/nominatim.service';

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

const searchMarkerIcon = leaflet.icon({
  iconUrl: 'assets/markers/location-marker.svg',
  iconSize: [32, 40],
  iconAnchor: [16, 40]
});

@Component({
  selector: 'app-location-picker-dialog',
  standalone: true,
  imports: [MatDialogContent, MatDialogActions, MatButtonModule, MatCardModule, MatIcon, MatInputModule, ReactiveFormsModule, TranslocoPipe],
  templateUrl: './location-picker-dialog.component.html',
  styleUrl: './location-picker-dialog.component.css'
})
export class LocationPickerDialogComponent implements AfterViewInit, OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<LocationPickerDialogComponent>);
  private readonly geolocationService = inject(GeolocationService);
  private readonly nominatimService = inject(NominatimService);
  readonly data = inject<LocationPickerDialogData>(MAT_DIALOG_DATA);

  readonly searchControl = new FormControl('', { nonNullable: true });
  searchResults: NominatimPlace[] = [];

  readonly mapId = `location-picker-map-${Math.random().toString(36).slice(2)}`;
  private map?: leaflet.Map;
  private marker?: leaflet.Marker;
  private searchMarkerLayer?: leaflet.LayerGroup;
  private readonly searchMarkers = new Map<number, leaflet.Marker>();
  private selectedPlaceId?: number;
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

  searchPlaces(): void {
    const term = this.searchControl.value.trim();
    if (!term) {
      this.searchResults = [];
      return;
    }

    const bounds = this.map?.getBounds();
    if (bounds) {
      const southWest = bounds.getSouthWest();
      const northEast = bounds.getNorthEast();
      this.nominatimService.getNominatimPlaceBySearchTermWithBoundingBox(term, {
        latMin: southWest.lat,
        lonMin: southWest.lng,
        latMax: northEast.lat,
        lonMax: northEast.lng
      }, 25).subscribe({
        next: (response) => {
          this.searchResults = response.result ?? [];
          this.updateSearchMarkers();
        },
        error: (error) => this.handleSearchError(error)
      });
      return;
    }

    this.nominatimService.getNominatimPlaceBySearchTermWithViewbox(
      term,
      this.location.latitude,
      this.location.longitude,
      25,
      20000
    ).subscribe({
      next: (response) => {
        this.searchResults = response.result ?? [];
        this.updateSearchMarkers();
      },
      error: (error) => this.handleSearchError(error)
    });
  }

  selectResult(place: NominatimPlace): void {
    this.setSelectedSearchMarker(place.place_id);
    const latitude = Number(place.lat);
    const longitude = Number(place.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }
    this.location = {
      latitude,
      longitude,
      plusCode: this.geolocationService.getPlusCode(latitude, longitude)
    };
    this.marker?.setLatLng([latitude, longitude]);

    if (!this.map) {
      return;
    }

    const bounds = this.nominatimService.getBoundingBoxFromNominatimPlace(place);
    const hasBounds = bounds.latMin !== 0 || bounds.latMax !== 0 || bounds.lonMin !== 0 || bounds.lonMax !== 0;
    if (hasBounds) {
      this.map.fitBounds([
        [bounds.latMin, bounds.lonMin],
        [bounds.latMax, bounds.lonMax]
      ], { padding: [24, 24], maxZoom: 15 });
      return;
    }
    this.map.setView([latitude, longitude], Math.max(this.map.getZoom(), 15));
  }

  getIconForPlace(place: NominatimPlace): string {
    return this.nominatimService.getIconForPlace(place);
  }

  getFormattedAddress(place: NominatimPlace): string {
    return this.nominatimService.getFormattedAddress(place);
  }

  private handleSearchError(error: unknown): void {
    console.error('Location search failed', error);
    this.searchResults = [];
    this.updateSearchMarkers();
  }

  private updateSearchMarkers(): void {
    if (!this.map) {
      return;
    }
    if (!this.searchMarkerLayer) {
      this.searchMarkerLayer = leaflet.layerGroup().addTo(this.map);
    }
    this.searchMarkerLayer.clearLayers();
    this.searchMarkers.clear();
    this.selectedPlaceId = undefined;
    this.searchResults.forEach(place => {
      const latitude = Number(place.lat);
      const longitude = Number(place.lon);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return;
      }
      const marker = leaflet.marker([latitude, longitude], { icon: searchMarkerIcon });
      marker.on('click', () => this.selectResult(place));
      marker.addTo(this.searchMarkerLayer!);
      this.searchMarkers.set(place.place_id, marker);
    });
  }

  private setSelectedSearchMarker(placeId: number): void {
    if (this.selectedPlaceId !== undefined) {
      const previousMarker = this.searchMarkers.get(this.selectedPlaceId);
      if (previousMarker) {
        previousMarker.setIcon(searchMarkerIcon);
      }
    }
    const currentMarker = this.searchMarkers.get(placeId);
    if (currentMarker) {
      currentMarker.setIcon(markerIcons[this.data.markerType]);
      this.selectedPlaceId = placeId;
    }
  }

  private initMap(): void {
    const { latitude, longitude } = this.location;
    this.map = leaflet.map(this.mapId, {
      center: [latitude, longitude],
      zoom: 2,
      worldCopyJump: true
    });

    this.map.setMaxBounds([[-90, -180], [90, 180]]);

    leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 2,
      noWrap: true,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(this.map);

    this.marker = leaflet.marker([latitude, longitude], {
      icon: markerIcons[this.data.markerType]
    }).addTo(this.map);
    this.searchMarkerLayer = leaflet.layerGroup().addTo(this.map);

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
    this.updateSearchMarkers();
  }
}
