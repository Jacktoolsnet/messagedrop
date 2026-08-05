import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Location } from '../../interfaces/location';
import { TripGoRouteOption, TripGoRouteSegment } from '../../interfaces/tripgo';
import { GeolocationService } from '../../services/geolocation.service';
import { TripGoService } from '../../services/tripgo.service';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';

export interface TripGoRouteDialogData {
  destination: Location;
}

type RouteDialogState = 'locating' | 'routing' | 'ready' | 'error';

@Component({
  selector: 'app-tripgo-route-dialog',
  imports: [
    DialogHeaderComponent,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe
  ],
  templateUrl: './tripgo-route-dialog.component.html',
  styleUrl: './tripgo-route-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TripGoRouteDialogComponent implements OnInit {
  private readonly data = inject<TripGoRouteDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<TripGoRouteDialogComponent>);
  private readonly destroyRef = inject(DestroyRef);
  private readonly geolocation = inject(GeolocationService);
  private readonly tripGo = inject(TripGoService);
  private readonly transloco = inject(TranslocoService);
  readonly help = inject(HelpDialogService);

  readonly destination = this.data.destination;
  readonly state = signal<RouteDialogState>('locating');
  readonly routes = signal<TripGoRouteOption[]>([]);
  readonly errorKey = signal('common.tripGo.errors.route');
  readonly isBusy = computed(() => this.state() === 'locating' || this.state() === 'routing');

  ngOnInit(): void {
    this.calculateWithFreshLocation();
  }

  calculateWithFreshLocation(): void {
    this.routes.set([]);
    this.state.set('locating');
    this.geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 20_000
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (position) => {
        const origin: Location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          plusCode: this.geolocation.getPlusCode(position.coords.latitude, position.coords.longitude)
        };
        this.loadRoutes(origin);
      },
      error: (error: GeolocationPositionError | unknown) => {
        const code = typeof error === 'object' && error !== null && 'code' in error ? Number(error.code) : 0;
        this.errorKey.set(code === 1
          ? 'common.tripGo.errors.locationPermission'
          : 'common.tripGo.errors.location');
        this.state.set('error');
      }
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  formatTime(value: string): string {
    return new Intl.DateTimeFormat(this.transloco.getActiveLang() || 'de', {
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(value));
  }

  formatDuration(seconds: number): string {
    const minutes = Math.max(1, Math.round(seconds / 60));
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return hours > 0 ? `${hours} h ${remainingMinutes} min` : `${minutes} min`;
  }

  formatDistance(metres: number): string {
    const locale = this.transloco.getActiveLang() || 'de';
    if (metres >= 1000) {
      return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(metres / 1000)} km`;
    }
    return `${Math.round(metres)} m`;
  }

  segmentLabel(segment: TripGoRouteSegment): string {
    return segment.service?.number || segment.modeLabel || segment.modeIdentifier || '';
  }

  segmentIcon(segment: TripGoRouteSegment): string {
    const identifier = segment.modeIdentifier || '';
    if (identifier.includes('bus')) return 'directions_bus';
    if (identifier.includes('tram')) return 'tram';
    if (identifier.includes('train') || identifier.includes('subway')) return 'train';
    if (identifier.startsWith('wa_')) return 'directions_walk';
    if (segment.type === 'stationary') return 'schedule';
    return 'directions_transit';
  }

  private loadRoutes(origin: Location): void {
    this.state.set('routing');
    this.tripGo.calculatePublicTransportRoute(
      origin,
      this.destination,
      this.transloco.getActiveLang() || 'de'
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => {
        this.routes.set(result.routes);
        this.state.set('ready');
      },
      error: () => {
        this.errorKey.set('common.tripGo.errors.route');
        this.state.set('error');
      }
    });
  }
}
