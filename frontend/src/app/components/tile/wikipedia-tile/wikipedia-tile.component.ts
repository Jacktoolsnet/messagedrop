import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { catchError, firstValueFrom, forkJoin, map, of } from 'rxjs';
import { Place } from '../../../interfaces/place';
import { WikipediaArticle } from '../../../interfaces/wikipedia';
import { AppService } from '../../../services/app.service';
import { MapService } from '../../../services/map.service';
import { WikipediaService } from '../../../services/wikipedia.service';
import { ExternalContentComponent } from '../../legal/external-content/external-content.component';
import { WikipediaListComponent } from '../../wikipedia-list/wikipedia-list.component';
import { DisplayMessage } from '../../utils/display-message/display-message.component';

@Component({
  selector: 'app-wikipedia-tile',
  imports: [MatIcon, MatProgressSpinnerModule, TranslocoPipe],
  templateUrl: './wikipedia-tile.component.html',
  styleUrl: './wikipedia-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WikipediaTileComponent implements OnChanges {
  @Input() place!: Place;

  readonly articles = signal<WikipediaArticle[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);

  private readonly dialog = inject(MatDialog);
  private readonly appService = inject(AppService);
  private readonly mapService = inject(MapService);
  private readonly wikipedia = inject(WikipediaService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['place']) {
      this.articles.set([]);
      this.loaded.set(false);
      if (this.wikipediaContentEnabled()) {
        this.loadArticles();
      }
    }
  }

  wikipediaContentEnabled(): boolean {
    return this.appService.getAppSettings().enableWikipediaContent;
  }

  previewArticles(): WikipediaArticle[] {
    return this.articles().slice(0, 4);
  }

  openTileDialog(event?: Event): void {
    event?.stopPropagation();
    if (!this.wikipediaContentEnabled()) {
      this.openConsentSettings();
      return;
    }
    if (!this.loaded()) {
      this.loadArticles();
      return;
    }
    if (this.articles().length > 0) {
      void this.openArticles();
    }
  }

  private loadArticles(): void {
    if (this.loading() || !this.place?.location || !this.wikipediaContentEnabled()) {
      return;
    }
    const bounds = this.getSearchBounds();
    this.loading.set(true);
    this.wikipedia.getNearby({
      ...bounds,
      zoom: 14,
      language: this.transloco.getActiveLang(),
      limit: 100
    }).pipe(
      map((response) => this.sortByDistance(response.articles).slice(0, 20)),
      // Only the four visible previews need image attribution at this point.
      // The remaining articles are resolved when the tile is opened.
      map((articles) => ({ articles, preview: articles.slice(0, 4) })),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: ({ articles, preview }) => {
        if (!preview.length) {
          this.finishLoading(articles);
          return;
        }
        forkJoin(preview.map((article) => this.resolveAttribution(article))).pipe(
          takeUntilDestroyed(this.destroyRef)
        ).subscribe({
          next: (resolvedPreview) => {
            const resolvedById = new Map(resolvedPreview.map((article) => [article.pageId, article]));
            this.finishLoading(articles.map((article) => resolvedById.get(article.pageId) ?? article));
          },
          error: () => this.finishLoading(articles)
        });
      },
      error: () => this.finishLoading([])
    });
  }

  private finishLoading(articles: WikipediaArticle[]): void {
    this.articles.set(articles);
    this.loading.set(false);
    this.loaded.set(true);
  }

  private openConsentSettings(): void {
    const settingsRef = this.dialog.open(ExternalContentComponent, {
      data: { appSettings: this.appService.getAppSettings(), visiblePlatforms: ['wikipedia'] },
      width: 'min(440px, 90vw)',
      maxWidth: '90vw',
      maxHeight: '90vh',
      autoFocus: false,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false
    });
    settingsRef.afterClosed().subscribe(() => {
      if (this.wikipediaContentEnabled()) {
        this.loadArticles();
      }
    });
  }

  private async openArticles(): Promise<void> {
    const loadingRef = this.dialog.open(DisplayMessage, {
      data: {
        showAlways: true,
        title: this.transloco.translate('common.wikipedia.title'),
        image: '',
        icon: 'menu_book',
        message: this.transloco.translate('common.wikipedia.loadingAttribution'),
        button: '',
        delay: 0,
        showSpinner: true,
        autoclose: false
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      autoFocus: false
    });

    const resolvedArticles = await firstValueFrom(
      forkJoin(this.articles().map((article) => article.resolvedAttribution
        ? of(article)
        : this.resolveAttribution(article)
      )).pipe(takeUntilDestroyed(this.destroyRef))
    ).catch(() => this.articles()).finally(() => loadingRef.close());

    this.articles.set(resolvedArticles);
    const dialogRef = this.dialog.open(WikipediaListComponent, {
      data: { articles: resolvedArticles },
      panelClass: 'pin-dialog',
      width: 'min(720px, 95vw)',
      maxWidth: '95vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      autoFocus: false
    });
    dialogRef.afterClosed().subscribe((result?: { action?: string; article?: WikipediaArticle }) => {
      if (result?.action !== 'jumpToPin' || !result.article) {
        return;
      }
      this.dialog.closeAll();
      this.mapService.flyToWithZoom({
        latitude: result.article.latitude,
        longitude: result.article.longitude,
        plusCode: ''
      }, Math.max(18, this.mapService.getMapZoom()));
    });
  }

  private resolveAttribution(article: WikipediaArticle) {
    return this.wikipedia.getAttribution(article, this.transloco.getActiveLang()).pipe(
      map((resolvedAttribution) => ({
        ...article,
        summary: article.summary || resolvedAttribution.summary || '',
        resolvedAttribution
      })),
      catchError(() => of(article))
    );
  }

  private getSearchBounds(): { north: number; south: number; east: number; west: number } {
    const { latitude, longitude } = this.place.location;
    const box = this.place.boundingBox;
    const validBox = box && [box.latMin, box.latMax, box.lonMin, box.lonMax].every(Number.isFinite)
      && box.latMax > box.latMin && box.lonMax > box.lonMin;
    const maxLatitudeDelta = 7 / 111.32;
    const longitudeScale = Math.max(0.1, Math.cos(latitude * Math.PI / 180));
    const maxLongitudeDelta = 7 / (111.32 * longitudeScale);

    if (validBox) {
      const bounds = {
        north: Math.min(85, box.latMax, latitude + maxLatitudeDelta),
        south: Math.max(-85, box.latMin, latitude - maxLatitudeDelta),
        east: Math.min(box.lonMax, longitude + maxLongitudeDelta),
        west: Math.max(box.lonMin, longitude - maxLongitudeDelta)
      };
      if (bounds.north > bounds.south && bounds.east > bounds.west) {
        return bounds;
      }
    }

    const fallbackLatitudeDelta = 1 / 111.32;
    const fallbackLongitudeDelta = 1 / (111.32 * longitudeScale);
    return {
      north: Math.min(85, latitude + fallbackLatitudeDelta),
      south: Math.max(-85, latitude - fallbackLatitudeDelta),
      east: Math.min(180, longitude + fallbackLongitudeDelta),
      west: Math.max(-180, longitude - fallbackLongitudeDelta)
    };
  }

  private sortByDistance(articles: WikipediaArticle[]): WikipediaArticle[] {
    const origin = this.place.location;
    return [...articles].sort((left, right) =>
      this.distanceSquared(origin.latitude, origin.longitude, left.latitude, left.longitude)
      - this.distanceSquared(origin.latitude, origin.longitude, right.latitude, right.longitude)
    );
  }

  private distanceSquared(latitude: number, longitude: number, targetLatitude: number, targetLongitude: number): number {
    const longitudeScale = Math.cos(latitude * Math.PI / 180);
    const latitudeDistance = targetLatitude - latitude;
    const longitudeDistance = (targetLongitude - longitude) * longitudeScale;
    return latitudeDistance * latitudeDistance + longitudeDistance * longitudeDistance;
  }
}
