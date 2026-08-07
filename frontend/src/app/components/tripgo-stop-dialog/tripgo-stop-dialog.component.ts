import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslocoPipe } from '@jsverse/transloco';
import { finalize } from 'rxjs';
import { TripGoDeparture, TripGoLiveServiceDetails, TripGoServiceStop, TripGoStop } from '../../interfaces/tripgo';
import { LanguageService } from '../../services/language.service';
import { TripGoService } from '../../services/tripgo.service';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { TripGoTimelineWeatherComponent } from '../tripgo-route-dialog/tripgo-timeline-weather.component';

@Component({
  selector: 'app-tripgo-stop-dialog',
  imports: [
    DialogHeaderComponent,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TripGoTimelineWeatherComponent,
    TranslocoPipe
  ],
  templateUrl: './tripgo-stop-dialog.component.html',
  styleUrl: './tripgo-stop-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TripGoStopDialogComponent implements OnInit {
  readonly stop = inject<TripGoStop>(MAT_DIALOG_DATA);
  readonly help = inject(HelpDialogService);
  readonly loading = signal(false);
  readonly loadFailed = signal(false);
  readonly departures = signal<TripGoDeparture[]>([]);
  readonly selectedKey = signal<string | null>(null);
  readonly selectedDeparture = signal<TripGoDeparture | null>(null);
  readonly serviceDetails = signal<TripGoLiveServiceDetails | null>(null);
  readonly detailLoading = signal(false);
  readonly detailFailed = signal(false);
  readonly groups = computed<DepartureGroup[]>(() => groupDepartures(this.departures()));
  readonly modeGroups = computed<DepartureModeGroup[]>(() => groupDepartureModes(this.groups()));
  readonly selectedGroup = computed(() => {
    const groups = this.groups();
    return groups.find((group) => group.key === this.selectedKey()) ?? null;
  });
  readonly journeyStops = computed(() => {
    const stops = this.serviceDetails()?.stops ?? [];
    const startStopCode = this.selectedDeparture()?.stopCode;
    const startIndex = startStopCode ? stops.findIndex((stop) => stop.stopCode === startStopCode) : -1;
    return startIndex > 0 ? stops.slice(startIndex) : stops;
  });
  private readonly dialogRef = inject(MatDialogRef<TripGoStopDialogComponent>);
  private readonly tripGo = inject(TripGoService);
  private readonly language = inject(LanguageService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.loadDepartures();
  }

  loadDepartures(): void {
    if (this.loading() || !this.stop.platforms.length) return;
    this.loading.set(true);
    this.loadFailed.set(false);
    this.tripGo.getDepartures(this.stop, this.language.effectiveLanguage())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (departures) => {
          this.departures.set(departures);
          const groups = groupDepartures(departures);
          if (!groups.some((group) => group.key === this.selectedKey())) {
            this.selectedKey.set(groups.length === 1 ? groups[0].key : null);
          }
        },
        error: () => {
          this.departures.set([]);
          this.selectedKey.set(null);
          this.loadFailed.set(true);
        }
      });
  }

  selectGroup(group: DepartureGroup): void {
    this.selectedDeparture.set(null);
    this.serviceDetails.set(null);
    this.selectedKey.set(group.key);
  }

  showLines(): void {
    this.selectedDeparture.set(null);
    this.serviceDetails.set(null);
    this.selectedKey.set(null);
  }

  showDepartures(): void {
    this.selectedDeparture.set(null);
    this.serviceDetails.set(null);
    this.detailFailed.set(false);
  }

  openDeparture(departure: TripGoDeparture): void {
    if (!departure.serviceTripId || this.detailLoading()) return;
    this.selectedDeparture.set(departure);
    this.serviceDetails.set(null);
    this.detailFailed.set(false);
    this.detailLoading.set(true);
    this.tripGo.getDepartureServiceDetails(departure, this.language.effectiveLanguage())
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.detailLoading.set(false))
      )
      .subscribe({
        next: (details) => this.serviceDetails.set(details),
        error: () => this.detailFailed.set(true)
      });
  }

  canOpenDeparture(departure: TripGoDeparture): boolean {
    return Boolean(departure.serviceTripId);
  }

  stopTime(stop: TripGoServiceStop): string {
    return this.time(stop.departureTime || stop.arrivalTime);
  }

  time(value?: string): string {
    if (!value) return '–';
    return new Intl.DateTimeFormat(this.language.effectiveLanguage(), {
      hour: '2-digit', minute: '2-digit'
    }).format(new Date(value));
  }

  modeIcon(group: DepartureGroup): string {
    const mode = `${group.modeIdentifier ?? ''} ${group.modeLabel ?? ''}`.toLowerCase();
    if (mode.includes('ferry')) return 'directions_boat';
    if (mode.includes('tram')) return 'tram';
    if (mode.includes('subway') || mode.includes('metro')) return 'subway';
    if (mode.includes('train') || mode.includes('rail')) return 'train';
    return 'directions_bus';
  }

  delayMinutes(departure: TripGoDeparture): number {
    return Math.max(0, Math.round((departure.delaySeconds ?? 0) / 60));
  }

  close(): void {
    this.dialogRef.close();
  }
}

