import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, from, map, mergeMap, of, Subscription } from 'rxjs';
import { TripGoDeparture, TripGoStop, TripGoStopsViewport } from '../interfaces/tripgo';
import { TripGoService } from './tripgo.service';

const MIN_ZOOM = 16;
const REQUEST_DEBOUNCE_MS = 150;

@Injectable({ providedIn: 'root' })
export class TripGoStopsMapStateService {
  private readonly tripGo = inject(TripGoService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly enabledState = signal(false);
  private readonly viewportState = signal<TripGoStopsViewport | null>(null);
  private readonly languageState = signal('de');
  private readonly stopsState = signal<TripGoStop[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<HttpErrorResponse | null>(null);

  readonly enabled = this.enabledState.asReadonly();
  readonly viewport = this.viewportState.asReadonly();
  readonly stops = this.stopsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  constructor() {
    effect((onCleanup) => {
      const enabled = this.enabledState();
      const viewport = this.viewportState();
      const language = this.languageState();
      if (!enabled || !viewport || viewport.zoom < MIN_ZOOM || viewport.bounds.length === 0) {
        this.loadingState.set(false);
        this.errorState.set(null);
        this.stopsState.set([]);
        return;
      }

      this.loadingState.set(true);
      this.errorState.set(null);
      const subscriptions = new Subscription();
      const timer = setTimeout(() => {
        subscriptions.add(this.tripGo.getStops(viewport.bounds, language)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (stops) => {
              this.stopsState.set(stops);
              this.loadingState.set(false);
              this.enrichStationModes(stops, language, subscriptions);
            },
            error: (error: HttpErrorResponse) => {
              this.stopsState.set([]);
              this.errorState.set(error);
              this.loadingState.set(false);
            }
          }));
      }, REQUEST_DEBOUNCE_MS);

      onCleanup(() => {
        clearTimeout(timer);
        subscriptions.unsubscribe();
      });
    });
  }

  setEnabled(enabled: boolean): void {
    this.enabledState.set(enabled);
  }

  setViewport(viewport: TripGoStopsViewport): void {
    const current = this.viewportState();
    if (current && sameViewport(current, viewport)) return;
    this.viewportState.set(viewport);
  }

  setLanguage(language: string): void {
    const normalized = typeof language === 'string' && language.trim() ? language.trim() : 'de';
    this.languageState.set(normalized);
  }

  private enrichStationModes(stops: TripGoStop[], language: string, subscriptions: Subscription): void {
    const candidates = stops.filter(needsModeEnrichment);
    if (!candidates.length) return;

    subscriptions.add(from(candidates).pipe(
      mergeMap((stop) => this.tripGo.getDepartures(stop, language).pipe(
        map((departures) => addDepartureModes(stop, departures)),
        catchError(() => of(stop))
      ), 3),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((enrichedStop) => {
      if (enrichedStop === stops.find((stop) => stop.id === enrichedStop.id)) return;
      this.stopsState.update((current) => current.map((stop) =>
        stop.id === enrichedStop.id ? enrichedStop : stop));
    }));
  }
}

function needsModeEnrichment(stop: TripGoStop): boolean {
  if (stop.modeIdentifiers.length !== 1) return false;
  const mode = `${stop.modeIdentifiers[0]} ${stop.modeLabels.join(' ')} ${stop.stopTypes.join(' ')}`.toLowerCase();
  return mode.includes('subway') || mode.includes('metro') || mode.includes('train') || mode.includes('rail');
}

function addDepartureModes(stop: TripGoStop, departures: TripGoDeparture[]): TripGoStop {
  const modeIdentifiers = new Set(stop.modeIdentifiers);
  const modeLabels = new Set(stop.modeLabels);
  const modeIcons = new Set(stop.modeIcons ?? []);
  departures.forEach((departure) => {
    if (departure.modeIdentifier) modeIdentifiers.add(departure.modeIdentifier);
    if (departure.modeLabel) modeLabels.add(departure.modeLabel);
    if (departure.icon) modeIcons.add(departure.icon);
  });
  if (modeIdentifiers.size === stop.modeIdentifiers.length
    && modeLabels.size === stop.modeLabels.length
    && modeIcons.size === (stop.modeIcons?.length ?? 0)) return stop;
  return {
    ...stop,
    modeIdentifiers: [...modeIdentifiers].sort(),
    modeLabels: [...modeLabels].sort(),
    modeIcons: [...modeIcons].sort()
  };
}

function sameViewport(left: TripGoStopsViewport, right: TripGoStopsViewport): boolean {
  return left.zoom === right.zoom
    && left.bounds.length === right.bounds.length
    && left.bounds.every((box, index) => {
      const candidate = right.bounds[index];
      return candidate
        && box.latMin === candidate.latMin
        && box.lonMin === candidate.lonMin
        && box.latMax === candidate.latMax
        && box.lonMax === candidate.lonMax;
    });
}
