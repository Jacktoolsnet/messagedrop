import { ChangeDetectionStrategy, Component, DestroyRef, Inject, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Location } from '../../../../interfaces/location';
import {
  ExperienceDetailLocationItem,
  ExperienceDetailMapMarker,
  ExperienceSearchDetailDialogData,
  ViatorLocation,
  ViatorLocationsResponse,
  ViatorLogisticsPoint,
  ViatorPickupLocation,
  ViatorProductDetail
} from '../../../../interfaces/viator';
import { ViatorService } from '../../../../services/viator.service';
import { SearchSettingsMapPreviewComponent } from '../../search-settings/search-settings-map-preview.component';
import { HelpDialogService } from '../../help-dialog/help-dialog.service';
import { ExperienceResult } from '../../../../interfaces/viator';
import { DialogHeaderComponent } from '../../dialog-header/dialog-header.component';

const DEFAULT_CENTER: Location = { latitude: 0, longitude: 0, plusCode: '' };

@Component({
  selector: 'app-experience-search-detail-dialog',
  standalone: true,
  imports: [
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButtonModule,
    MatCardModule,
    MatIcon,
    TranslocoPipe,
    SearchSettingsMapPreviewComponent,
    DialogHeaderComponent
  ],
  templateUrl: './experience-search-detail-dialog.component.html',
  styleUrl: './experience-search-detail-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExperienceSearchDetailDialogComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly viatorService = inject(ViatorService);
  private readonly transloco = inject(TranslocoService);

  readonly loading = signal(false);
  readonly detail = signal<ViatorProductDetail | null>(null);
  readonly locationIndex = signal<Map<string, ViatorLocation>>(new Map());
  readonly mapMarkers = signal<ExperienceDetailMapMarker[]>([]);
  readonly mapCenter = signal<Location>(DEFAULT_CENTER);

  readonly startItems = computed(() => this.buildPointItems(this.detail()?.logistics?.start));
  readonly endItems = computed(() => this.buildPointItems(this.detail()?.logistics?.end));
  readonly redemptionItems = computed(() => this.buildRedemptionItems());
  readonly pickupItems = computed(() => this.buildPickupItems());
  readonly sameStartEnd = computed(() => {
    const start = this.firstCenteredLocation(this.detail()?.logistics?.start);
    const end = this.firstCenteredLocation(this.detail()?.logistics?.end);
    return Boolean(start && end && this.isSameLocation(start, end));
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) readonly data: ExperienceSearchDetailDialogData,
    readonly help: HelpDialogService
  ) {
    this.loadDetails();
  }

  getExperienceHeaderBackgroundImage(): string {
    return this.data.result.imageUrl ? `url("${this.data.result.imageUrl}")` : 'none';
  }

  getExperienceHeaderBackgroundOpacity(): string {
    return this.data.result.imageUrl ? '0.9' : '0';
  }

  getDurationLabel(): string {
    return this.data.result.duration || '';
  }

  getRatingLabel(): string {
    if (!this.data.result.rating) return '';
    const rounded = Math.round(this.data.result.rating * 10) / 10;
    if (!this.data.result.reviewCount) return `${rounded.toFixed(1)}`;
    return `${rounded.toFixed(1)} (${this.data.result.reviewCount})`;
  }

  getPriceLabel(): string {
    if (this.data.result.priceFrom === undefined || this.data.result.priceFrom === null) return '';
    const currency = this.data.result.currency || 'USD';
    const locale = this.transloco.getActiveLang() || 'en';
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(this.data.result.priceFrom);
    } catch {
      return `${this.data.result.priceFrom} ${currency}`;
    }
  }

  onOpen(): void {
    if (this.data.result.productUrl) {
      window.open(this.data.result.productUrl, '_blank');
    }
  }

  private loadDetails(): void {
    if (!this.data.result.productCode) {
      return;
    }
    this.loading.set(true);
    this.viatorService.getProduct(this.data.result.productCode, false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.detail.set(detail || null);
          const refs = this.collectLocationRefs(detail);
          if (refs.length) {
            this.loadLocations(refs);
          } else {
            this.loading.set(false);
          }
        },
        error: () => {
          this.loading.set(false);
        }
      });
  }

  private loadLocations(references: string[]): void {
    this.viatorService.getLocationsBulk(references, false)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: ViatorLocationsResponse) => {
          const index = new Map<string, ViatorLocation>();
          (response?.locations || []).forEach((location) => {
            if (location?.reference) {
              index.set(location.reference, location);
            }
          });
          this.locationIndex.set(index);
          this.updateMapMarkers();
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        }
      });
  }

  private collectLocationRefs(detail?: ViatorProductDetail | null): string[] {
    if (!detail) return [];
    const refs = new Set<string>();
    const addRef = (ref?: string) => {
      if (ref) refs.add(ref);
    };
    detail.logistics?.start?.forEach((point) => addRef(point?.location?.ref));
    detail.logistics?.end?.forEach((point) => addRef(point?.location?.ref));
    detail.logistics?.redemption?.locations?.forEach((loc) => addRef(loc?.ref));
    detail.logistics?.travelerPickup?.locations?.forEach((pickup) => addRef(pickup?.location?.ref));
    return Array.from(refs);
  }

  private buildPointItems(points?: ViatorLogisticsPoint[]): ExperienceDetailLocationItem[] {
    if (!points?.length) return [];
    return points
      .map((point) => this.buildLocationItem(point.location?.ref, point.description))
      .filter((item): item is ExperienceDetailLocationItem => Boolean(item));
  }

  getCombinedPointItems(): ExperienceDetailLocationItem[] {
    const start = this.startItems();
    if (start.length) {
      return start;
    }
    return this.endItems();
  }

  private buildRedemptionItems(): ExperienceDetailLocationItem[] {
    const redemption = this.detail()?.logistics?.redemption;
    if (!redemption?.locations?.length && !redemption?.specialInstructions) {
      return [];
    }
    const items = (redemption?.locations || [])
      .map((loc) => this.buildLocationItem(loc?.ref, redemption?.specialInstructions))
      .filter((item): item is ExperienceDetailLocationItem => Boolean(item));
    if (items.length === 0 && redemption?.specialInstructions) {
      items.push({
        ref: 'redemption-info',
        name: this.transloco.translate('common.experiences.redemptionPoint'),
        description: redemption.specialInstructions
      });
    }
    return items;
  }

  private buildPickupItems(): ExperienceDetailLocationItem[] {
    const pickup = this.detail()?.logistics?.travelerPickup;
    if (!pickup?.locations?.length && !pickup?.additionalInfo) {
      return [];
    }
    const items = (pickup?.locations || [])
      .map((loc) => this.buildPickupLocationItem(loc, pickup?.additionalInfo))
      .filter((item): item is ExperienceDetailLocationItem => Boolean(item));
    if (items.length === 0 && pickup?.additionalInfo) {
      items.push({
        ref: 'pickup-info',
        name: this.transloco.translate('common.experiences.pickupPoint'),
        description: pickup.additionalInfo
      });
    }
    return items;
  }

  private buildPickupLocationItem(pickup: ViatorPickupLocation, description?: string): ExperienceDetailLocationItem | null {
    const item = this.buildLocationItem(pickup?.location?.ref, description);
    if (item && pickup?.pickupType) {
      item.description = item.description ? `${pickup.pickupType} · ${item.description}` : pickup.pickupType;
    }
    return item;
  }

  private buildLocationItem(ref?: string, description?: string): ExperienceDetailLocationItem | null {
    if (!ref) return null;
    const location = this.locationIndex().get(ref);
    return {
      ref,
      name: location?.name,
      address: this.formatLocationAddress(location),
      description,
      latitude: location?.center?.latitude,
      longitude: location?.center?.longitude
    };
  }

  private formatLocationAddress(location?: ViatorLocation): string | undefined {
    if (!location) return undefined;
    if (location.unstructuredAddress) return location.unstructuredAddress;
    const parts = [
      location.address?.street,
      location.address?.administrativeArea,
      location.address?.state,
      location.address?.postalCode,
      location.address?.country
    ].filter(Boolean);
    return parts.length ? parts.join(', ') : undefined;
  }

  private updateMapMarkers(): void {
    const markers: ExperienceDetailMapMarker[] = [];
    const start = this.firstCenteredLocation(this.detail()?.logistics?.start);
    const end = this.firstCenteredLocation(this.detail()?.logistics?.end);
    const sameLocation = Boolean(start && end && this.isSameLocation(start, end));
    if (start) {
      markers.push({
        latitude: start.center!.latitude!,
        longitude: start.center!.longitude!,
        label: this.transloco.translate(sameLocation ? 'common.experiences.startEndPoint' : 'common.experiences.startPoint'),
        iconUrl: 'assets/markers/experience-start-marker.svg'
      });
    }
    if (end && !sameLocation) {
      markers.push({
        latitude: end.center!.latitude!,
        longitude: end.center!.longitude!,
        label: this.transloco.translate('common.experiences.endPoint'),
        iconUrl: 'assets/markers/experience-stop-marker.svg'
      });
    }

    this.mapMarkers.set(markers);
    if (markers.length) {
      this.mapCenter.set({
        latitude: markers[0].latitude,
        longitude: markers[0].longitude,
        plusCode: ''
      });
    } else {
      this.mapCenter.set(DEFAULT_CENTER);
    }
  }

  private firstCenteredLocation(points?: ViatorLogisticsPoint[]): ViatorLocation | null {
    if (!points?.length) return null;
    for (const point of points) {
      const ref = point?.location?.ref;
      if (!ref) continue;
      const location = this.locationIndex().get(ref);
      if (location?.center?.latitude !== undefined && location?.center?.longitude !== undefined) {
        return location;
      }
    }
    return null;
  }

  getMapsUrl(item: ExperienceDetailLocationItem): string | null {
    const query = this.formatMapsQuery(item);
    if (!query) {
      return null;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  openMaps(item: ExperienceDetailLocationItem): void {
    const query = this.formatMapsQuery(item);
    if (!query) {
      return;
    }
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
  }

  private formatMapsQuery(item: ExperienceDetailLocationItem): string | null {
    const lat = item.latitude;
    const lng = item.longitude;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return `${lat},${lng}`;
    }
    return item.address || null;
  }

  getFirstMappableItem(items: ExperienceDetailLocationItem[]): ExperienceDetailLocationItem | null {
    for (const item of items) {
      if (this.getMapsUrl(item)) {
        return item;
      }
    }
    return null;
  }

  private isSameLocation(a: ViatorLocation, b: ViatorLocation): boolean {
    if (a.reference && b.reference && a.reference === b.reference) {
      return true;
    }
    const aLat = a.center?.latitude;
    const aLng = a.center?.longitude;
    const bLat = b.center?.latitude;
    const bLng = b.center?.longitude;
    if (aLat === undefined || aLng === undefined || bLat === undefined || bLng === undefined) {
      return false;
    }
    return Math.abs(aLat - bLat) < 1e-6 && Math.abs(aLng - bLng) < 1e-6;
  }
}
