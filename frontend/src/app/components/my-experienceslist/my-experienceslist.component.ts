import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { ExperienceBookmarkService } from '../../services/experience-bookmark.service';
import { GeolocationService } from '../../services/geolocation.service';
import { MapService } from '../../services/map.service';
import { ViatorService } from '../../services/viator.service';
import { ExperienceTileContext } from '../../interfaces/experience-tile-context';
import { ExperienceResult, ViatorDestinationLookup, ViatorProductDetail } from '../../interfaces/viator';
import { MatDialog } from '@angular/material/dialog';
import { ExperienceSearchDetailDialogComponent } from '../utils/experience-search/detail-dialog/experience-search-detail-dialog.component';
import { Location } from '../../interfaces/location';
import { TileListDialogComponent } from '../tile/tile-list-dialog/tile-list-dialog.component';
import { DisplayMessageConfig } from '../../interfaces/display-message-config';
import { DisplayMessage } from '../utils/display-message/display-message.component';
import { UserService } from '../../services/user.service';
import { MyExperienceSortDialogComponent } from './my-experience-sort-dialog/my-experience-sort-dialog.component';

@Component({
  selector: 'app-my-experienceslist',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatButtonModule,
    MatCardModule,
    MatIcon,
    TranslocoPipe
  ],
  templateUrl: './my-experienceslist.component.html',
  styleUrl: './my-experienceslist.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyExperienceslistComponent implements OnInit {
  readonly help = inject(HelpDialogService);
  private readonly bookmarkService = inject(ExperienceBookmarkService);
  private readonly viatorService = inject(ViatorService);
  private readonly mapService = inject(MapService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly transloco = inject(TranslocoService);
  readonly userService = inject(UserService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<MyExperienceslistComponent>);
  private readonly dialogData = inject<{ experiences?: ExperienceResult[] } | null>(MAT_DIALOG_DATA, { optional: true });

  readonly loading = signal(true);
  readonly bookmarks = this.bookmarkService.bookmarksSignal;
  private readonly filterCodes = new Set<string>(
    (this.dialogData?.experiences ?? [])
      .map((experience) => experience.productCode)
      .filter((code): code is string => Boolean(code))
  );
  readonly visibleBookmarks = computed(() => {
    const all = this.bookmarks();
    if (!this.filterCodes.size) {
      return all;
    }
    return all.filter((bookmark) => this.filterCodes.has(bookmark.productCode));
  });
  readonly hasBookmarks = computed(() => this.visibleBookmarks().length > 0);
  private readonly destinationCache = new Map<number, ViatorDestinationLookup>();

  async ngOnInit(): Promise<void> {
    await this.bookmarkService.ensureLoaded();
    await this.refreshSnapshots();
    this.loading.set(false);
  }

  openDetails(result: ExperienceResult): void {
    this.dialog.open(ExperienceSearchDetailDialogComponent, {
      data: { result },
      autoFocus: false,
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      maxWidth: '95vw',
      maxHeight: '95vh'
    });
  }

  async openTileList(result: ExperienceResult): Promise<void> {
    const productCode = result.productCode || '';
    if (!productCode) return;
    const tileSettings = await this.bookmarkService.getTileSettings(productCode);
    const experience: ExperienceTileContext = {
      productCode,
      title: result.title,
      imageUrl: result.imageUrl,
      tileSettings
    };
    this.dialog.open(TileListDialogComponent, {
      data: { experience },
      minWidth: 'min(500px, 95vw)',
      maxWidth: '95vw',
      width: 'min(900px, 95vw)',
      maxHeight: '90vh',
      height: 'auto',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }

  tileListAriaLabel(result: ExperienceResult): string {
    const name = result.title || result.productCode || this.transloco.translate('common.experiences.title');
    return this.transloco.translate('common.tileList.openAria', { name });
  }

  onOpen(result: ExperienceResult): void {
    if (result.productUrl) {
      window.open(result.productUrl, '_blank');
    }
  }

  openSortDialog(): void {
    if (!this.userService.hasJwt()) {
      return;
    }

    const dialogRef = this.dialog.open(MyExperienceSortDialogComponent, {
      data: { bookmarks: this.visibleBookmarks() },
      minWidth: 'min(520px, 95vw)',
      maxWidth: '95vw',
      width: 'min(680px, 95vw)',
      maxHeight: '90vh',
      height: 'auto',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((result?: { orderedProductCodes?: string[] }) => {
      if (result?.orderedProductCodes?.length) {
        void this.bookmarkService.updateBookmarkOrder(result.orderedProductCodes);
      }
    });
  }

  async showOnMap(result: ExperienceResult): Promise<void> {
    const destination = await this.getPrimaryDestination(result);
    const location = this.buildLocationFromDestination(destination);
    if (!location) return;
    this.mapService.flyToWithZoom(location, 19);
    this.dialogRef.close();
  }

  async openInMaps(result: ExperienceResult): Promise<void> {
    const destination = await this.getPrimaryDestination(result);
    const location = this.buildLocationFromDestination(destination);
    if (!location) return;
    const query = `${location.latitude},${location.longitude}`;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
    window.open(url, '_blank');
  }

  hasDestination(result: ExperienceResult): boolean {
    return Array.isArray(result.destinationIds) && result.destinationIds.length > 0;
  }

  getExperienceHeaderBackgroundImage(result: ExperienceResult): string {
    return result.imageUrl ? `url("${result.imageUrl}")` : 'none';
  }

  getExperienceHeaderBackgroundOpacity(result: ExperienceResult): string {
    return result.imageUrl ? '0.9' : '0';
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
    const currency = result.currency || 'USD';
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
            }
          });
          return;
        }

        if (exists) {
          removeBookmark().catch(() => {
            this.showDisplayMessage('common.experiences.saveFailedTitle', 'common.experiences.saveFailedMessage', 'error', false);
          });
        }
      })
      .catch(() => {
        this.showDisplayMessage('common.experiences.saveFailedTitle', 'common.experiences.saveFailedMessage', 'error', false);
      });
  }

  private async refreshSnapshots(): Promise<void> {
    const bookmarks = this.bookmarks();
    for (const bookmark of bookmarks) {
      if (!bookmark.productCode) continue;
      try {
        const detail = await firstValueFrom(this.viatorService.getProduct(bookmark.productCode, false));
        if (!detail) continue;
        const updated = this.mergeSnapshot(bookmark.snapshot, detail);
        await this.bookmarkService.updateSnapshot(bookmark.productCode, updated, Date.now());
      } catch {
        // keep existing snapshot on failure
      }
    }
  }

  private mergeSnapshot(snapshot: ExperienceResult, detail: ViatorProductDetail): ExperienceResult {
    return {
      ...snapshot,
      productCode: detail.productCode || snapshot.productCode,
      title: detail.title || snapshot.title,
      description: detail.description || snapshot.description,
      imageUrl: this.resolveLargestImage(detail) || snapshot.imageUrl
    };
  }

  private resolveLargestImage(detail: ViatorProductDetail): string | undefined {
    const images = Array.isArray(detail.images) ? detail.images : [];
    let best: { area: number; url: string } | null = null;
    for (const image of images) {
      const variants = Array.isArray(image?.variants) ? image.variants : [];
      for (const variant of variants) {
        const url = variant?.url;
        const width = variant?.width ?? 0;
        const height = variant?.height ?? 0;
        if (!url) continue;
        const area = width * height;
        if (!best || area > best.area) {
          best = { area, url };
        }
      }
    }
    return best?.url;
  }

  private async getPrimaryDestination(result: ExperienceResult): Promise<ViatorDestinationLookup | undefined> {
    const destinationId = Array.isArray(result.destinationIds) ? result.destinationIds[0] : undefined;
    if (!destinationId) return undefined;
    const cached = this.destinationCache.get(destinationId);
    if (cached) return cached;
    try {
      const response = await firstValueFrom(this.viatorService.getDestinations([destinationId], false));
      const destination = response.destinations?.find((item) => item.destinationId === destinationId);
      if (destination) {
        this.destinationCache.set(destinationId, destination);
      }
      return destination;
    } catch {
      return undefined;
    }
  }

  private buildLocationFromDestination(destination?: ViatorDestinationLookup): Location | null {
    const center = destination?.center;
    if (!center || center.latitude === undefined || center.longitude === undefined) {
      return null;
    }
    const plusCode = destination?.plusCode || this.geolocationService.getPlusCode(center.latitude, center.longitude);
    return {
      latitude: center.latitude,
      longitude: center.longitude,
      plusCode
    };
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
}
