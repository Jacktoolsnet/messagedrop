import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { TripGoRouteOption, TripGoRouteSegment } from '../../interfaces/tripgo';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { tripGoSegmentIcon } from './tripgo-route.util';

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
    TranslocoPipe
  ],
  templateUrl: './tripgo-route-point-dialog.component.html',
  styleUrl: './tripgo-route-point-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TripGoRoutePointDialogComponent {
  readonly data = inject<TripGoRoutePointDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<TripGoRoutePointDialogComponent>);
  private readonly transloco = inject(TranslocoService);
  readonly help = inject(HelpDialogService);

  readonly segment = computed<TripGoRouteSegment>(() => this.data.kind === 'arrival'
    ? this.data.route.segments.at(-1)!
    : this.data.route.segments[this.data.segmentIndex]);
  readonly location = computed(() => this.data.kind === 'arrival' ? this.segment().to : this.segment().from);
  readonly title = computed(() => this.location()?.name
    || this.transloco.translate(this.data.kind === 'arrival' ? 'common.tripGo.destination' : 'common.tripGo.routePointDetails.title'));
  readonly icon = computed(() => this.data.kind === 'arrival' ? 'location_on' : tripGoSegmentIcon(this.segment()));
  readonly subtitle = computed(() => {
    const service = this.segment().service;
    if (this.data.kind === 'arrival') return this.transloco.translate('common.tripGo.routePointDetails.arrival');
    return [service?.number, service?.direction].filter(Boolean).join(' · ')
      || this.segment().modeLabel
      || this.transloco.translate('common.tripGo.routePointDetails.segment');
  });
  readonly ticketUrl = computed(() => this.safeUrl(this.segment().service?.ticketWebsiteUrl));
  readonly hasLiveData = computed(() => {
    const status = this.segment().service?.realTimeStatus?.toUpperCase();
    return !!status && status.includes('REAL_TIME') && !status.includes('NOT_');
  });

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

  formatCost(amount: number, currency: string): string {
    return new Intl.NumberFormat(this.transloco.getActiveLang() || 'de', {
      style: 'currency', currency
    }).format(amount);
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
