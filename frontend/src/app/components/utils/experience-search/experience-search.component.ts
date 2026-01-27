import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, output, signal } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogClose, MatDialogContent } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { startWith } from 'rxjs';
import { Location } from '../../../interfaces/location';
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
  ViatorRangeNumber,
  ViatorDestinationLookup
} from '../../../interfaces/viator';
import { ViatorService } from '../../../services/viator.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { SearchSettingsMapPreviewComponent } from '../search-settings/search-settings-map-preview.component';
import { HelpDialogService } from '../help-dialog/help-dialog.service';

export type ExperienceProvider = 'viator';
export type ExperienceSortOption = 'relevance' | 'rating' | 'price_low' | 'price_high';

const PAGE_SIZE = 20;
const PRICE_RANGE_MIN = 0;
const PRICE_RANGE_MAX = 5000;
const DURATION_RANGE_MIN = 0;
const DURATION_RANGE_MAX = 72;
const SUPPORTED_CURRENCIES = [
  'AUD',
  'BRL',
  'CAD',
  'CHF',
  'DKK',
  'EUR',
  'GBP',
  'HKD',
  'INR',
  'JPY',
  'NOK',
  'NZD',
  'SEK',
  'SGD',
  'TWD',
  'USD',
  'ZAR'
] as const;
const SUPPORTED_CURRENCY_SET = new Set<string>(SUPPORTED_CURRENCIES);
const DEFAULT_CURRENCY = resolveCurrencyFromLocale();

interface ExperienceSearchForm {
  term: FormControl<string>;
  startDate: FormControl<Date | null>;
  endDate: FormControl<Date | null>;
  minPrice: FormControl<number>;
  maxPrice: FormControl<number>;
  minDurationHours: FormControl<number>;
  maxDurationHours: FormControl<number>;
  currency: FormControl<string>;
  sort: FormControl<ExperienceSortOption>;
}

export interface ExperienceResult {
  provider: ExperienceProvider;
  trackId: string;
  productCode?: string;
  destinationIds?: number[];
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

interface ExperienceMapMarker {
  destinationId: number;
  latitude: number;
  longitude: number;
  label?: string;
}

@Component({
  selector: 'app-experience-search',
  providers: [provideNativeDateAdapter()],
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
    MatDatepickerModule,
    MatMenuModule,
    MatSelectModule,
    MatRadioModule,
    MatSliderModule,
    MatIcon,
    MatProgressSpinnerModule,
    TranslocoPipe,
    SearchSettingsMapPreviewComponent
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
  readonly help = inject(HelpDialogService);

  readonly sortOptions: { value: ExperienceSortOption; labelKey: string }[] = [
    { value: 'relevance', labelKey: 'common.experiences.sortRelevance' },
    { value: 'rating', labelKey: 'common.experiences.sortRating' },
    { value: 'price_low', labelKey: 'common.experiences.sortPriceLow' },
    { value: 'price_high', labelKey: 'common.experiences.sortPriceHigh' }
  ];
  readonly currencyOptions = SUPPORTED_CURRENCIES;

  readonly form = new FormGroup<ExperienceSearchForm>({
    term: new FormControl('', { nonNullable: true }),
    startDate: new FormControl<Date | null>(null),
    endDate: new FormControl<Date | null>(null),
    minPrice: new FormControl<number>(PRICE_RANGE_MIN, { nonNullable: true }),
    maxPrice: new FormControl<number>(PRICE_RANGE_MAX, { nonNullable: true }),
    minDurationHours: new FormControl<number>(DURATION_RANGE_MIN, { nonNullable: true }),
    maxDurationHours: new FormControl<number>(DURATION_RANGE_MAX, { nonNullable: true }),
    currency: new FormControl(DEFAULT_CURRENCY, { nonNullable: true }),
    sort: new FormControl<ExperienceSortOption>('relevance', { nonNullable: true })
  });

  private readonly formValue = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { requireSync: true }
  );

  constructor() {
    this.form.controls.startDate.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((startDate) => {
        const endDate = this.form.controls.endDate.value;
        if (startDate && endDate && endDate < startDate) {
          this.form.controls.endDate.setValue(null);
        }
        if (!startDate && endDate) {
          this.form.controls.endDate.setValue(null);
        }
      });
  }

  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly results = signal<ExperienceResult[]>([]);
  readonly totalCount = signal<number | null>(null);
  readonly lastPageCount = signal(0);
  readonly hasSearched = signal(false);
  readonly viewMode = signal<'map' | 'list'>('map');
  readonly selectedResult = signal<ExperienceResult | null>(null);
  readonly worldCenter: Location = { latitude: 0, longitude: 0, plusCode: '' };
  readonly mapMarkers = signal<ExperienceMapMarker[]>([]);
  readonly priceRange = { min: PRICE_RANGE_MIN, max: PRICE_RANGE_MAX, step: 10 };
  readonly durationRange = { min: DURATION_RANGE_MIN, max: DURATION_RANGE_MAX, step: 1 };
  private readonly destinationCache = new Map<number, ViatorDestinationLookup>();
  private lastDestinationIds: number[] = [];

  readonly canSearch = computed(() => {
    const value = this.formValue();
    const term = value.term?.trim() ?? '';
    return term.length > 0;
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
      term: '',
      startDate: null,
      endDate: null,
      minPrice: PRICE_RANGE_MIN,
      maxPrice: PRICE_RANGE_MAX,
      minDurationHours: DURATION_RANGE_MIN,
      maxDurationHours: DURATION_RANGE_MAX,
      currency: DEFAULT_CURRENCY,
      sort: 'relevance'
    });
    this.results.set([]);
    this.totalCount.set(null);
    this.lastPageCount.set(0);
    this.errorMessage.set(null);
    this.hasSearched.set(false);
    this.selectedResult.set(null);
  }

