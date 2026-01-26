import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { startWith } from 'rxjs';
import {
  ViatorFreetextProductFiltering,
  ViatorFreetextProductSorting,
  ViatorFreetextSearchRequest,
  ViatorFreetextSearchResponse,
  ViatorProductSearchFiltering,
  ViatorProductSearchPagination,
  ViatorProductSearchRequest,
  ViatorProductSearchResponse,
  ViatorProductSearchSorting,
  ViatorRangeDate,
  ViatorRangeNumber
} from '../../../interfaces/viator';
import { ViatorService } from '../../../services/viator.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';

export type ExperienceProvider = 'viator';
export type ExperienceSortOption = 'relevance' | 'rating' | 'price_low' | 'price_high';

const PAGE_SIZE = 20;

interface ExperienceSearchForm {
  provider: FormControl<ExperienceProvider>;
  term: FormControl<string>;
  destination: FormControl<string>;
  startDate: FormControl<string>;
  endDate: FormControl<string>;
  minPrice: FormControl<number | null>;
  maxPrice: FormControl<number | null>;
  minDurationHours: FormControl<number | null>;
  maxDurationHours: FormControl<number | null>;
  tagIds: FormControl<string>;
  currency: FormControl<string>;
  sort: FormControl<ExperienceSortOption>;
}

export interface ExperienceResult {
  provider: ExperienceProvider;
  trackId: string;
  productCode?: string;
  title?: string;
  description?: string;
  rating?: number;
  reviewCount?: number;
  priceFrom?: number;
  currency?: string;
  duration?: string;
  imageUrl?: string;
  productUrl?: string;
  raw: unknown;
}

