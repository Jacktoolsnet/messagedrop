import { AfterViewInit, Component, inject, OnDestroy } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import * as leaflet from 'leaflet';
import { DisplayMessageConfig } from '../../../interfaces/display-message-config';
import { Location } from '../../../interfaces/location';
import { NominatimPlace } from '../../../interfaces/nominatim-place';
import { GeolocationService } from '../../../services/geolocation.service';
import { NominatimService } from '../../../services/nominatim.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { DisplayMessage } from '../display-message/display-message.component';
import { HelpDialogService } from '../help-dialog/help-dialog.service';
import { NominatimResultsListComponent } from '../nominatim-search/components/nominatim-results-list/nominatim-results-list.component';

type MarkerKind = 'message' | 'note';

interface LocationPickerDialogData {
  location: Location;
  markerType: MarkerKind;
}

const markerIcons: Record<MarkerKind, leaflet.Icon> = {
  message: leaflet.icon({
    iconUrl: 'assets/markers/location-marker.svg',
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

const selectedSearchMarkerIcon = leaflet.icon({
  iconUrl: 'assets/markers/selected-marker.svg',
  iconSize: [32, 40],
  iconAnchor: [16, 40]
});

@Component({
  selector: 'app-location-picker-dialog',
  standalone: true,
  imports: [
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatIcon,
    MatInputModule,
    ReactiveFormsModule,
    TranslocoPipe,
    NominatimResultsListComponent
  ],
  templateUrl: './location-picker-dialog.component.html',
  styleUrl: './location-picker-dialog.component.css'
})
export class LocationPickerDialogComponent implements AfterViewInit, OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<LocationPickerDialogComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly geolocationService = inject(GeolocationService);
  private readonly nominatimService = inject(NominatimService);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  readonly data = inject<LocationPickerDialogData>(MAT_DIALOG_DATA);

  readonly searchControl = new FormControl('', { nonNullable: true });
  searchResults: NominatimPlace[] = [];
  viewMode: 'list' | 'map' = 'map';

  readonly mapId = `location-picker-map-${Math.random().toString(36).slice(2)}`;
  private map?: leaflet.Map;
  private marker?: leaflet.Marker;
  private searchMarkerLayer?: leaflet.LayerGroup;
  private readonly searchMarkers = new Map<number, leaflet.Marker>();
  private selectedPlaceId?: number;
  private hasAutoZoomed = false;
  private userChangedZoom = false;
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

  locateMe(): void {
    const dialogRef = this.dialog.open(DisplayMessage, {
      panelClass: '',
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.translation.t('common.location.locatingTitle'),
        image: '',
        icon: 'my_location',
        message: this.translation.t('common.location.locatingMessage'),
        button: '',
        delay: 0,
        showSpinner: true
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(() => {
      this.geolocationService.getCurrentPosition().subscribe({
        next: (position) => {
          dialogRef.close();
          const latitude = position.coords.latitude;
          const longitude = position.coords.longitude;
          this.location = {
            latitude,
            longitude,
            plusCode: this.geolocationService.getPlusCode(latitude, longitude)
          };
          this.marker?.setLatLng([latitude, longitude]);
          this.map?.setView([latitude, longitude], 15);
          this.hasAutoZoomed = true;
          this.resetSearchMarkerIcons();
        },
        error: (error) => {
          dialogRef.close();
          const messageKey = error?.code === 1
            ? 'common.location.authorizationRequired'
            : 'common.location.failed';
          this.openDisplayMessage({
            showAlways: true,
            title: this.translation.t('common.location.locatingTitle'),
            image: '',
            icon: 'info',
            message: this.translation.t(messageKey),
            button: '',
            delay: 1500,
            showSpinner: false,
            autoclose: true
          }, false);
        }
      });
    });
  }

  toggleViewMode(): void {
    this.viewMode = this.viewMode === 'list' ? 'map' : 'list';
    if (this.viewMode === 'map') {
      setTimeout(() => this.map?.invalidateSize(), 0);
    }
  }

  flyTo(place: NominatimPlace): void {
    this.viewMode = 'map';
    this.selectResult(place);
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  navigate(place: NominatimPlace): void {
    this.nominatimService.navigateToNominatimPlace(place);
  }

  searchPlaces(): void {
    const term = this.searchControl.value.trim();
    if (!term) {
      this.searchResults = [];
      return;
    }

    this.nominatimService.getNominatimPlaceBySearchTerm(term, 25).subscribe({
      next: (response) => {
        this.applySearchResults(response.result ?? []);
      },
      error: (error) => this.handleSearchError(error)
    });
  }

  selectResult(place: NominatimPlace, shouldNavigate = true): void {
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

    if (!this.map || !shouldNavigate) {
      return;
    }

    if (!this.hasAutoZoomed && !this.userChangedZoom) {
      this.hasAutoZoomed = true;
      this.map.setView([latitude, longitude], 15);
      return;
    }

    this.map.panTo([latitude, longitude]);
  }

  private handleSearchError(error: unknown): void {
    console.error('Location search failed', error);
    this.applySearchResults([]);
  }

  private applySearchResults(results: NominatimPlace[]): void {
    this.searchResults = results;
    this.updateSearchMarkers();
    this.focusMapOnResults(results);
    if (results.length === 0) {
      this.openDisplayMessage({
        showAlways: true,
        title: this.translation.t('common.location.searchTitle'),
        image: '',
        icon: 'info',
        message: this.translation.t('common.location.noResults'),
        button: '',
        delay: 1500,
        showSpinner: false,
        autoclose: true
      }, false);
      return;
    }
    this.selectResult(results[0], false);
  }

  private focusMapOnResults(results: NominatimPlace[]): void {
    if (!this.map || results.length === 0) {
      return;
    }

    const validPoints = results
      .map((place) => {
        const latitude = Number(place.lat);
        const longitude = Number(place.lon);
        return Number.isFinite(latitude) && Number.isFinite(longitude)
          ? leaflet.latLng(latitude, longitude)
          : null;
      })
      .filter((point): point is leaflet.LatLng => point !== null);

    if (validPoints.length === 0) {
      return;
    }

    if (validPoints.length === 1) {
      this.map.setView(validPoints[0], 15);
      this.hasAutoZoomed = true;
      return;
    }

    this.map.fitBounds(leaflet.latLngBounds(validPoints), {
      padding: [24, 24],
      maxZoom: 15
    });
    this.hasAutoZoomed = true;
  }

  private openDisplayMessage(config: DisplayMessageConfig, hasBackdrop = true): void {
    this.dialog.open(DisplayMessage, {
      panelClass: '',
      closeOnNavigation: false,
      data: config,
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop,
      autoFocus: false
    });
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
      const label = (place.name || '').trim();
      if (label) {
        marker.bindTooltip(label, { direction: 'top', offset: [0, -6] });
      }
      marker.on('click', () => this.selectResult(place));
      marker.addTo(this.searchMarkerLayer!);
      this.searchMarkers.set(place.place_id, marker);
    });
    if (this.searchResults.length === 1) {
      const onlyPlace = this.searchResults[0];
      if (onlyPlace) {
        this.setSelectedSearchMarker(onlyPlace.place_id);
      }
    }
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
      currentMarker.setIcon(selectedSearchMarkerIcon);
      this.selectedPlaceId = placeId;
    }
  }

  private resetSearchMarkerIcons(): void {
    this.searchMarkers.forEach(marker => marker.setIcon(searchMarkerIcon));
    this.selectedPlaceId = undefined;
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
      this.marker?.setIcon(selectedSearchMarkerIcon);
      this.resetSearchMarkerIcons();
    });

    this.map.on('zoomstart', (event: leaflet.LeafletEvent) => {
      const zoomEvent = event as leaflet.LeafletEvent & { originalEvent?: Event };
      if (zoomEvent.originalEvent) {
        this.userChangedZoom = true;
      }
    });

    setTimeout(() => this.map?.invalidateSize(), 0);
    this.updateSearchMarkers();
  }
}