interface DepartureGroup {
  key: string;
  line: string;
  direction?: string;
  modeIdentifier?: string;
  modeLabel?: string;
  color?: string;
  departures: TripGoDeparture[];
}

interface DepartureModeGroup {
  key: string;
  titleKey: string;
  icon: string;
  groups: DepartureGroup[];
}

function groupDepartures(departures: TripGoDeparture[]): DepartureGroup[] {
  const groups = new Map<string, DepartureGroup>();
  for (const departure of departures) {
    const rawLine = departure.line || departure.serviceName || '–';
    const line = departureServiceLabel(departure.modeLabel, rawLine);
    const key = [departure.operatorId || departure.operator, departure.routeId || rawLine, departure.direction]
      .filter(Boolean).join('|');
    const group = groups.get(key) ?? {
      key, line, direction: departure.direction, modeIdentifier: departure.modeIdentifier,
      modeLabel: departure.modeLabel, color: departure.color, departures: []
    };
    group.departures.push(departure);
    groups.set(key, group);
  }
  return [...groups.values()].sort((left, right) => {
    const timeDifference = Date.parse(left.departures[0].departureTime)
      - Date.parse(right.departures[0].departureTime);
    return timeDifference || left.line.localeCompare(right.line, undefined, { numeric: true });
  });
}

function departureServiceLabel(modeLabel: string | undefined, line: string): string {
  const mode = modeLabel?.trim();
  if (!mode) return line;
  const normalizedMode = mode.toLocaleLowerCase();
  const normalizedLine = line.toLocaleLowerCase();
  if (normalizedLine.startsWith(normalizedMode) || normalizedMode.includes(normalizedLine)) return line;
  return `${mode} ${line}`;
}

function groupDepartureModes(groups: DepartureGroup[]): DepartureModeGroup[] {
  const modeGroups = new Map<string, DepartureModeGroup>();
  for (const group of groups) {
    const descriptor = departureModeDescriptor(group);
    const modeGroup = modeGroups.get(descriptor.key) ?? { ...descriptor, groups: [] };
    modeGroup.groups.push(group);
    modeGroups.set(descriptor.key, modeGroup);
  }
  const order = ['bus', 'tram', 'subway', 's-bahn', 'train', 'ferry', 'other'];
  return [...modeGroups.values()].sort((left, right) => order.indexOf(left.key) - order.indexOf(right.key));
}

function departureModeDescriptor(group: DepartureGroup): Omit<DepartureModeGroup, 'groups'> {
  const mode = `${group.modeIdentifier ?? ''} ${group.modeLabel ?? ''}`.toLowerCase();
  if (mode.includes('s-bahn')) {
    return { key: 's-bahn', titleKey: 'common.tripGoStops.modeGroups.suburbanTrain', icon: 'train' };
  }
  if (mode.includes('tram')) {
    return { key: 'tram', titleKey: 'common.tripGoStops.modeGroups.tram', icon: 'tram' };
  }
  if (mode.includes('subway') || mode.includes('metro')) {
    return { key: 'subway', titleKey: 'common.tripGoStops.modeGroups.subway', icon: 'subway' };
  }
  if (mode.includes('train') || mode.includes('rail') || mode.includes('ice') || mode.includes('ic/ec')) {
    return { key: 'train', titleKey: 'common.tripGoStops.modeGroups.train', icon: 'train' };
  }
  if (mode.includes('ferry')) {
    return { key: 'ferry', titleKey: 'common.tripGoStops.modeGroups.ferry', icon: 'directions_boat' };
  }
  if (mode.includes('bus')) {
    return { key: 'bus', titleKey: 'common.tripGoStops.modeGroups.bus', icon: 'directions_bus' };
  }
  return { key: 'other', titleKey: 'common.tripGoStops.modeGroups.other', icon: 'directions_transit' };
}
