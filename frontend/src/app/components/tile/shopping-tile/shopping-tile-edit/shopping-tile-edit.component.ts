import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  ShoppingCategory,
  ShoppingProduct,
  ShoppingUnit,
  TileSetting
} from '../../../../interfaces/tile-settings';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../../../utils/help-dialog/help-dialog.service';
import { createShoppingId, normalizeShoppingList, SHOPPING_UNITS } from '../shopping-list.util';

interface ShoppingTileDialogData {
  tile: TileSetting;
}

@Component({
  selector: 'app-shopping-tile-edit',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatFormFieldModule,
    MatIcon,
    MatInputModule,
    MatSelectModule,
    CdkDrag,
    CdkDropList,
    CdkDragHandle,
    TranslocoPipe
  ],
  templateUrl: './shopping-tile-edit.component.html',
  styleUrl: './shopping-tile-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShoppingTileEditComponent {
  private readonly dialogRef = inject(MatDialogRef<ShoppingTileEditComponent>);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  readonly data = inject<ShoppingTileDialogData>(MAT_DIALOG_DATA);

  private readonly initialList = normalizeShoppingList(this.data.tile.payload?.shopping);
  readonly categories = signal<ShoppingCategory[]>(this.initialList.categories);
  readonly titleControl = new FormControl(
    this.data.tile.payload?.title || this.data.tile.label || this.translation.t('common.tileTypes.shopping'),
    { nonNullable: true }
  );
  readonly categoryControl = new FormControl('', { nonNullable: true });
  readonly productNameControl = new FormControl('', { nonNullable: true });
  readonly quantityControl = new FormControl(1, { nonNullable: true });
  readonly unitControl = new FormControl<ShoppingUnit>('piece', { nonNullable: true });
  readonly priceControl = new FormControl<number | null>(null);
  readonly selectedCategoryId = signal(this.initialList.categories[0]?.id ?? '');
  readonly units = SHOPPING_UNITS;

  get headerTitle(): string {
    return this.titleControl.value.trim() || this.translation.t('common.tileTypes.shopping');
  }

  addCategory(): void {
    const name = this.categoryControl.value.trim();
    if (!name) return;
    const category: ShoppingCategory = {
      id: createShoppingId('category'),
      name,
      order: this.categories().length,
      products: []
    };
    this.categories.update(categories => [...categories, category]);
    this.selectedCategoryId.set(category.id);
    this.categoryControl.reset('');
  }

  renameCategory(category: ShoppingCategory, event: Event): void {
    const name = (event.target as HTMLInputElement).value.trim();
    if (!name) return;
    this.categories.update(categories => categories.map(item => item.id === category.id ? { ...item, name } : item));
  }

  deleteCategory(category: ShoppingCategory): void {
    this.categories.update(categories => categories
      .filter(item => item.id !== category.id)
      .map((item, order) => ({ ...item, order })));
    if (this.selectedCategoryId() === category.id) {
      this.selectedCategoryId.set(this.categories()[0]?.id ?? '');
    }
  }

  addProduct(): void {
    const name = this.productNameControl.value.trim();
    const categoryId = this.selectedCategoryId();
    if (!name || !categoryId) return;
    const product: ShoppingProduct = {
      id: createShoppingId('product'),
      name,
      quantity: Math.max(0.01, Number(this.quantityControl.value) || 1),
      unit: this.unitControl.value,
      price: this.parsePrice(this.priceControl.value),
      needed: false,
      done: false,
      order: 0
    };
    this.categories.update(categories => categories.map(category => {
      if (category.id !== categoryId) return category;
      return { ...category, products: [...category.products, { ...product, order: category.products.length }] };
    }));
    this.productNameControl.reset('');
    this.quantityControl.reset(1);
    this.priceControl.reset(null);
  }

  updateProduct(category: ShoppingCategory, product: ShoppingProduct, field: 'name' | 'quantity' | 'price' | 'unit', value: unknown): void {
    this.categories.update(categories => categories.map(item => {
      if (item.id !== category.id) return item;
      const products = item.products.map(entry => {
        if (entry.id !== product.id) return entry;
        if (field === 'name') return { ...entry, name: String(value).trim() || entry.name };
        if (field === 'quantity') return { ...entry, quantity: Math.max(0.01, Number(value) || 1) };
        if (field === 'price') return { ...entry, price: this.parsePrice(value) };
        return { ...entry, unit: value as ShoppingUnit };
      });
      return { ...item, products };
    }));
  }

  toggleNeeded(category: ShoppingCategory, product: ShoppingProduct): void {
    this.categories.update(categories => categories.map(item => item.id === category.id ? {
      ...item,
      products: item.products.map(entry => entry.id === product.id
        ? { ...entry, needed: !entry.needed, done: false }
        : entry)
    } : item));
  }

  deleteProduct(category: ShoppingCategory, product: ShoppingProduct): void {
    this.categories.update(categories => categories.map(item => item.id === category.id ? {
      ...item,
      products: item.products.filter(entry => entry.id !== product.id).map((entry, order) => ({ ...entry, order }))
    } : item));
  }

  dropCategory(event: CdkDragDrop<ShoppingCategory[]>): void {
    const updated = [...this.categories()];
    moveItemInArray(updated, event.previousIndex, event.currentIndex);
    this.categories.set(updated.map((category, order) => ({ ...category, order })));
  }

  dropProduct(category: ShoppingCategory, event: CdkDragDrop<ShoppingProduct[]>): void {
    const products = [...category.products];
    moveItemInArray(products, event.previousIndex, event.currentIndex);
    this.categories.update(categories => categories.map(item => item.id === category.id
      ? { ...item, products: products.map((product, order) => ({ ...product, order })) }
      : item));
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    const title = this.headerTitle;
    this.dialogRef.close({
      ...this.data.tile,
      label: title,
      payload: {
        ...this.data.tile.payload,
        title,
        icon: 'shopping_cart',
        shopping: normalizeShoppingList({
          categories: this.categories(),
          currency: this.initialList.currency
        })
      }
    } satisfies TileSetting);
  }

  private parsePrice(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const price = Number(String(value).replace(',', '.'));
    return Number.isFinite(price) && price >= 0 ? price : undefined;
  }
}