  onSelect(result: ExperienceResult): void {
    this.selectedResult.set(result);
  }

  onApply(): void {
    const selected = this.selectedResult();
    if (selected) {
      this.selected.emit(selected);
    }
  }

  toggleViewMode(): void {
    this.viewMode.update((mode) => (mode === 'map' ? 'list' : 'map'));
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
    const { items, totalCount } = extractProductsFromResponse(response.products, response.totalCount ?? null);
    this.applyResults(items, append, totalCount);
  }

  private handleFreetextSearchResponse(response: ViatorFreetextSearchResponse, append: boolean): void {
    const { items, totalCount } = extractProductsFromResponse(response.products, null);
    this.applyResults(items, append, totalCount);
  }

  private handleSearchError(error: unknown): void {
    console.error('Viator search failed', error);
    this.errorMessage.set(this.i18n.t('common.experiences.searchFailed'));
    this.loading.set(false);
    this.hasSearched.set(true);
  }

  private buildProductSearchRequest(start: number): ViatorProductSearchRequest {
    const value = this.form.getRawValue();
    const duration = buildDurationRange(value.minDurationHours, value.maxDurationHours);
    const filtering: ViatorProductSearchFiltering = {
      startDate: formatDateInput(value.startDate),
      endDate: formatDateInput(value.endDate),
      durationInMinutes: duration ?? undefined
    };
    const priceRange = buildPriceRange(value.minPrice, value.maxPrice);
    if (priceRange) {
      filtering.lowestPrice = priceRange.from;
      filtering.highestPrice = priceRange.to;
    }
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
    const duration = buildDurationRange(value.minDurationHours, value.maxDurationHours);
    const productFiltering: ViatorFreetextProductFiltering = {};
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
    if (!append) {
      this.selectedResult.set(null);
    }
    this.lastPageCount.set(mapped.length);
    this.totalCount.set(totalCount);
    this.hasSearched.set(true);
    this.loading.set(false);
    this.refreshDestinationMarkers(combined);
  }

