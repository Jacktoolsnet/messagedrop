import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { OverpassPoi, OverpassViewport } from '../interfaces/overpass';
import { OverpassService } from './overpass.service';

// Map interactions can emit many viewport updates in quick succession. A
// slightly longer pause protects the public Overpass instance from requests
// that would be obsolete before their response arrives.
const REQUEST_DEBOUNCE_MS = 750;

@Injectable({ providedIn: 'root' })
export class OverpassMapStateService {
  private readonly overpass = inject(OverpassService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly viewportState = signal<OverpassViewport | null>(null);
  private readonly poisState = signal<OverpassPoi[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<HttpErrorResponse | null>(null);

  readonly viewport = this.viewportState.asReadonly();
  readonly pois = this.poisState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();

  constructor() {
    effect((onCleanup) => {
      const viewport = this.viewportState();
      if (!viewport || !viewport.bounds.length || !Object.keys(viewport.categories).length) {
        this.loadingState.set(false);
        this.errorState.set(null);
        this.poisState.set([]);
        return;
      }

      this.loadingState.set(true);
      this.errorState.set(null);
      let subscription: Subscription | undefined;
      const timer = setTimeout(() => {
        subscription = this.overpass.getNearby(viewport.bounds, viewport.categories)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (pois) => {
              this.poisState.set(pois);
              this.loadingState.set(false);
            },
            error: (error: HttpErrorResponse) => {
              // Keep the last successful result visible while the public
              // upstream is busy or rate-limits us.
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

  setViewport(viewport: OverpassViewport | null): void {
    viewport = viewport ? normalizeViewport(viewport) : null;
    const current = this.viewportState();
    if (current && viewport && JSON.stringify(current) === JSON.stringify(viewport)) return;
    this.viewportState.set(viewport);
  }
}

function normalizeViewport(viewport: OverpassViewport): OverpassViewport {
  // Stable grid-aligned boxes make nearby map movements reuse the same
  // database cache entry instead of hammering the public Overpass instance
  // with a new query for every few moved pixels.
  const grid = viewport.zoom >= 17 ? 0.01 : viewport.zoom >= 15 ? 0.02 : 0.05;
  return {
    ...viewport,
    bounds: viewport.bounds.map((box) => ({
      latMin: roundDown(box.latMin, grid),
      lonMin: roundDown(box.lonMin, grid),
      latMax: roundUp(box.latMax, grid),
      lonMax: roundUp(box.lonMax, grid)
    }))
  };
}

function roundDown(value: number, grid: number): number {
  return Number((Math.floor(value / grid) * grid).toFixed(7));
}

function roundUp(value: number, grid: number): number {
  return Number((Math.ceil(value / grid) * grid).toFixed(7));
}