@Component({
  selector: 'app-experience-search',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIcon,
    MatProgressSpinnerModule,
    TranslocoPipe
  ],
  templateUrl: './experience-search.component.html',
  styleUrl: './experience-search.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExperienceSearchComponent {
  readonly selected = output<ExperienceResult>();

  private readonly destroyRef = inject(DestroyRef);
  private readonly viatorService = inject(ViatorService);
  private readonly i18n = inject(TranslationHelperService);

  readonly providers: ExperienceProvider[] = ['viator'];
  readonly sortOptions: { value: ExperienceSortOption; labelKey: string }[] = [
    { value: 'relevance', labelKey: 'common.experiences.sortRelevance' },
    { value: 'rating', labelKey: 'common.experiences.sortRating' },
    { value: 'price_low', labelKey: 'common.experiences.sortPriceLow' },
    { value: 'price_high', labelKey: 'common.experiences.sortPriceHigh' }
  ];

  readonly form = new FormGroup<ExperienceSearchForm>({
    provider: new FormControl<ExperienceProvider>('viator', { nonNullable: true }),
    term: new FormControl('', { nonNullable: true }),
    destination: new FormControl('', { nonNullable: true }),
    startDate: new FormControl('', { nonNullable: true }),
    endDate: new FormControl('', { nonNullable: true }),
    minPrice: new FormControl<number | null>(null),
    maxPrice: new FormControl<number | null>(null),
    minDurationHours: new FormControl<number | null>(null),
    maxDurationHours: new FormControl<number | null>(null),
    tagIds: new FormControl('', { nonNullable: true }),
    currency: new FormControl('', { nonNullable: true }),
    sort: new FormControl<ExperienceSortOption>('relevance', { nonNullable: true })
  });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { requireSync: true }
  );

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly results = signal<ExperienceResult[]>([]);
  readonly totalCount = signal<number | null>(null);
  readonly lastPageCount = signal(0);
  readonly hasSearched = signal(false);

  readonly canSearch = computed(() => {
    const value = this.formValue();
    const term = value.term?.trim() ?? '';
    const destination = value.destination?.trim() ?? '';
    return term.length > 0 || destination.length > 0;
  });

  readonly showEmptyState = computed(() => !this.loading() && this.hasSearched() && this.results().length === 0);
  readonly canLoadMore = computed(() => {
    if (this.loading()) {
      return false;
    }
    const total = this.totalCount();
    if (total !== null) {
      return this.results().length < total;
    }
    return this.hasSearched() && this.lastPageCount() === PAGE_SIZE;
  });

  onSearch(): void {
    if (!this.canSearch()) {
      return;
    }
    this.executeSearch(false);
  }

  onLoadMore(): void {
    this.executeSearch(true);
  }

  onReset(): void {
    this.form.reset({
      provider: 'viator',
      term: '',
      destination: '',
      startDate: '',
      endDate: '',
      minPrice: null,
      maxPrice: null,
      minDurationHours: null,
      maxDurationHours: null,
      tagIds: '',
      currency: '',
      sort: 'relevance'
    });
    this.results.set([]);
    this.totalCount.set(null);
    this.lastPageCount.set(0);
    this.errorMessage.set(null);
    this.hasSearched.set(false);
  }

  onSelect(result: ExperienceResult): void {
    this.selected.emit(result);
  }

  onOpen(result: ExperienceResult): void {
    if (result.productUrl) {
      window.open(result.productUrl, '_blank');
    }
  }

  getRatingLabel(result: ExperienceResult): string {
    if (!result.rating) return '';
    if (!result.reviewCount) return `${result.rating}`;
    return `${result.rating} (${result.reviewCount})`;
  }

  getPriceLabel(result: ExperienceResult): string {
    if (result.priceFrom === undefined || result.priceFrom === null) return '';
    const currency = result.currency ? ` ${result.currency}` : '';
    return `${result.priceFrom}${currency}`;
  }

  private executeSearch(append: boolean): void {
    const provider = this.form.getRawValue().provider;
    if (provider !== 'viator') {
      this.errorMessage.set(this.i18n.t('common.experiences.providerNotAvailable'));
      return;
    }

    const value = this.form.getRawValue();
    const term = value.term.trim();
    const start = append ? this.results().length + 1 : 1;

    this.loading.set(true);
    this.errorMessage.set(null);

    if (term.length > 0) {
      const request = this.buildFreetextSearchRequest(term, start);
      this.viatorService.searchFreetext(request)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (response) => this.handleFreetextSearchResponse(response, append),
          error: (error) => this.handleSearchError(error)
        });
      return;
    }

    const request = this.buildProductSearchRequest(start);
    this.viatorService.searchProducts(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.handleProductSearchResponse(response, append),
        error: (error) => this.handleSearchError(error)
      });
  }

  private handleProductSearchResponse(response: ViatorProductSearchResponse, append: boolean): void {
    const items = Array.isArray(response.products) ? response.products : [];
    const totalCount = typeof response.totalCount === 'number' ? response.totalCount : null;
    this.applyResults(items, append, totalCount);
  }

  private handleFreetextSearchResponse(response: ViatorFreetextSearchResponse, append: boolean): void {
    const items = Array.isArray(response.products) ? response.products : [];
    this.applyResults(items, append, null);
  }

  private handleSearchError(error: unknown): void {
    console.error('Viator search failed', error);
    this.errorMessage.set(this.i18n.t('common.experiences.searchFailed'));
    this.loading.set(false);
    this.hasSearched.set(true);
  }

  private buildProductSearchRequest(start: number): ViatorProductSearchRequest {
    const value = this.form.getRawValue();
    const tagIds = parseTagIds(value.tagIds);
    const duration = buildDurationRange(value.minDurationHours, value.maxDurationHours);
    const filtering: ViatorProductSearchFiltering = {
      destination: value.destination.trim() || undefined,
      startDate: value.startDate || undefined,
      endDate: value.endDate || undefined,
      lowestPrice: value.minPrice ?? undefined,
      highestPrice: value.maxPrice ?? undefined,
      durationInMinutes: duration ?? undefined,
      tags: tagIds.length > 0 ? tagIds : undefined
    };
    const sorting = mapProductSorting(value.sort);
    const pagination: ViatorProductSearchPagination = {
      start,
      count: PAGE_SIZE
    };

    return {
      filtering,
      sorting: sorting ?? undefined,
      pagination,
      currency: normalizeCurrency(value.currency)
    };
  }

  private buildFreetextSearchRequest(searchTerm: string, start: number): ViatorFreetextSearchRequest {
    const value = this.form.getRawValue();
    const tagIds = parseTagIds(value.tagIds);
    const duration = buildDurationRange(value.minDurationHours, value.maxDurationHours);
    const productFiltering: ViatorFreetextProductFiltering = {};
    const destination = value.destination.trim();
    if (destination) {
      productFiltering.destination = destination;
    }
    const dateRange = buildDateRange(value.startDate, value.endDate);
    if (dateRange) {
      productFiltering.dateRange = dateRange;
    }
    const priceRange = buildPriceRange(value.minPrice, value.maxPrice);
    if (priceRange) {
      productFiltering.price = priceRange;
    }
    if (duration) {
      productFiltering.durationInMinutes = duration;
    }
    if (tagIds.length > 0) {
      productFiltering.tags = tagIds;
    }

    const productSorting = mapFreetextSorting(value.sort);
    const request: ViatorFreetextSearchRequest = {
      searchTerm,
      currency: normalizeCurrency(value.currency),
      searchTypes: [
        {
          searchType: 'PRODUCTS',
          pagination: { start, count: PAGE_SIZE }
        }
      ]
    };
    if (Object.keys(productFiltering).length > 0) {
      request.productFiltering = productFiltering;
    }
    if (productSorting) {
      request.productSorting = productSorting;
    }
    return request;
  }

  private applyResults(items: unknown[], append: boolean, totalCount: number | null): void {
    const mapped = items.map((item, index) => normalizeExperience(item, index));
    const combined = append ? [...this.results(), ...mapped] : mapped;
    this.results.set(combined);
    this.lastPageCount.set(mapped.length);
    this.totalCount.set(totalCount);
    this.hasSearched.set(true);
    this.loading.set(false);
  }
}

