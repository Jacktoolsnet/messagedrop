import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { TranslocoPipe } from '@jsverse/transloco';
import { Multimedia } from '../../../interfaces/multimedia';
import { StickerCategory } from '../../../interfaces/sticker-category.interface';
import { StickerPack } from '../../../interfaces/sticker-pack.interface';
import { Sticker } from '../../../interfaces/sticker.interface';
import { StickerService } from '../../../services/sticker.service';
import { HelpDialogService } from '../help-dialog/help-dialog.service';

@Component({
  selector: 'app-sticker-picker',
  imports: [
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslocoPipe
  ],
  templateUrl: './sticker-picker.component.html',
  styleUrl: './sticker-picker.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StickerPickerComponent implements OnInit {
  readonly dialogRef = inject(MatDialogRef<StickerPickerComponent, Multimedia | null>);
  private readonly stickerService = inject(StickerService);
  readonly help = inject(HelpDialogService);

  readonly categories = signal<StickerCategory[]>([]);
  readonly packs = signal<StickerPack[]>([]);
  readonly stickers = signal<Sticker[]>([]);

  readonly loadingCategories = signal(false);
  readonly loadingPacks = signal(false);
  readonly loadingStickers = signal(false);
  readonly previewStatus = signal<Record<string, 'loaded' | 'error'>>({});

  readonly selectedCategoryId = signal<string | null>(null);
  readonly selectedPack = signal<StickerPack | null>(null);

  readonly selectedCategoryIndex = computed(() => {
    const categoryId = this.selectedCategoryId();
    const index = this.categories().findIndex((category) => category.id === categoryId);
    return index >= 0 ? index : 0;
  });

  readonly activeCategory = computed(() =>
    this.categories().find((category) => category.id === this.selectedCategoryId()) ?? null
  );

  async ngOnInit(): Promise<void> {
    await this.loadCategoriesAsync();
  }

  async onCategorySelectionChange(index: number): Promise<void> {
    const category = this.categories()[index];
    if (!category || category.id === this.selectedCategoryId()) {
      return;
    }

    this.selectedCategoryId.set(category.id);
    this.selectedPack.set(null);
    this.stickers.set([]);
    await this.loadPacksAsync(category.id);
  }

  async openPack(pack: StickerPack): Promise<void> {
    this.selectedPack.set(pack);
    this.stickers.set([]);
    this.loadingStickers.set(true);

    try {
      const stickers = await firstValueFrom(this.stickerService.getStickers(pack.id));
      this.stickers.set(stickers);
    } catch {
      this.stickers.set([]);
    } finally {
      this.loadingStickers.set(false);
    }
  }

  goBackToPacks(): void {
    this.selectedPack.set(null);
    this.stickers.set([]);
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
    return this.stickerService.getRenderUrl(stickerId, 'preview');
  }

  isPreviewLoading(url: string): boolean {
    return !!url && !this.previewStatus()[url];
  }

  isPreviewLoaded(url: string): boolean {
    return this.previewStatus()[url] === 'loaded';
  }

  isPreviewError(url: string): boolean {
    return this.previewStatus()[url] === 'error';
  }

  markPreviewLoaded(url: string): void {
    if (!url) {
      return;
    }
    this.previewStatus.update((current) => current[url] === 'loaded'
      ? current
      : { ...current, [url]: 'loaded' });
  }

  markPreviewError(url: string): void {
    if (!url) {
      return;
    }
    this.previewStatus.update((current) => current[url] === 'error'
      ? current
      : { ...current, [url]: 'error' });
  }

  private async loadCategoriesAsync(): Promise<void> {
    this.loadingCategories.set(true);
    this.selectedPack.set(null);
    this.stickers.set([]);

    try {
      const categories = await firstValueFrom(this.stickerService.getCategories());
      this.categories.set(categories);

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
    } catch {
      this.packs.set([]);
    } finally {
      this.loadingPacks.set(false);
    }
  }
}
