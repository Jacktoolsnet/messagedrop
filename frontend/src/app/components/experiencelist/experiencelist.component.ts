import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { DisplayMessageConfig } from '../../interfaces/display-message-config';
import {
  ExperienceListDialogData,
  ExperienceResult,
  ViatorProductSearchRequest,
} from '../../interfaces/viator';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { ExperienceBookmarkService } from '../../services/experience-bookmark.service';
import { UserService } from '../../services/user.service';
import { ViatorService } from '../../services/viator.service';
import { DisplayMessage } from '../utils/display-message/display-message.component';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { ExperienceSearchDetailDialogComponent } from '../utils/experience-search/detail-dialog/experience-search-detail-dialog.component';

const PAGE_SIZE = 20;
const MAX_RESULTS = 80;
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

@Component({
  selector: 'app-experiencelist',
  standalone: true,
  imports: [
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButtonModule,
    MatCardModule,
    MatIcon,
    MatProgressSpinnerModule,
    TranslocoPipe,
    DialogHeaderComponent
  ],
  templateUrl: './experiencelist.component.html',
  styleUrl: './experiencelist.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExperiencelistComponent implements OnInit {
  readonly help = inject(HelpDialogService);
  private readonly viatorService = inject(ViatorService);
  private readonly i18n = inject(TranslationHelperService);
  private readonly transloco = inject(TranslocoService);
  private readonly dialog = inject(MatDialog);
  private readonly bookmarkService = inject(ExperienceBookmarkService);
  private readonly userService = inject(UserService);
  readonly data = inject<ExperienceListDialogData>(MAT_DIALOG_DATA);
  private loadingDialogRef?: MatDialogRef<DisplayMessage>;

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly results = signal<ExperienceResult[]>([]);

  ngOnInit(): void {
    effect(() => {
      if (this.userService.hasJwt()) {
        this.bookmarkService.ensureLoaded().catch(() => undefined);
      }
    });
    void this.loadResults();
  }

  async loadResults(): Promise<void> {
    const destinationIds = Array.isArray(this.data.destinationIds)
      ? Array.from(new Set(this.data.destinationIds
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0)))
      : [];
    if (!destinationIds.length) {
      this.results.set([]);
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.openLoadingMessage();
    this.errorMessage.set(null);
    const combined: ExperienceResult[] = [];

    try {
      for (const destinationId of destinationIds) {
        if (combined.length >= MAX_RESULTS) {
          break;
        }
        const request: ViatorProductSearchRequest = {
          filtering: { destination: String(destinationId) },
          pagination: { start: 1, count: PAGE_SIZE },
          currency: DEFAULT_CURRENCY
        };
        const response = await firstValueFrom(this.viatorService.searchProducts(request));
        const { items } = extractProductsFromResponse(response.products, response.totalCount ?? null);
        const mapped = items.map((item, index) => normalizeExperience(item, combined.length + index));
        combined.push(...mapped);
      }
      this.results.set(combined.slice(0, MAX_RESULTS));
    } catch (error) {
      console.error('Viator experience list failed', error);
      this.errorMessage.set(this.i18n.t('common.experiences.searchFailed'));
    } finally {
      this.closeLoadingMessage();
      this.loading.set(false);
    }
  }

  openDetails(result: ExperienceResult): void {
    this.dialog.open(ExperienceSearchDetailDialogComponent, {
      data: { result },
      autoFocus: false,
      backdropClass: 'dialog-backdrop',
      maxWidth: '95vw',
      maxHeight: '95vh'
    });
  }

  onOpen(result: ExperienceResult): void {
    if (result.productUrl) {
      window.open(result.productUrl, '_blank');
    }
  }

  getExperienceHeaderBackgroundImage(result: ExperienceResult): string {
    return result.imageUrl ? `url("${result.imageUrl}")` : 'none';
  }

  getExperienceHeaderBackgroundOpacity(result: ExperienceResult): string {
    return result.imageUrl ? '0.9' : '0';
  }

  getExperienceIcon(): string {
    return 'local_activity';
  }

  getDurationLabel(result: ExperienceResult): string {
    return result.duration || '';
  }

  getRatingLabel(result: ExperienceResult): string {
    if (!result.rating) return '';
    const rounded = Math.round(result.rating * 10) / 10;
    if (!result.reviewCount) return `${rounded.toFixed(1)}`;
    return `${rounded.toFixed(1)} (${result.reviewCount})`;
  }

  getPriceLabel(result: ExperienceResult): string {
    if (result.priceFrom === undefined || result.priceFrom === null) return '';
    const currency = normalizeCurrency(result.currency || DEFAULT_CURRENCY);
    const locale = this.transloco.getActiveLang() || 'en';
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(result.priceFrom);
    } catch {
      return `${result.priceFrom} ${currency}`;
    }
  }

  isBookmarked(result: ExperienceResult): boolean {
    if (!this.userService.hasJwt()) return false;
    const productCode = result.productCode;
    if (!productCode) return false;
    return this.bookmarkService.bookmarksSignal().some((bookmark) => bookmark.productCode === productCode);
  }

  onToggleBookmark(result: ExperienceResult, event?: Event): void {
    event?.stopPropagation();
    const productCode = result.productCode;
    if (!productCode) {
      return;
    }

    const saveBookmark = async () => {
      await this.bookmarkService.saveBookmark(productCode, {
        ...result,
        productCode,
        trackId: result.trackId || `viator:${productCode}`,
        provider: 'viator'
      }, Date.now());
      this.showDisplayMessage('common.experiences.saveTitle', 'common.experiences.saveMessage', 'bookmark_add', true);
    };

    const removeBookmark = () =>
      this.bookmarkService.removeBookmark(productCode).then(() => {
        this.showDisplayMessage('common.experiences.saveRemovedTitle', 'common.experiences.saveRemovedMessage', 'bookmark_remove', true);
      });

    this.bookmarkService.hasBookmark(productCode)
      .then((exists) => {
        if (!this.userService.hasJwt()) {
          this.userService.loginWithBackend(() => {
            if (exists) {
              this.showConfirmMessage(
                'common.experiences.saveExistsTitle',
                'common.experiences.saveExistsPrompt',
                () => removeBookmark().catch(() => {
                  this.showDisplayMessage('common.experiences.saveFailedTitle', 'common.experiences.saveFailedMessage', 'error', false);
                })
              );
              return;
            }
            saveBookmark().catch(() => {
              this.showDisplayMessage('common.experiences.saveFailedTitle', 'common.experiences.saveFailedMessage', 'error', false);
            });
          });
          return;
        }

        if (exists) {
          removeBookmark().catch(() => {
            this.showDisplayMessage('common.experiences.saveFailedTitle', 'common.experiences.saveFailedMessage', 'error', false);
          });
          return;
        }

        saveBookmark().catch(() => {
          this.showDisplayMessage('common.experiences.saveFailedTitle', 'common.experiences.saveFailedMessage', 'error', false);
        });
      })
      .catch(() => {
        this.showDisplayMessage('common.experiences.saveFailedTitle', 'common.experiences.saveFailedMessage', 'error', false);
      });
  }

  private showDisplayMessage(titleKey: string, messageKey: string, icon: string, autoclose = true): void {
    const config: DisplayMessageConfig = {
      showAlways: true,
      title: this.transloco.translate(titleKey),
      image: '',
      icon,
      message: this.transloco.translate(messageKey),
      button: this.transloco.translate('common.actions.ok'),
      delay: autoclose ? 1000 : 0,
      showSpinner: false,
      autoclose
    };
    this.dialog.open(DisplayMessage, {
      closeOnNavigation: false,
      data: config,
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }

  private showConfirmMessage(titleKey: string, messageKey: string, onConfirm: () => void): void {
    const config: DisplayMessageConfig = {
      showAlways: true,
      title: this.transloco.translate(titleKey),
      image: '',
      icon: 'bookmark_added',
      message: this.transloco.translate(messageKey),
      button: this.transloco.translate('common.actions.yes'),
      secondaryButton: this.transloco.translate('common.actions.no'),
      delay: 0,
      showSpinner: false,
      autoclose: false
    };
    const dialogRef = this.dialog.open(DisplayMessage, {
      closeOnNavigation: false,
      data: config,
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
    dialogRef.afterClosed().subscribe((result) => {
      if (result === true) {
        onConfirm();
      }
    });
  }

  private openLoadingMessage(): void {
    if (this.loadingDialogRef) {
      return;
    }
    const config: DisplayMessageConfig = {
      showAlways: true,
      title: this.transloco.translate('common.experiences.title'),
      image: '',
      icon: 'travel_explore',
      message: this.transloco.translate('common.viator.loading'),
      button: '',
      delay: 600000,
      showSpinner: true,
      autoclose: false
    };
    this.loadingDialogRef = this.dialog.open(DisplayMessage, {
      closeOnNavigation: false,
      data: config,
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: false,
      autoFocus: false
    });
  }

  private closeLoadingMessage(): void {
    if (this.loadingDialogRef) {
      this.loadingDialogRef.close();
      this.loadingDialogRef = undefined;
    }
  }
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

function normalizeCurrency(input: string): string {
  const trimmed = input.trim().toUpperCase();
  if (trimmed.length !== 3) {
    return DEFAULT_CURRENCY;
  }
  return SUPPORTED_CURRENCY_SET.has(trimmed) ? trimmed : DEFAULT_CURRENCY;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }
  }
  return undefined;
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
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
  const avatarUrl = resolveAvatarUrl(record);
  const imageUrl = resolveImageUrl(record);

  return {
    provider: 'viator',
    trackId: productCode ? `viator:${productCode}` : `viator:${index}`,
    productCode: productCode || undefined,
    destinationIds: destinationIds.length ? destinationIds : undefined,
    avatarUrl: avatarUrl || undefined,
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
  return undefined;
}

function formatDurationMinutes(minutes: number): string {
  if (!Number.isFinite(minutes)) return '';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
}

function resolveImageUrl(record: Record<string, unknown> | null): string | undefined {
  if (!record) return undefined;
  const images = Array.isArray(record['images']) ? (record['images'] as unknown[]) : [];
  if (images.length > 0) {
    const cover = images.map((entry) => asRecord(entry)).find((entry) => entry?.['isCover'] === true);
    const imageRecord = cover ?? asRecord(images[0]);
    if (imageRecord) {
      const variants = Array.isArray(imageRecord['variants']) ? (imageRecord['variants'] as unknown[]) : [];
      const bestVariant = pickLargestVariant(variants);
      const bestUrl = firstString(bestVariant?.['url'], bestVariant?.['imageUrl']);
      if (bestUrl) return bestUrl;
      const direct = firstString(
        imageRecord['url'],
        imageRecord['imageUrl'],
        imageRecord['original'],
        imageRecord['medium'],
        imageRecord['small']
      );
      if (direct) return direct;
    }
  }
  return firstString(
    record['imageUrl'],
    record['image'],
    record['primaryImageUrl'],
    record['heroImageUrl']
  );
}

function resolveAvatarUrl(record: Record<string, unknown> | null): string | undefined {
  const images = Array.isArray(record?.['images']) ? (record?.['images'] as unknown[]) : [];
  for (const entry of images) {
    const image = asRecord(entry);
    const variants = Array.isArray(image?.['variants']) ? (image?.['variants'] as unknown[]) : [];
    for (const variant of variants) {
      const variantRecord = asRecord(variant);
      const width = firstNumber(variantRecord?.['width']);
      const height = firstNumber(variantRecord?.['height']);
      if (width === 75 && height === 75) {
        const url = firstString(variantRecord?.['url']);
        if (url) return url;
      }
    }
  }
  return undefined;
}

function pickLargestVariant(variants: unknown[]): Record<string, unknown> | null {
  let best: Record<string, unknown> | null = null;
  let bestArea = -1;
  for (const variant of variants) {
    const record = asRecord(variant);
    if (!record) continue;
    const width = firstNumber(record['width']) ?? 0;
    const height = firstNumber(record['height']) ?? 0;
    const area = width * height;
    if (area > bestArea) {
      bestArea = area;
      best = record;
    }
  }
  return best;
}