function parseTagIds(input: string): number[] {
  if (!input) return [];
  return input
    .split(',')
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter((value) => Number.isFinite(value));
}

function mapProductSorting(value: ExperienceSortOption): ViatorProductSearchSorting | null {
  switch (value) {
    case 'rating':
      return { sort: 'TRAVELER_RATING', order: 'DESCENDING' };
    case 'price_low':
      return { sort: 'PRICE', order: 'ASCENDING' };
    case 'price_high':
      return { sort: 'PRICE', order: 'DESCENDING' };
    default:
      return { sort: 'DEFAULT' };
  }
}

function mapFreetextSorting(value: ExperienceSortOption): ViatorFreetextProductSorting | null {
  switch (value) {
    case 'rating':
      return { sort: 'REVIEW_AVG_RATING', order: 'DESCENDING' };
    case 'price_low':
      return { sort: 'PRICE', order: 'ASCENDING' };
    case 'price_high':
      return { sort: 'PRICE', order: 'DESCENDING' };
    default:
      return { sort: 'DEFAULT' };
  }
}

function buildDurationRange(minHours: number | null, maxHours: number | null): ViatorRangeNumber | null {
  if (minHours === null && maxHours === null) return null;
  const fromMinutes = minHours !== null ? Math.round(minHours * 60) : undefined;
  const toMinutes = maxHours !== null ? Math.round(maxHours * 60) : undefined;
  return { from: fromMinutes, to: toMinutes };
}

function buildPriceRange(minPrice: number | null, maxPrice: number | null): ViatorRangeNumber | null {
  if (minPrice === null && maxPrice === null) return null;
  return { from: minPrice ?? undefined, to: maxPrice ?? undefined };
}

function buildDateRange(startDate: string, endDate: string): ViatorRangeDate | null {
  const from = startDate?.trim();
  const to = endDate?.trim();
  if (!from && !to) return null;
  return {
    from: from || undefined,
    to: to || undefined
  };
}

function normalizeCurrency(input: string): string {
  const trimmed = input.trim().toUpperCase();
  return trimmed.length === 3 ? trimmed : 'USD';
}

function normalizeExperience(item: unknown, index: number): ExperienceResult {
  const record = asRecord(item);
  const productCode = firstString(
    record?.productCode,
    record?.productId,
    record?.id,
    record?.code
  );
  const title = firstString(record?.title, record?.name, record?.productTitle);
  const description = firstString(record?.shortDescription, record?.summary, record?.description);
  const rating = firstNumber(record?.rating, record?.averageRating);
  const reviewCount = firstNumber(record?.reviewCount, record?.totalReviews, record?.ratingCount);
  const priceFrom = firstNumber(record?.fromPrice, record?.price, record?.startingPrice, record?.priceFrom);
  const currency = firstString(record?.currency, record?.currencyCode);
  const duration = firstString(record?.duration, record?.durationText);
  const productUrl = firstString(record?.productUrl, record?.url, record?.bookingUrl);
  const imageUrl = resolveImageUrl(record);

  return {
    provider: 'viator',
    trackId: productCode ? `viator:${productCode}` : `viator:${index}`,
    productCode: productCode || undefined,
    title: title || undefined,
    description: description || undefined,
    rating: rating ?? undefined,
    reviewCount: reviewCount ?? undefined,
    priceFrom: priceFrom ?? undefined,
    currency: currency || undefined,
    duration: duration || undefined,
    imageUrl: imageUrl || undefined,
    productUrl: productUrl || undefined,
    raw: item
  };
}

function resolveImageUrl(record: Record<string, unknown> | null): string | undefined {
  if (!record) return undefined;
  const direct = firstString(record.imageUrl, record.image, record.primaryImageUrl, record.heroImageUrl);
  if (direct) return direct;
  const images = Array.isArray(record.images) ? record.images : [];
  if (images.length === 0) return undefined;
  const imageRecord = asRecord(images[0]);
  if (!imageRecord) return undefined;
  const nestedDirect = firstString(imageRecord.url, imageRecord.imageUrl, imageRecord.original, imageRecord.medium, imageRecord.small);
  if (nestedDirect) return nestedDirect;
  const variants = Array.isArray(imageRecord.variants) ? imageRecord.variants : [];
  const variantRecord = variants.length > 0 ? asRecord(variants[0]) : null;
  return firstString(variantRecord?.url, variantRecord?.imageUrl);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}
