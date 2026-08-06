import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { TripGoLiveServiceDetails, TripGoRouteOption, TripGoRouteSegment } from '../../interfaces/tripgo';
import { TripGoService } from '../../services/tripgo.service';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import {
  tripGoDisplayLocationName,
  tripGoFollowingBoardingPlatform,
  tripGoServiceLabel,
  tripGoSegmentIcon,
  tripGoSegmentInstructionLocation
} from './tripgo-route.util';
import { TripGoNearbyTilesComponent } from './tripgo-nearby-tiles.component';

export interface TripGoRoutePointDialogData {
  kind: 'segment' | 'arrival';
  route: TripGoRouteOption;
  segmentIndex: number;
}

@Component({
  selector: 'app-tripgo-route-point-dialog',
  imports: [
    DialogHeaderComponent,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIconModule,
    MatProgressSpinnerModule,
    TripGoNearbyTilesComponent,
    TranslocoPipe
  ],
  templateUrl: './tripgo-route-point-dialog.component.html',
  styleUrl: './tripgo-route-point-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TripGoRoutePointDialogComponent implements OnInit {
  readonly data = inject<TripGoRoutePointDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<TripGoRoutePointDialogComponent>);
  private readonly transloco = inject(TranslocoService);
  private readonly tripGo = inject(TripGoService);
  private readonly destroyRef = inject(DestroyRef);
  readonly help = inject(HelpDialogService);

  readonly segment = computed<TripGoRouteSegment>(() => this.data.kind === 'arrival'
    ? this.data.route.segments.at(-1)!
    : this.data.route.segments[this.data.segmentIndex]);
  readonly location = computed(() => this.data.kind === 'arrival' ? this.segment().to : this.segment().from);
  readonly title = computed(() => this.location()?.name
    || this.transloco.translate(this.data.kind === 'arrival' ? 'common.tripGo.destination' : 'common.tripGo.routePointDetails.title'));
  readonly icon = computed(() => this.data.kind === 'arrival' ? 'location_on' : tripGoSegmentIcon(this.segment()));
  readonly boardingPlatform = computed(() => this.data.kind === 'segment'
    ? tripGoFollowingBoardingPlatform(this.data.route, this.data.segmentIndex)
    : undefined);
  readonly instructionLocation = computed(() => this.data.kind === 'segment'
    ? tripGoSegmentInstructionLocation(this.data.route, this.data.segmentIndex)
    : undefined);
  readonly modeLabel = computed(() => this.segment().type === 'stationary'
    ? this.transloco.translate('common.tripGo.waitingTime')
    : this.segment().modeLabel);
  readonly subtitle = computed(() => {
    const service = this.segment().service;
    if (this.data.kind === 'arrival') return this.transloco.translate('common.tripGo.routePointDetails.arrival');
    const serviceLabel = tripGoServiceLabel(this.segment());
    const destination = tripGoDisplayLocationName(this.segment().to?.name);
    const scheduledLabel = serviceLabel && destination
      ? this.transloco.translate('common.tripGo.serviceToLocation', { service: serviceLabel, location: destination })
      : serviceLabel;
    const modeLabel = this.modeLabel()
      || this.transloco.translate('common.tripGo.routePointDetails.segment');
    const platform = this.boardingPlatform();
    const location = this.instructionLocation();
    if (service && scheduledLabel) return scheduledLabel;
    if (this.segment().type === 'stationary') {
      return location
        ? this.transloco.translate('common.tripGo.waitingAt', { mode: modeLabel, location })
        : modeLabel;
    }
    if (location && platform) {
      return this.transloco.translate('common.tripGo.toLocationPlatform', { mode: modeLabel, location, platform });
    }
    return location
      ? this.transloco.translate('common.tripGo.toLocation', { mode: modeLabel, location })
      : modeLabel;
  });
  readonly ticketUrl = computed(() => this.safeUrl(this.segment().service?.ticketWebsiteUrl));
  readonly liveDetails = signal<TripGoLiveServiceDetails | null>(null);
  readonly liveState = signal<'idle' | 'loading' | 'ready' | 'error'>('idle');
  readonly canLoadLiveDetails = computed(() => !!(
    this.segment().from?.region
    && this.segment().from?.stopCode
    && this.segment().service?.tripId
    && this.segment().startTime
  ));
  readonly hasLiveData = computed(() => {
    const status = this.segment().service?.realTimeStatus?.toUpperCase();
    return this.liveDetails()?.realTime === true
      || (!!status && status.includes('REAL_TIME') && !status.includes('NOT_'));
  });

  ngOnInit(): void {
    this.loadLiveDetails();
  }

  loadLiveDetails(): void {
    if (!this.canLoadLiveDetails() || this.liveState() === 'loading') return;
    this.liveState.set('loading');
    this.tripGo.getServiceDetails(this.segment(), this.transloco.getActiveLang() || 'de').pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (details) => {
        this.liveDetails.set(details);
        this.liveState.set('ready');
      },
      error: () => this.liveState.set('error')
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  formatTime(value: string | undefined): string {
    if (!value) return '–';
    return new Intl.DateTimeFormat(this.transloco.getActiveLang() || 'de', {
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(value));
  }

  formatDuration(seconds: number): string {
    const minutes = Math.max(1, Math.round(seconds / 60));
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return hours ? `${hours} h ${rest} min` : `${minutes} min`;
  }

  formatDistance(metres: number): string {
    const locale = this.transloco.getActiveLang() || 'de';
    return metres >= 1000
      ? `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(metres / 1000)} km`
      : `${Math.round(metres)} m`;
  }

  intermediateStopCount(): number | undefined {
    const service = this.segment().service;
    if (!service) return undefined;
    return service.intermediateStops
      ? service.intermediateStops.length
      : service.stops === undefined ? undefined : Math.max(0, service.stops - 1);
  }

  formatCost(amount: number, currency: string): string {
    return new Intl.NumberFormat(this.transloco.getActiveLang() || 'de', {
      style: 'currency', currency
    }).format(amount);
  }

  formatDelay(seconds: number): string {
    const minutes = Math.round(Math.abs(seconds) / 60);
    if (Math.abs(seconds) < 30) return this.transloco.translate('common.tripGo.routePointDetails.onTime');
    return this.transloco.translate(seconds > 0
      ? 'common.tripGo.routePointDetails.delayed'
      : 'common.tripGo.routePointDetails.early', { minutes });
  }

  private safeUrl(value: string | undefined): string | null {
    if (!value) return null;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' ? url.toString() : null;
    } catch {
      return null;
    }
  }
}
