import { CommonModule } from '@angular/common';
import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { finalize } from 'rxjs';
import * as leaflet from 'leaflet';
import { NominatimPlace } from '../../../interfaces/nominatim-place.interface';
import { NominatimService } from '../../../services/location/nominatim.service';

export interface PublicContentLocationMapDialogData {
  latitude: number;
  longitude: number;
  label: string;
}

export interface PublicContentLocationMapDialogResult {
  latitude: number;
  longitude: number;
  label: string;
}

@Component({
  selector: 'app-public-content-location-map-dialog',
  imports: [
    CommonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule
  ],
  templateUrl: './public-content-location-map-dialog.component.html',
  styleUrl: './public-content-location-map-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicContentLocationMapDialogComponent implements AfterViewInit, OnDestroy {
  private readonly dialogRef = inject(MatDialogRef<PublicContentLocationMapDialogComponent, PublicContentLocationMapDialogResult>);
  private readonly data = inject<PublicContentLocationMapDialogData>(MAT_DIALOG_DATA);
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);
  private readonly nominatimService = inject(NominatimService);

  readonly mapElement = viewChild<ElementRef<HTMLDivElement>>('mapElement');
  readonly selectedLatitude = signal(this.data.latitude);
  readonly selectedLongitude = signal(this.data.longitude);
  readonly selectedLabel = signal(this.data.label.trim() || this.formatCoordinates(this.data.latitude, this.data.longitude));
  readonly reverseLookupPending = signal(false);
  readonly selectedCoordinatesText = computed(() => (
    `${this.selectedLatitude().toFixed(5)}, ${this.selectedLongitude().toFixed(5)}`
  ));

  private map?: leaflet.Map;
  private marker?: leaflet.CircleMarker;
  private reverseLookupToken = 0;

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.map?.off();
    this.map?.remove();
  }

  close(): void {
    this.dialogRef.close();
  }

  apply(): void {
    this.dialogRef.close({
      latitude: this.selectedLatitude(),
      longitude: this.selectedLongitude(),
      label: this.selectedLabel().trim() || this.formatCoordinates(this.selectedLatitude(), this.selectedLongitude())
    });
  }

  private initMap(): void {
    const host = this.mapElement()?.nativeElement;
    if (!host) {
      return;
    }

    this.map = leaflet.map(host, {
      center: [this.selectedLatitude(), this.selectedLongitude()],
      zoom: 15,
      zoomControl: true,
      worldCopyJump: true
    });

    leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      minZoom: 2,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.map);

    this.marker = leaflet.circleMarker([this.selectedLatitude(), this.selectedLongitude()], {
      radius: 9,
      weight: 3,
      opacity: 1,
      color: '#0f766e',
      fillColor: '#14b8a6',
      fillOpacity: 0.25
    }).addTo(this.map);

    this.map.on('click', (event: leaflet.LeafletMouseEvent) => {
      this.zone.run(() => this.updateSelection(event.latlng.lat, event.latlng.lng));
    });

    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private updateSelection(latitude: number, longitude: number): void {
    this.selectedLatitude.set(latitude);
    this.selectedLongitude.set(longitude);
    this.marker?.setLatLng([latitude, longitude]);
    this.map?.panTo([latitude, longitude]);
    this.selectedLabel.set(this.formatCoordinates(latitude, longitude));

    const token = ++this.reverseLookupToken;
    this.reverseLookupPending.set(true);
    this.nominatimService.reverseGeocode(latitude, longitude)
      .pipe(
        finalize(() => {
          if (token === this.reverseLookupToken) {
            this.reverseLookupPending.set(false);
          }
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (place) => {
          if (token !== this.reverseLookupToken) {
            return;
          }
          this.selectedLabel.set(place ? this.getLocationLabel(place) : this.formatCoordinates(latitude, longitude));
        },
        error: () => {
          if (token !== this.reverseLookupToken) {
            return;
          }
          this.selectedLabel.set(this.formatCoordinates(latitude, longitude));
        }
      });
  }

  private getLocationLabel(place: NominatimPlace): string {
    return String(
      place.name?.trim()
      || place.address?.city?.trim()
      || place.address?.town?.trim()
      || place.address?.village?.trim()
      || place.address?.suburb?.trim()
      || place.display_name?.trim()
      || this.formatCoordinates(Number(place.lat), Number(place.lon))
    ).trim();
  }

  private formatCoordinates(latitude: number, longitude: number): string {
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  }
}
