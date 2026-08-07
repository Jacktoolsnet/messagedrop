import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { TripGoStop, TripGoStopsViewport } from '../interfaces/tripgo';
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
      let subscription: Subscription | undefined;
      const timer = setTimeout(() => {
        subscription = this.tripGo.getStops(viewport.bounds, language)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (stops) => {
              this.stopsState.set(stops);
              this.loadingState.set(false);
            },
            error: (error: HttpErrorResponse) => {
              this.stopsState.set([]);
              this.errorState.set(error);
              this.loadingState.set(false);
            }
          });
      }, REQUEST_DEBOUNCE_MS);

      onCleanup(() => {
        clearTimeout(timer);
        subscription?.unsubscribe();
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
