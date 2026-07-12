import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { WikipediaArticle, WikipediaAttribution, WikipediaViewport } from '../interfaces/wikipedia';
import { WikipediaService } from './wikipedia.service';

const MIN_ZOOM = 14;
const REQUEST_DEBOUNCE_MS = 400;

@Injectable({ providedIn: 'root' })
export class WikipediaMapStateService {
  private readonly wikipedia = inject(WikipediaService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly enabledState = signal(false);
  private readonly viewportState = signal<WikipediaViewport | null>(null);
  private readonly languageState = signal('de');
  private readonly refreshState = signal(0);
  private readonly articlesState = signal<WikipediaArticle[]>([]);
  private readonly attributionState = signal<WikipediaAttribution | null>(null);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<HttpErrorResponse | null>(null);
  private readonly staleState = signal(false);

  readonly enabled = this.enabledState.asReadonly();
  readonly viewport = this.viewportState.asReadonly();
  readonly language = this.languageState.asReadonly();
  readonly articles = this.articlesState.asReadonly();
  readonly attribution = this.attributionState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly stale = this.staleState.asReadonly();

  constructor() {
    effect((onCleanup) => {
      const enabled = this.enabledState();
      const viewport = this.viewportState();
      const language = this.languageState();
      this.refreshState();

      if (!enabled || !viewport || viewport.zoom < MIN_ZOOM) {
        this.loadingState.set(false);
        this.errorState.set(null);
        this.articlesState.set([]);
        return;
      }

      this.loadingState.set(true);
      this.errorState.set(null);
      let subscription: Subscription | undefined;
      const timer = setTimeout(() => {
        subscription = this.wikipedia.getNearby({ ...viewport, language })
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: (response) => {
              this.articlesState.set(response.articles);
              this.attributionState.set(response.attribution);
              this.staleState.set(response.cache.stale);
              this.loadingState.set(false);
            },
            error: (error: HttpErrorResponse) => {
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

  setViewport(viewport: WikipediaViewport): void {
    this.viewportState.set(viewport);
  }

  setLanguage(language: string): void {
    this.languageState.set(this.wikipedia.normalizeLanguage(language));
  }

  refresh(): void {
    this.refreshState.update((value) => value + 1);
  }

  clear(): void {
    this.articlesState.set([]);
    this.attributionState.set(null);
    this.errorState.set(null);
    this.staleState.set(false);
  }
}