  private refreshDestinationMarkers(results: ExperienceResult[]): void {
    const destinationIds = new Set<number>();
    results.forEach((result) => {
      (result.destinationIds ?? []).forEach((id) => destinationIds.add(id));
    });
    const uniqueIds = Array.from(destinationIds).slice(0, 200);
    this.lastDestinationIds = uniqueIds;
    this.mapMarkers.set(this.buildMarkers(uniqueIds));
    const missing = uniqueIds.filter((id) => !this.destinationCache.has(id));
    if (missing.length === 0) {
      return;
    }
    this.viatorService.getDestinations(missing, false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const list = Array.isArray(response.destinations) ? response.destinations : [];
          list.forEach((destination) => {
            if (destination && typeof destination.destinationId === 'number') {
              this.destinationCache.set(destination.destinationId, destination);
            }
          });
          this.mapMarkers.set(this.buildMarkers(this.lastDestinationIds));
        },
        error: () => {
          // No UI error here; markers are optional.
        }
      });
  }

  private buildMarkers(ids: number[]): ExperienceMapMarker[] {
    const markers: ExperienceMapMarker[] = [];
    ids.forEach((id) => {
      const destination = this.destinationCache.get(id);
      const lat = destination?.center?.latitude;
      const lng = destination?.center?.longitude;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }
      markers.push({
        destinationId: id,
        label: destination?.name,
        latitude: lat as number,
        longitude: lng as number
      });
    });
    return markers;
  }
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
  const minValue = minHours ?? DURATION_RANGE_MIN;
  const maxValue = maxHours ?? DURATION_RANGE_MAX;
  if (minValue <= DURATION_RANGE_MIN && maxValue >= DURATION_RANGE_MAX) {
    return null;
  }
  const fromMinutes = minHours !== null ? Math.round(minHours * 60) : undefined;
  const toMinutes = maxHours !== null ? Math.round(maxHours * 60) : undefined;
  return { from: fromMinutes, to: toMinutes };
}

function buildPriceRange(minPrice: number | null, maxPrice: number | null): ViatorRangeNumber | null {
  if (minPrice === null && maxPrice === null) return null;
  const minValue = minPrice ?? PRICE_RANGE_MIN;
  const maxValue = maxPrice ?? PRICE_RANGE_MAX;
  if (minValue <= PRICE_RANGE_MIN && maxValue >= PRICE_RANGE_MAX) {
    return null;
  }
  return { from: minPrice ?? undefined, to: maxPrice ?? undefined };
}

function buildDateRange(startDate: Date | string | null, endDate: Date | string | null): ViatorRangeDate | null {
  const from = formatDateInput(startDate);
  const to = formatDateInput(endDate);
  if (!from && !to) return null;
  return { from: from || undefined, to: to || undefined };
}

