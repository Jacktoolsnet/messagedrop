import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ShoppingCategory, ShoppingList, TileSetting } from '../../../../interfaces/tile-settings';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { DisplayMessageService } from '../../../../services/display-message.service';
import { ShoppingImageStorageService } from '../../../../services/shopping-image-storage.service';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../../../utils/help-dialog/help-dialog.service';
import { saveDialogOnImplicitDismiss } from '../../../utils/dialog-auto-save.util';
import { ShoppingCategoryDeleteComponent } from '../shopping-category-delete/shopping-category-delete.component';
import { ShoppingCategoryEditComponent } from '../shopping-category-edit/shopping-category-edit.component';
import { ShoppingCategorySortComponent } from '../shopping-category-sort/shopping-category-sort.component';
import { ShoppingProductsComponent } from '../shopping-products/shopping-products.component';
import {
  ShoppingTileSettingsComponent,
  ShoppingTileSettingsData,
  ShoppingTileSettingsResult
} from '../shopping-tile-settings/shopping-tile-settings.component';
import { normalizeShoppingList } from '../shopping-list.util';

interface ShoppingTileDialogData {
  tile: TileSetting;
  onTileCommit?: (updated: TileSetting) => void;
}

@Component({
  selector: 'app-shopping-tile-edit',
  standalone: true,
  imports: [DialogHeaderComponent, MatButtonModule, MatDialogActions, MatDialogContent, MatIcon, TranslocoPipe],
  templateUrl: './shopping-tile-edit.component.html',
  styleUrl: './shopping-tile-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShoppingTileEditComponent {
  private readonly dialogRef = inject(MatDialogRef<ShoppingTileEditComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translation = inject(TranslationHelperService);
  private readonly messages = inject(DisplayMessageService);
  private readonly imageStorage = inject(ShoppingImageStorageService);
  readonly help = inject(HelpDialogService);
  readonly data = inject<ShoppingTileDialogData>(MAT_DIALOG_DATA);

  private readonly initialList = normalizeShoppingList(this.data.tile.payload?.shopping);
  readonly categories = signal<ShoppingCategory[]>(this.initialList.categories);
  readonly titleControl = new FormControl(
    this.data.tile.payload?.title || this.data.tile.label || this.translation.t('common.tileTypes.shopping'),
    { nonNullable: true }
  );
  readonly icon = signal<string | undefined>(this.data.tile.payload?.icon);
  readonly saving = signal(false);

  constructor() {
    saveDialogOnImplicitDismiss(this.dialogRef, () => void this.save());
    void this.imageStorage.hydrate(this.initialList).then(list => {
      this.categories.update(categories => categories.map(category => {
        const hydrated = list.categories.find(item => item.id === category.id);
        if (!hydrated) return category;
        return {
          ...category,
          image: category.image ?? hydrated.image,
          backgroundImage: category.backgroundImage ?? hydrated.backgroundImage,
          products: category.products.map(product => ({
            ...product,
            image: product.image ?? hydrated.products.find(item => item.id === product.id)?.image
          }))
        };
      }));
    });
  }

  get headerTitle(): string {
    return this.titleControl.value.trim() || this.translation.t('common.tileTypes.shopping');
  }

  get headerIcon(): string {
    return this.icon() || 'shopping_cart';
  }

  outstandingCount(category: ShoppingCategory): number {
    return category.products.filter(product => product.needed && !product.done).length;
  }

  categoryBackground(category: ShoppingCategory): string {
    return category.backgroundImage ? `url(${category.backgroundImage})` : 'none';
  }

  categoryBackgroundOpacity(category: ShoppingCategory): number {
    return 1 - Math.min(100, Math.max(0, category.backgroundTransparency ?? 40)) / 100;
  }

  openDisplaySettings(): void {
    const ref = this.dialog.open<ShoppingTileSettingsComponent, ShoppingTileSettingsData, ShoppingTileSettingsResult | undefined>(
      ShoppingTileSettingsComponent,
      {
        width: '460px',
        maxWidth: '95vw',
        data: {
          title: this.headerTitle,
          icon: this.icon(),
          fallbackTitle: this.translation.t('common.tileTypes.shopping'),
          categories: this.categories()
        },
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        disableClose: true
      }
    );

    ref.afterClosed().subscribe(result => {
      if (!result) return;
      this.titleControl.setValue(result.title);
      this.icon.set(result.icon);
      this.categories.set(result.categories);
      this.cdr.markForCheck();
      void this.commitDisplaySettings();
    });
  }

  addCategory(): void {
    const ref = this.dialog.open(ShoppingCategoryEditComponent, {
      width: 'min(420px, calc(100vw - 2rem))',
      maxWidth: '95vw',
      maxHeight: '96vh',
      data: {},
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: true
    });
    ref.afterClosed().subscribe((category?: ShoppingCategory) => {
      if (!category) return;
      this.categories.update(categories => [...categories, { ...category, order: categories.length }]);
    });
  }

  editCategory(category: ShoppingCategory): void {
    const ref = this.dialog.open(ShoppingCategoryEditComponent, {
      width: 'min(420px, calc(100vw - 2rem))',
      maxWidth: '95vw',
      maxHeight: '96vh',
      data: { category },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: true
    });
    ref.afterClosed().subscribe((updated?: ShoppingCategory) => {
      if (!updated) return;
      this.categories.update(categories => categories.map(item => item.id === updated.id
        ? { ...updated, order: item.order }
        : item));
    });
  }

  manageProducts(category: ShoppingCategory): void {
    const ref = this.dialog.open(ShoppingProductsComponent, {
      width: '860px',
      maxWidth: '96vw',
      maxHeight: '96vh',
      data: { category, currency: this.initialList.currency },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: true
    });
    ref.afterClosed().subscribe((updated?: ShoppingCategory) => {
      if (!updated) return;
      this.categories.update(categories => categories.map(item => item.id === updated.id
        ? { ...updated, order: item.order }
        : item));
    });
  }

  async startCategoryShopping(category: ShoppingCategory): Promise<void> {
    if (!this.outstandingCount(category)) return;
    const { ShoppingModeComponent } = await import('../shopping-mode/shopping-mode.component');
    const shopping: ShoppingList = {
      categories: this.categories(),
      currency: this.initialList.currency
    };
    const ref = this.dialog.open(ShoppingModeComponent, {
      width: '620px',
      maxWidth: '96vw',
      maxHeight: '96vh',
      data: { shopping, initialCategoryId: category.id },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false
    });
    ref.afterClosed().subscribe((updated?: ShoppingList) => {
      if (!updated) return;
      this.categories.update(categories => categories.map(current => {
        const updatedCategory = updated.categories.find(item => item.id === current.id);
        if (!updatedCategory) return current;
        return {
          ...current,
          products: current.products.map(product => {
            const updatedProduct = updatedCategory.products.find(item => item.id === product.id);
            return updatedProduct
              ? { ...product, needed: updatedProduct.needed, done: updatedProduct.done }
              : product;
          })
        };
      }));
    });
  }

  deleteCategory(category: ShoppingCategory): void {
    const ref = this.dialog.open(ShoppingCategoryDeleteComponent, {
      width: '380px',
      maxWidth: '95vw',
      data: { name: category.name },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.categories.update(categories => categories
        .filter(item => item.id !== category.id)
        .map((item, order) => ({ ...item, order })));
    });
  }

  sortCategories(): void {
    if (this.categories().length < 2) return;
    const ref = this.dialog.open(ShoppingCategorySortComponent, {
      width: '480px',
      maxWidth: '95vw',
      data: { categories: this.categories() },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: true
    });
    ref.afterClosed().subscribe((categories?: ShoppingCategory[]) => {
      if (categories) this.categories.set(categories);
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    const title = this.headerTitle;
    try {
      const shopping = await this.imageStorage.prepareForStorage({
          categories: this.categories(),
          currency: this.initialList.currency
      });
      this.dialogRef.close({
        ...this.data.tile,
        label: title,
        payload: {
          ...this.data.tile.payload,
          title,
          icon: this.icon(),
          shopping: normalizeShoppingList(shopping)
        }
      } satisfies TileSetting);
    } catch {
      this.messages.open(
        this.translation.t('common.tiles.shopping.imageStorageFailed'),
        this.translation.t('common.actions.ok'),
        { duration: 3500 }
      );
      this.saving.set(false);
    }
  }

  private async commitDisplaySettings(): Promise<void> {
    const title = this.headerTitle;
    let shopping: ShoppingList;
    try {
      shopping = await this.imageStorage.prepareForStorage({
        categories: this.categories(),
        currency: this.initialList.currency
      });
    } catch {
      this.messages.open(
        this.translation.t('common.tiles.shopping.imageStorageFailed'),
        this.translation.t('common.actions.ok'),
        { duration: 3500 }
      );
      return;
    }
    const updated: TileSetting = {
      ...this.data.tile,
      label: title,
      payload: {
        ...this.data.tile.payload,
        title,
        icon: this.icon(),
        shopping: normalizeShoppingList(shopping)
      }
    };
    this.data.tile = updated;
    this.data.onTileCommit?.(updated);
    const hydrated = await this.imageStorage.hydrate(normalizeShoppingList(shopping));
    this.categories.set(hydrated.categories);
  }
}
