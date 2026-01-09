import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AppSettings } from '../../../interfaces/app-settings';
import { Multimedia } from '../../../interfaces/multimedia';
import { MultimediaType } from '../../../interfaces/multimedia-type';
import { UnsplashApiResponse, UnsplashPhoto, UnsplashSearchResults } from '../../../interfaces/unsplash-response';
import { AppService } from '../../../services/app.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { UnsplashService } from '../../../services/unsplash.service';
import { EnableExternalContentComponent } from '../enable-external-content/enable-external-content.component';

@Component({
  selector: 'app-unsplash',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogContent,
    MatIcon,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    EnableExternalContentComponent
  ],
  templateUrl: './unsplash.component.html',
  styleUrl: './unsplash.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UnsplashComponent implements OnInit {
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

  readonly searchControl = new FormControl('', { nonNullable: true });
  lastSearchTerm = '';
  featuredPage = 1;
  searchPage = 1;
  hasMoreSearch = false;
  results: UnsplashPhoto[] = [];
  showUnsplash = false;

  private readonly appService = inject(AppService);
  private readonly dialogRef = inject(MatDialogRef<UnsplashComponent>);
  private readonly unsplashService = inject(UnsplashService);
  private readonly translation = inject(TranslationHelperService);
  private readonly cdRef = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.showUnsplash = this.appService.getAppSettings().enableUnsplashContent;
    if (this.showUnsplash) {
      this.loadFeaturedPhotos();
    } else {
      this.results = [];
    }
  }

  get showSearchIcon(): boolean {
    const term = this.searchControl.value.trim();
    if (!term) {
      return true;
    }
    return term !== this.lastSearchTerm || !this.hasMoreSearch;
  }

  loadFeaturedPhotos(): void {
    const page = this.featuredPage;
    this.unsplashService.getFeaturedPhotos(page).subscribe({
      next: (unsplashResponse: UnsplashApiResponse<UnsplashPhoto[]>) => this.updateFeaturedResults(unsplashResponse, page),
      error: (error) => this.handleUnsplashError(error)
    });
  }

  loadSearchPhotos(term: string): void {
    const page = this.searchPage;
    this.unsplashService.searchPhotos(term, page).subscribe({
      next: (unsplashResponse: UnsplashApiResponse<UnsplashSearchResults>) => this.updateSearchResults(unsplashResponse, page),
      error: (error) => this.handleUnsplashError(error)
    });
  }

  search(): void {
    this.searchInput?.nativeElement.blur();
    const currentTerm = this.searchControl.value.trim();
    if (!currentTerm) {
      this.lastSearchTerm = '';
      this.loadFeaturedPhotos();
      return;
    }

    if (currentTerm !== this.lastSearchTerm) {
      this.lastSearchTerm = currentTerm;
      this.searchPage = 1;
      this.hasMoreSearch = false;
    }

    this.loadSearchPhotos(currentTerm);
  }

  onApplyClick(result: UnsplashPhoto): void {
    const description = result.description || result.alt_description || '';
    const multimedia: Multimedia = {
      type: MultimediaType.UNSPLASH,
      url: result.urls.regular,
      sourceUrl: result.links?.html ?? '',
      attribution: this.translation.t('common.multimedia.attributionPoweredBy', { platform: 'Unsplash' }),
      title: description,
      description,
      contentId: ''
    };
    this.dialogRef.close(multimedia);
  }

  onEnabledChange(enabled: boolean): void {
    const current = this.appService.getAppSettings();
    const updated: AppSettings = { ...current, enableUnsplashContent: enabled };
    this.appService.setAppSettings(updated);
    this.showUnsplash = enabled;
    if (this.showUnsplash) {
      this.loadFeaturedPhotos();
    } else {
      this.results = [];
      this.cdRef.markForCheck();
    }
  }

  private updateFeaturedResults(response: UnsplashApiResponse<UnsplashPhoto[]>, page: number): void {
    this.results = response.data;
    this.featuredPage = page + 1;
    this.searchPage = 1;
    this.hasMoreSearch = false;
    this.cdRef.markForCheck();
  }

  private updateSearchResults(response: UnsplashApiResponse<UnsplashSearchResults>, page: number): void {
    this.results = response.data.results;
    const totalPages = response.data.total_pages || 0;
    this.hasMoreSearch = page < totalPages;
    this.searchPage = this.hasMoreSearch ? page + 1 : 1;
    this.featuredPage = 1;
    this.cdRef.markForCheck();
  }

  private handleUnsplashError(error: unknown): void {
    console.error('Unsplash request failed', error);
    this.results = [];
    this.cdRef.markForCheck();
  }
}
