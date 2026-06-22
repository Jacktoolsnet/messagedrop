import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Place } from '../../../interfaces/place';
import { ShoppingList, ShoppingProduct, TileSetting } from '../../../interfaces/tile-settings';
import { PlaceService } from '../../../services/place.service';
import { LanguageService } from '../../../services/language.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { ShoppingImageStorageService } from '../../../services/shopping-image-storage.service';
import { activeShoppingProducts, normalizeShoppingList } from './shopping-list.util';

@Component({
  selector: 'app-shopping-tile',
  standalone: true,
  imports: [MatButtonModule, MatIcon, TranslocoPipe],
  templateUrl: './shopping-tile.component.html',
  styleUrl: './shopping-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShoppingTileComponent implements OnChanges {
  @Input({ required: true }) tile!: TileSetting;
  @Input({ required: true }) place!: Place;

  private readonly dialog = inject(MatDialog);
  private readonly placeService = inject(PlaceService);
  private readonly language = inject(LanguageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translation = inject(TranslationHelperService);
  private readonly imageStorage = inject(ShoppingImageStorageService);

  readonly currentTile = signal<TileSetting | null>(null);

  ngOnChanges(): void {
    this.currentTile.set(this.tile);
  }

  get title(): string {
    const tile = this.currentTile();
    return tile?.payload?.title?.trim() || tile?.label || this.translation.t('common.tileTypes.shopping');
  }

  get icon(): string {
    return this.currentTile()?.payload?.icon || 'shopping_cart';
  }

  get shopping(): ShoppingList {
    return normalizeShoppingList(this.currentTile()?.payload?.shopping);
  }

  get activeProducts(): ShoppingProduct[] {
    return activeShoppingProducts(this.shopping);
  }

  get completedCount(): number {
    return this.activeProducts.filter(product => product.done).length;
  }

  get estimatedTotal(): number {
    return this.activeProducts.reduce((sum, product) => sum + (product.price ?? 0), 0);
  }

  get previewCategories(): { name: string; products: ShoppingProduct[] }[] {
    return this.shopping.categories
      .map(category => ({ name: category.name, products: category.products.filter(product => product.needed) }))
      .filter(category => category.products.length > 0);
  }

  async editTile(): Promise<void> {
    const tile = this.currentTile();
    if (!tile) return;
    const { ShoppingTileEditComponent } = await import('./shopping-tile-edit/shopping-tile-edit.component');
    const ref = this.dialog.open(ShoppingTileEditComponent, {
      width: '820px',
      maxWidth: '96vw',
      maxHeight: '96vh',
      data: {
        tile,
        onTileCommit: (updated: TileSetting) => void this.applyTileUpdate(updated)
      },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: true
    });
    ref.afterClosed().subscribe((updated?: TileSetting) => {
      if (updated) void this.applyTileUpdate(updated);
    });
  }

  async openShoppingMode(event?: Event): Promise<void> {
    event?.stopPropagation();
    if (!this.activeProducts.length) return;
    const { ShoppingModeComponent } = await import('./shopping-mode/shopping-mode.component');
    const ref = this.dialog.open(ShoppingModeComponent, {
      width: '620px',
      maxWidth: '96vw',
      maxHeight: '96vh',
      data: { shopping: this.shopping },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false
    });
    ref.afterClosed().subscribe((shopping?: ShoppingList) => {
      const tile = this.currentTile();
      if (!shopping || !tile) return;
      void this.applyTileUpdate({ ...tile, payload: { ...tile.payload, shopping } });
    });
  }

  toggleProduct(product: ShoppingProduct, event: Event): void {
    event.stopPropagation();
    const tile = this.currentTile();
    if (!tile) return;
    const shopping = this.shopping;
    const updated: ShoppingList = {
      ...shopping,
      categories: shopping.categories.map(category => ({
        ...category,
        products: category.products.map(item => item.id === product.id ? { ...item, done: !item.done } : item)
      }))
    };
    if (!product.done && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate?.(30);
    }
    void this.applyTileUpdate({ ...tile, payload: { ...tile.payload, shopping: updated } });
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat(this.language.effectiveLanguage(), { style: 'currency', currency: this.shopping.currency }).format(price);
  }

  private async applyTileUpdate(updated: TileSetting): Promise<void> {
    const previousShopping = normalizeShoppingList(this.currentTile()?.payload?.shopping);
    const tiles = (this.place.tileSettings ?? []).map(tile => tile.id === updated.id ? updated : tile);
    const updatedPlace = { ...this.place, tileSettings: tiles };
    this.place = updatedPlace;
    this.currentTile.set(updated);
    await this.placeService.saveAdditionalPlaceInfos(updatedPlace);
    await this.imageStorage.deleteRemovedFiles(
      previousShopping,
      normalizeShoppingList(updated.payload?.shopping)
    );
    this.cdr.markForCheck();
  }
}
