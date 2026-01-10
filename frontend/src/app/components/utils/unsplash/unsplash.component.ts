import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
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
    EnableExternalContentComponent,
    TranslocoPipe
  ],
  templateUrl: './unsplash.component.html',
  styleUrl: './unsplash.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UnsplashComponent implements OnInit {
  @ViewChild('searchInput') private searchInput?: ElementRef<HTMLInputElement>;

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly topicOptions = [
    { value: '', labelKey: 'common.unsplash.topicAll', query: '' },
    { value: 'wallpapers', labelKey: 'common.unsplash.topics.wallpapers', query: 'wallpapers' },
    { value: 'nature', labelKey: 'common.unsplash.topics.nature', query: 'nature' },
    { value: 'architecture-interior', labelKey: 'common.unsplash.topics.architecture', query: 'architecture' },
    { value: 'travel', labelKey: 'common.unsplash.topics.travel', query: 'travel' },
    { value: 'textures-patterns', labelKey: 'common.unsplash.topics.textures', query: 'textures patterns' },
    { value: 'street-photography', labelKey: 'common.unsplash.topics.street', query: 'street photography' },
    { value: 'food-drink', labelKey: 'common.unsplash.topics.food', query: 'food and drink' },
    { value: 'animals', labelKey: 'common.unsplash.topics.animals', query: 'animals' },
    { value: 'people', labelKey: 'common.unsplash.topics.people', query: 'people' },
    { value: 'sports', labelKey: 'common.unsplash.topics.sports', query: 'sports' },
    { value: 'technology', labelKey: 'common.unsplash.topics.technology', query: 'technology' },
    { value: 'health', labelKey: 'common.unsplash.topics.health', query: 'health' }
  ];
  selectedTopic = '';
  lastSearchTerm = '';
  lastTopic = '';
  featuredPage = 1;
  topicPage = 1;
  searchPage = 1;
  hasMoreSearch = false;
  results: UnsplashPhoto[] = [];
  showUnsplash = false;

  private readonly appService = inject(AppService);
  private readonly dialogRef = inject(MatDialogRef<UnsplashComponent>);
  private readonly dialogData = inject<{ returnType?: 'multimedia' | 'photo' } | null>(MAT_DIALOG_DATA, { optional: true });
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
    return term !== this.lastSearchTerm || this.selectedTopic !== this.lastTopic || !this.hasMoreSearch;
  }

  loadFeaturedPhotos(): void {
    const page = this.featuredPage;
    this.unsplashService.getFeaturedPhotos(page).subscribe({
      next: (unsplashResponse: UnsplashApiResponse<UnsplashPhoto[]>) => this.updateFeaturedResults(unsplashResponse, page),
      error: (error) => this.handleUnsplashError(error)
    });
  }

  loadTopicPhotos(topic: string): void {
    const page = this.topicPage;
    this.unsplashService.getTopicPhotos(topic, page).subscribe({
      next: (unsplashResponse: UnsplashApiResponse<UnsplashPhoto[]>) => {
        const results = Array.isArray(unsplashResponse.data) ? unsplashResponse.data : [];
        if (results.length === 0) {
          const fallbackQuery = this.getTopicQuery(topic);
          if (fallbackQuery) {
            this.lastSearchTerm = fallbackQuery;
            this.lastTopic = topic;
            this.searchPage = 1;
            this.hasMoreSearch = false;
            this.loadSearchPhotos(fallbackQuery);
            return;
          }
        }
        this.updateTopicResults(unsplashResponse, page);
      },
      error: (error) => {
        const fallbackQuery = this.getTopicQuery(topic);
        if (fallbackQuery) {
          this.lastSearchTerm = fallbackQuery;
          this.lastTopic = topic;
          this.searchPage = 1;
          this.hasMoreSearch = false;
          this.loadSearchPhotos(fallbackQuery);
          return;
        }
        this.handleUnsplashError(error);
      }
    });
  }

  loadSearchPhotos(term: string): void {
    const page = this.searchPage;
    this.unsplashService.searchPhotos(term, page, true, this.selectedTopic || undefined).subscribe({
      next: (unsplashResponse: UnsplashApiResponse<UnsplashSearchResults>) => this.updateSearchResults(unsplashResponse, page),
      error: (error) => this.handleUnsplashError(error)
    });
  }

  onTopicChange(): void {
    this.topicPage = 1;
    this.search();
  }

  search(): void {
    this.searchInput?.nativeElement.blur();
    const currentTerm = this.searchControl.value.trim();
    if (!currentTerm) {
      this.lastSearchTerm = '';
      this.lastTopic = '';
      if (this.selectedTopic) {
        this.lastTopic = this.selectedTopic;
        this.loadTopicPhotos(this.selectedTopic);
      } else {
        this.loadFeaturedPhotos();
      }
      return;
    }

    if (currentTerm !== this.lastSearchTerm || this.selectedTopic !== this.lastTopic) {
      this.lastSearchTerm = currentTerm;
      this.lastTopic = this.selectedTopic;
      this.topicPage = 1;
      this.searchPage = 1;
      this.hasMoreSearch = false;
    }

    const effectiveTerm = this.buildSearchTerm(currentTerm);
    this.loadSearchPhotos(effectiveTerm);
  }

  onApplyClick(result: UnsplashPhoto): void {
    if (this.dialogData?.returnType === 'photo') {
      this.dialogRef.close(result);
      return;
    }
    const downloadLocation = result.links?.download_location;
    if (downloadLocation) {
      this.unsplashService.trackDownload(downloadLocation).subscribe({
        error: () => undefined
      });
    }
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
    this.topicPage = 1;
    this.searchPage = 1;
    this.hasMoreSearch = false;
    this.cdRef.markForCheck();
  }

  private updateTopicResults(response: UnsplashApiResponse<UnsplashPhoto[]>, page: number): void {
    this.results = response.data;
    this.topicPage = page + 1;
    this.featuredPage = 1;
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

  private getTopicQuery(topic: string): string | null {
    const option = this.topicOptions.find((item) => item.value === topic);
    const query = option?.query?.trim() ?? '';
    return query ? query : null;
  }

  private buildSearchTerm(term: string): string {
    const topicQuery = this.getTopicQuery(this.selectedTopic);
    if (!topicQuery) {
      return term;
    }
    return `${term} ${topicQuery}`.trim();
  }

  private handleUnsplashError(error: unknown): void {
    console.error('Unsplash request failed', error);
    this.results = [];
    this.cdRef.markForCheck();
  }
}
