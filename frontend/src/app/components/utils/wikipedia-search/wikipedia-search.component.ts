import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogActions, MatDialogClose, MatDialogContent } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { catchError, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { WikipediaArticle, WikipediaImageAttribution } from '../../../interfaces/wikipedia';
import { Location } from '../../../interfaces/location';
import { WikipediaService } from '../../../services/wikipedia.service';
import { SearchSettingsMapPreviewComponent } from '../search-settings/search-settings-map-preview.component';
import { WikipediaListComponent } from '../../wikipedia-list/wikipedia-list.component';

@Component({
  selector: 'app-wikipedia-search',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
    SearchSettingsMapPreviewComponent
  ],
  templateUrl: './wikipedia-search.component.html',
  styleUrl: './wikipedia-search.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WikipediaSearchComponent {
  readonly selected = output<WikipediaArticle>();
  readonly term = new FormControl('', { nonNullable: true });
  readonly loading = signal(false);
  readonly hasSearched = signal(false);
  readonly results = signal<WikipediaArticle[]>([]);
  readonly viewMode = signal<'map' | 'list'>('map');
  readonly worldCenter: Location = { latitude: 0, longitude: 0, plusCode: '' };
  private readonly termValue = toSignal(this.term.valueChanges.pipe(startWith(this.term.value)), { requireSync: true });
  readonly canSearch = computed(() => this.termValue().trim().length >= 2 && !this.loading());
  readonly mapMarkers = computed(() => this.results().map((article) => ({
    id: article.pageId,
    latitude: article.latitude,
    longitude: article.longitude,
    label: article.title
  })));

  private readonly wikipedia = inject(WikipediaService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);

  search(): void {
    const term = this.term.value.trim();
    if (term.length < 2 || this.loading()) return;
    this.loading.set(true);
    this.hasSearched.set(false);
    this.results.set([]);
    this.wikipedia.search({ term, language: this.transloco.getActiveLang(), limit: 10 }).pipe(
      switchMap((response) => response.articles.length
        ? forkJoin(response.articles.map((article) => this.resolveAttribution(article, response.language)))
        : of([] as WikipediaArticle[])),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (articles) => {
        this.results.set(articles);
        this.loading.set(false);
        this.hasSearched.set(true);
      },
      error: () => {
        this.results.set([]);
        this.loading.set(false);
        this.hasSearched.set(true);
      }
    });
  }

  toggleViewMode(): void {
    this.viewMode.update((mode) => mode === 'map' ? 'list' : 'map');
  }

  onMarkerClick(marker: { id?: number }): void {
    const article = this.results().find((candidate) => candidate.pageId === marker.id);
    if (article) this.openDetails(article);
  }

  openDetails(article: WikipediaArticle): void {
    const dialogRef = this.dialog.open(WikipediaListComponent, {
      data: { articles: [article] },
      panelClass: 'pin-dialog',
      width: 'min(720px, 95vw)',
      maxWidth: '95vw',
      maxHeight: '90vh',
      backdropClass: 'dialog-backdrop',
      autoFocus: false
    });
    dialogRef.afterClosed().subscribe((result?: { action?: string; article?: WikipediaArticle }) => {
      if (result?.action === 'jumpToPin' && result.article) this.selected.emit(result.article);
    });
  }

  jumpToPin(article: WikipediaArticle, event: Event): void {
    event.stopPropagation();
    this.selected.emit(article);
  }

  openNavigation(article: WikipediaArticle, event: Event): void {
    event.stopPropagation();
    const destination = encodeURIComponent(`${article.latitude},${article.longitude}`);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank', 'noopener,noreferrer');
  }

  openWikipedia(article: WikipediaArticle, event: Event): void {
    event.stopPropagation();
    window.open(article.articleUrl, '_blank', 'noopener,noreferrer');
  }

  getImageLicenseUrl(attribution: WikipediaImageAttribution): string | undefined {
    return attribution.licenseUrl || attribution.sourceUrl;
  }

  getImageCreator(attribution: WikipediaImageAttribution): string {
    const value = attribution.creator || attribution.credit || '';
    return /^https?:\/\//iu.test(value) ? '' : value;
  }

  private resolveAttribution(article: WikipediaArticle, language: string) {
    return this.wikipedia.getAttribution(article, language).pipe(
      map((resolvedAttribution) => ({
        ...article,
        summary: article.summary || resolvedAttribution.summary || '',
        resolvedAttribution
      })),
      catchError(() => of({
        ...article,
        resolvedAttribution: {
          status: 200 as const,
          article: {
            provider: 'Wikipedia',
            sourceUrl: article.articleUrl,
            license: 'CC BY-SA 4.0',
            licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
            creator: 'Wikipedia contributors',
            source: 'terms-fallback' as const
          },
          image: article.imageTitle ? { resolved: false, source: 'unresolved' as const } : null,
          cache: 'miss' as const
        }
      }))
    );
  }
}
