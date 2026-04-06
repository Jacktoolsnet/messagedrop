import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { Multimedia } from '../../../interfaces/multimedia.interface';
import { StickerCategory } from '../../../interfaces/sticker-category.interface';
import { StickerPack } from '../../../interfaces/sticker-pack.interface';
import { Sticker } from '../../../interfaces/sticker.interface';
import { StickerAdminService } from '../../../services/content/sticker-admin.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';

@Component({
  selector: 'app-sticker-picker',
  imports: [
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule
  ],
  templateUrl: './sticker-picker.component.html',
  styleUrl: './sticker-picker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StickerPickerComponent implements OnInit, OnDestroy {
  readonly stickerProtectionOverlayUrl = 'images/sticker-protection-overlay.svg';
  readonly dialogRef = inject(MatDialogRef<StickerPickerComponent, Multimedia | null>);
  readonly i18n = inject(TranslationHelperService);

  private readonly stickerService = inject(StickerAdminService);
  private readonly previewRequests = new Map<string, AbortController>();

  readonly categories = signal<StickerCategory[]>([]);
  readonly packs = signal<StickerPack[]>([]);
  readonly stickers = signal<Sticker[]>([]);

  readonly loadingCategories = signal(false);
  readonly loadingPacks = signal(false);
  readonly loadingStickers = signal(false);
  readonly previewUrls = signal<Record<string, string>>({});
  readonly previewStatus = signal<Record<string, 'loading' | 'loaded' | 'error'>>({});

  readonly selectedCategoryId = signal<string | null>(null);
  readonly selectedPack = signal<StickerPack | null>(null);

  readonly selectedCategoryIndex = computed(() => {
    const categoryId = this.selectedCategoryId();
    const index = this.categories().findIndex((category) => category.id === categoryId);
    return index >= 0 ? index : 0;
  });

  async ngOnInit(): Promise<void> {
    await this.loadCategoriesAsync();
  }

  ngOnDestroy(): void {
    for (const controller of this.previewRequests.values()) {
      controller.abort();
    }
    this.previewRequests.clear();
    this.revokeAllPreviewUrls();
  }

  async onCategorySelectionChange(index: number): Promise<void> {
    const category = this.categories()[index];
    if (!category || category.id === this.selectedCategoryId()) {
      return;
    }

    this.selectedCategoryId.set(category.id);
    this.selectedPack.set(null);
    this.stickers.set([]);
    this.primePreviewUrls(this.categories().map((entry) => entry.previewStickerId));
    await this.loadPacksAsync(category.id);
  }

  async openPack(pack: StickerPack): Promise<void> {
    this.selectedPack.set(pack);
    this.stickers.set([]);
    this.loadingStickers.set(true);

    try {
      const stickers = await firstValueFrom(this.stickerService.getStickers(pack.id));
      this.stickers.set(stickers);
      this.primePreviewUrls(stickers.map((sticker) => sticker.id));
    } catch {
      this.stickers.set([]);
    } finally {
      this.loadingStickers.set(false);
    }
  }

  goBackToPacks(): void {
    this.selectedPack.set(null);
    this.stickers.set([]);
    this.primePreviewUrls(this.packs().map((pack) => pack.previewStickerId));
  }

  async openLicenseInNewTab(): Promise<void> {
    const pack = this.selectedPack();
    if (!pack?.licenseFilePath) {
      return;
    }

    const licenseTab = window.open('', '_blank');
    if (!licenseTab) {
      return;
    }

    const objectUrl = await this.stickerService.fetchPackLicenseUrl(pack.id);
    if (!objectUrl) {
      licenseTab.close();
      return;
    }

    licenseTab.location.replace(objectUrl);
    licenseTab.focus();
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 60000);
  }

  pickSticker(sticker: Sticker): void {
    this.dialogRef.close(this.stickerService.createStickerMultimedia(sticker));
  }

  close(): void {
    this.dialogRef.close(null);
  }

  getStickerPreviewUrl(stickerId: string | null | undefined): string {
    if (!stickerId) {
      return '';
    }
    return this.previewUrls()[this.getPreviewKey(stickerId)] ?? '';
  }

  isPreviewLoading(stickerId: string | null | undefined): boolean {
    if (!stickerId) {
      return false;
    }
    return this.previewStatus()[this.getPreviewKey(stickerId)] === 'loading';
  }

  isPreviewLoaded(stickerId: string | null | undefined): boolean {
    if (!stickerId) {
      return false;
    }
    return this.previewStatus()[this.getPreviewKey(stickerId)] === 'loaded';
  }

  isPreviewError(stickerId: string | null | undefined): boolean {
    if (!stickerId) {
      return false;
    }
    return this.previewStatus()[this.getPreviewKey(stickerId)] === 'error';
  }

  markPreviewLoaded(stickerId: string | null | undefined): void {
    const previewKey = this.getPreviewKey(stickerId);
    if (!previewKey) {
      return;
    }
    this.previewStatus.update((current) => current[previewKey] === 'loaded'
      ? current
      : { ...current, [previewKey]: 'loaded' });
  }

  markPreviewError(stickerId: string | null | undefined): void {
    const previewKey = this.getPreviewKey(stickerId);
    if (!previewKey) {
      return;
    }
    this.revokePreviewUrl(previewKey);
    this.previewStatus.update((current) => current[previewKey] === 'error'
      ? current
      : { ...current, [previewKey]: 'error' });
  }

  private async loadCategoriesAsync(): Promise<void> {
    this.loadingCategories.set(true);
    this.selectedPack.set(null);
    this.stickers.set([]);

    try {
      const categories = await firstValueFrom(this.stickerService.getCategories());
      this.categories.set(categories);
      this.primePreviewUrls(categories.map((category) => category.previewStickerId));

      const firstCategoryId = categories[0]?.id ?? null;
      this.selectedCategoryId.set(firstCategoryId);

      if (firstCategoryId) {
        await this.loadPacksAsync(firstCategoryId);
      } else {
        this.packs.set([]);
      }
    } catch {
      this.categories.set([]);
      this.selectedCategoryId.set(null);
      this.packs.set([]);
    } finally {
      this.loadingCategories.set(false);
    }
  }

  private async loadPacksAsync(categoryId: string): Promise<void> {
    this.loadingPacks.set(true);

    try {
      const packs = await firstValueFrom(this.stickerService.getPacks(categoryId));
      this.packs.set(packs);
      this.primePreviewUrls(packs.map((pack) => pack.previewStickerId));
    } catch {
      this.packs.set([]);
    } finally {
      this.loadingPacks.set(false);
    }
  }

  private primePreviewUrls(stickerIds: Array<string | null | undefined>): void {
    for (const stickerId of stickerIds) {
      if (!stickerId) {
        continue;
      }
      void this.ensurePreviewUrl(stickerId);
    }
  }

  private async ensurePreviewUrl(stickerId: string): Promise<void> {
    const previewKey = this.getPreviewKey(stickerId);
    const hasActiveUrl = !!this.previewUrls()[previewKey];
    if (!previewKey || this.previewRequests.has(previewKey) || hasActiveUrl) {
      return;
    }

    const controller = new AbortController();
    this.previewRequests.set(previewKey, controller);
    this.previewStatus.update((current) => ({
      ...current,
      [previewKey]: 'loading'
    }));

    try {
      const objectUrl = await this.stickerService.fetchRenderObjectUrl(stickerId, controller.signal);
      if (controller.signal.aborted || !objectUrl) {
        if (!controller.signal.aborted) {
          this.previewStatus.update((current) => ({
            ...current,
            [previewKey]: 'error'
          }));
        }
        return;
      }

      this.previewUrls.update((current) => ({
        ...current,
        [previewKey]: objectUrl
      }));
    } catch {
      if (!controller.signal.aborted) {
        this.previewStatus.update((current) => ({
          ...current,
          [previewKey]: 'error'
        }));
      }
    } finally {
      this.previewRequests.delete(previewKey);
    }
  }

  private getPreviewKey(stickerId: string | null | undefined): string {
    if (!stickerId) {
      return '';
    }
    return `preview:${stickerId}`;
  }

  private revokePreviewUrl(previewKey: string): void {
    const currentUrl = this.previewUrls()[previewKey];
    if (currentUrl) {
      window.URL.revokeObjectURL(currentUrl);
    }

    this.previewUrls.update((current) => {
      if (!current[previewKey]) {
        return current;
      }
      const next = { ...current };
      delete next[previewKey];
      return next;
    });
  }

  private revokeAllPreviewUrls(): void {
    const previewUrls = this.previewUrls();
    for (const url of Object.values(previewUrls)) {
      window.URL.revokeObjectURL(url);
    }
    this.previewUrls.set({});
    this.previewStatus.set({});
  }
}