function formatDateInput(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, '0');
  const day = `${value.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeCurrency(input: string): string {
  const trimmed = input.trim().toUpperCase();
  if (trimmed.length !== 3) {
    return DEFAULT_CURRENCY;
  }
  return SUPPORTED_CURRENCY_SET.has(trimmed) ? trimmed : DEFAULT_CURRENCY;
}

function resolveCurrencyFromLocale(): string {
  if (typeof navigator === 'undefined') {
    return 'USD';
  }

  const candidate = (navigator.languages?.[0] || navigator.language || '').trim();
  if (!candidate) {
    return 'USD';
  }

  const parts = candidate.replace('_', '-').split('-');
  const lang = parts[0]?.toLowerCase();
  const region = parts[1]?.toUpperCase();

  const regionMap: Record<string, string> = {
    US: 'USD',
    GB: 'GBP',
    DE: 'EUR',
    FR: 'EUR',
    ES: 'EUR',
    IT: 'EUR',
    NL: 'EUR',
    AT: 'EUR',
    BE: 'EUR',
    PT: 'EUR',
    IE: 'EUR',
    CH: 'CHF',
    SE: 'SEK',
    NO: 'NOK',
    DK: 'DKK',
    AU: 'AUD',
    NZ: 'NZD',
    CA: 'CAD',
    BR: 'BRL',
    JP: 'JPY',
    IN: 'INR',
    SG: 'SGD',
    HK: 'HKD',
    TW: 'TWD',
    ZA: 'ZAR'
  };

  if (region && regionMap[region]) {
    const mapped = regionMap[region];
    return SUPPORTED_CURRENCY_SET.has(mapped) ? mapped : 'USD';
  }

  if (lang === 'de' || lang === 'fr' || lang === 'es' || lang === 'it' || lang === 'nl' || lang === 'pt') {
    return SUPPORTED_CURRENCY_SET.has('EUR') ? 'EUR' : 'USD';
  }

  return 'USD';
}

function normalizeExperience(item: unknown, index: number): ExperienceResult {
  const record = asRecord(item);
  const productCode = firstString(
    record?.['productCode'],
    record?.['productId'],
    record?.['id'],
    record?.['code']
  );
  const destinationIds = extractDestinationIds(record);
  const title = firstString(record?.['title'], record?.['name'], record?.['productTitle']);
  const description = firstString(record?.['shortDescription'], record?.['summary'], record?.['description']);
  const { rating, reviewCount } = resolveReviews(record);
  const { priceFrom, currency } = resolvePricing(record);
  const duration = resolveDuration(record);
  const productUrl = firstString(record?.['productUrl'], record?.['url'], record?.['bookingUrl']);
  const imageUrl = resolveImageUrl(record);

  return {
    provider: 'viator',
    trackId: productCode ? `viator:${productCode}` : `viator:${index}`,
    productCode: productCode || undefined,
    destinationIds: destinationIds.length ? destinationIds : undefined,
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

function extractDestinationIds(record: Record<string, unknown> | null): number[] {
  const ids: number[] = [];
  const destinations = Array.isArray(record?.['destinations']) ? (record?.['destinations'] as unknown[]) : [];
  destinations.forEach((entry) => {
    const dest = asRecord(entry);
    const id = firstNumber(dest?.['ref'], dest?.['destinationId'], dest?.['id']);
    if (id === undefined) return;
    const intVal = Math.trunc(id);
    if (intVal > 0 && !ids.includes(intVal)) {
      ids.push(intVal);
    }
  });
  const fallbackId = firstNumber(record?.['destinationId']);
  if (fallbackId !== undefined) {
    const intVal = Math.trunc(fallbackId);
    if (intVal > 0 && !ids.includes(intVal)) {
      ids.push(intVal);
    }
  }
  return ids;
}

function extractProductsFromResponse(
  products: unknown[] | { results?: unknown[]; totalCount?: number } | undefined,
  fallbackTotalCount: number | null
): { items: unknown[]; totalCount: number | null } {
  if (Array.isArray(products)) {
    return { items: products, totalCount: fallbackTotalCount };
  }
  const record = asRecord(products);
  const items = Array.isArray(record?.['results']) ? (record?.['results'] as unknown[]) : [];
  const totalCount = typeof record?.['totalCount'] === 'number' ? record['totalCount'] : fallbackTotalCount;
  return { items, totalCount };
}

function resolvePricing(record: Record<string, unknown> | null): { priceFrom?: number; currency?: string } {
  const pricing = asRecord(record?.['pricing']);
  const summary = asRecord(pricing?.['summary']);
  const priceFrom = firstNumber(
    summary?.['fromPrice'],
    summary?.['fromPriceBeforeDiscount'],
    record?.['fromPrice'],
    record?.['price'],
    record?.['startingPrice'],
    record?.['priceFrom']
  );
  const currency = firstString(pricing?.['currency'], summary?.['currency'], record?.['currency'], record?.['currencyCode']);
  return { priceFrom: priceFrom ?? undefined, currency: currency || undefined };
}

function resolveReviews(record: Record<string, unknown> | null): { rating?: number; reviewCount?: number } {
  const reviews = asRecord(record?.['reviews']);
  let rating = firstNumber(reviews?.['combinedAverageRating'], reviews?.['averageRating'], record?.['rating']);
  let reviewCount = firstNumber(reviews?.['totalReviews'], reviews?.['reviewCount'], record?.['reviewCount']);
  if ((rating === undefined || reviewCount === undefined) && Array.isArray(reviews?.['sources'])) {
    const sources = reviews?.['sources'] as unknown[];
    const mapped = sources.map((source) => asRecord(source)).filter(Boolean) as Record<string, unknown>[];
    if (rating === undefined) {
      rating = firstNumber(...mapped.map((source) => source['averageRating']));
    }
    if (reviewCount === undefined) {
      reviewCount = firstNumber(...mapped.map((source) => source['totalCount']));
    }
  }
  return { rating: rating ?? undefined, reviewCount: reviewCount ?? undefined };
}

function resolveDuration(record: Record<string, unknown> | null): string | undefined {
  const duration = asRecord(record?.['duration']);
  if (!duration) {
    return firstString(record?.['duration'], record?.['durationText']);
  }
  const fixed = firstNumber(duration['fixedDurationInMinutes']);
  if (fixed !== undefined) {
    return formatDurationMinutes(fixed);
  }
  const from = firstNumber(duration['variableDurationFromMinutes'], duration['fromMinutes']);
  const to = firstNumber(duration['variableDurationToMinutes'], duration['toMinutes']);
  if (from !== undefined && to !== undefined && from !== to) {
    return `${formatDurationMinutes(from)}–${formatDurationMinutes(to)}`;
  }
  if (from !== undefined) {
    return formatDurationMinutes(from);
  }
  if (to !== undefined) {
    return formatDurationMinutes(to);
  }
  return firstString(record?.['duration'], record?.['durationText']);
}

function formatDurationMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded >= 60) {
    const hours = Math.floor(rounded / 60);
    const mins = rounded % 60;
    if (mins === 0) {
      return `${hours} h`;
    }
    return `${hours} h ${mins} min`;
  }
  return `${rounded} min`;
}

function resolveImageUrl(record: Record<string, unknown> | null): string | undefined {
  if (!record) return undefined;
  const direct = firstString(
    record['imageUrl'],
    record['image'],
    record['primaryImageUrl'],
    record['heroImageUrl']
  );
  if (direct) return direct;
  const images = Array.isArray(record['images']) ? (record['images'] as unknown[]) : [];
  if (images.length === 0) return undefined;
  const cover = images.map((entry) => asRecord(entry)).find((entry) => entry?.['isCover'] === true);
  const imageRecord = cover ?? asRecord(images[0]);
  if (!imageRecord) return undefined;
  const nestedDirect = firstString(
    imageRecord['url'],
    imageRecord['imageUrl'],
    imageRecord['original'],
    imageRecord['medium'],
    imageRecord['small']
  );
  if (nestedDirect) return nestedDirect;
  const variants = Array.isArray(imageRecord['variants']) ? (imageRecord['variants'] as unknown[]) : [];
  const bestVariant = pickLargestVariant(variants);
  return firstString(bestVariant?.['url'], bestVariant?.['imageUrl']);
}

function pickLargestVariant(variants: unknown[]): Record<string, unknown> | null {
  let best: Record<string, unknown> | null = null;
  let bestArea = -1;
  for (const variant of variants) {
    const record = asRecord(variant);
    if (!record) continue;
    const width = typeof record['width'] === 'number' ? record['width'] : Number(record['width']);
    const height = typeof record['height'] === 'number' ? record['height'] : Number(record['height']);
    const area = Number.isFinite(width) && Number.isFinite(height) ? width * height : 0;
    if (area > bestArea) {
      bestArea = area;
      best = record;
    }
  }
  return best;
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
