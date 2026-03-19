import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { finalize } from 'rxjs';
import { UnsplashPhoto } from '../../../interfaces/unsplash-response.interface';
import { PublicProfileUnsplashService } from '../../../services/content/public-profile-unsplash.service';

@Component({
  selector: 'app-public-profile-unsplash-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule
  ],
  templateUrl: './public-profile-unsplash-dialog.component.html',
  styleUrls: ['./public-profile-unsplash-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicProfileUnsplashDialogComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogRef = inject(MatDialogRef<PublicProfileUnsplashDialogComponent>);
  private readonly unsplashService = inject(PublicProfileUnsplashService);

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly loading = signal(false);
  readonly results = signal<UnsplashPhoto[]>([]);
  readonly page = signal(1);
  readonly hasMoreSearch = signal(false);
  readonly lastSearchTerm = signal('');
  readonly mode = signal<'featured' | 'search'>('featured');
  readonly title = computed(() => this.mode() === 'search' ? 'Unsplash search' : 'Featured Unsplash photos');

  constructor() {
    this.loadFeatured();
  }

  trackById(_index: number, photo: UnsplashPhoto): string {
    return photo.id;
  }

  search(): void {
    const term = this.searchControl.value.trim();
    if (!term) {
      this.loadFeatured();
      return;
    }

    if (term !== this.lastSearchTerm()) {
      this.page.set(1);
      this.hasMoreSearch.set(false);
      this.lastSearchTerm.set(term);
    }

    this.mode.set('search');
    this.loading.set(true);
    this.unsplashService.searchPhotos(term, this.page())
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.results.set(Array.isArray(response.data?.results) ? response.data.results : []);
          const totalPages = Number(response.data?.total_pages || 0);
          this.hasMoreSearch.set(this.page() < totalPages);
          this.page.set(this.hasMoreSearch() ? this.page() + 1 : 1);
        },
        error: () => {
          this.results.set([]);
          this.hasMoreSearch.set(false);
        }
      });
  }

  loadFeatured(): void {
    this.mode.set('featured');
    this.page.set(1);
    this.lastSearchTerm.set('');
    this.hasMoreSearch.set(false);
    this.loading.set(true);
    this.unsplashService.getFeaturedPhotos(1)
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => this.results.set(Array.isArray(response.data) ? response.data : []),
        error: () => this.results.set([])
      });
  }

  loadMore(): void {
    if (!this.hasMoreSearch() || this.mode() !== 'search') {
      return;
    }
    this.search();
  }

  selectPhoto(photo: UnsplashPhoto): void {
    const downloadLocation = photo.links?.download_location;
    if (downloadLocation) {
      this.unsplashService.trackDownload(downloadLocation)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ error: () => undefined });
    }
    this.dialogRef.close(photo);
  }
}
