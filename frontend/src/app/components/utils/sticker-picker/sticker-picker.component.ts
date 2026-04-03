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

@Component({
  selector: 'app-sticker-picker',
  standalone: true,
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

  readonly categories = signal<StickerCategory[]>([]);
  readonly packs = signal<StickerPack[]>([]);
  readonly stickers = signal<Sticker[]>([]);

  readonly loadingCategories = signal(false);
  readonly loadingPacks = signal(false);
  readonly loadingStickers = signal(false);

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
