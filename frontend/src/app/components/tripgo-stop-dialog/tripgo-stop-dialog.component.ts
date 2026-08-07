import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';
import { finalize } from 'rxjs';
import { TripGoDeparture, TripGoStop } from '../../interfaces/tripgo';
import { LanguageService } from '../../services/language.service';
import { TripGoService } from '../../services/tripgo.service';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';

@Component({
  selector: 'app-tripgo-stop-dialog',
  imports: [
    DialogHeaderComponent,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIconModule,
    MatProgressSpinnerModule,
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
  readonly groups = computed<DepartureGroup[]>(() => groupDepartures(this.departures()));
  readonly selectedGroup = computed(() => {
    const groups = this.groups();
    return groups.find((group) => group.key === this.selectedKey()) ?? groups[0] ?? null;
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
            this.selectedKey.set(groups[0]?.key ?? null);
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
    this.selectedKey.set(group.key);
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

function groupDepartures(departures: TripGoDeparture[]): DepartureGroup[] {
  const groups = new Map<string, DepartureGroup>();
  for (const departure of departures) {
    const line = departure.line || departure.serviceName || '–';
    const key = [departure.operatorId || departure.operator, departure.routeId || line, departure.direction]
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
