import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { OverpassPoi, OverpassViewport } from '../interfaces/overpass';
import { OverpassService } from './overpass.service';

const REQUEST_DEBOUNCE_MS = 200;

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
              this.poisState.set([]);
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
    const current = this.viewportState();
    if (current && viewport && JSON.stringify(current) === JSON.stringify(viewport)) return;
    this.viewportState.set(viewport);
  }
}
