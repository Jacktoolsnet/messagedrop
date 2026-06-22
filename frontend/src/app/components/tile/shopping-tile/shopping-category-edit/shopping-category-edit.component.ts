import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { ShoppingCategory, ShoppingProduct, ShoppingUnit } from '../../../../interfaces/tile-settings';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { AvatarCropperComponent } from '../../../utils/avatar-cropper/avatar-cropper.component';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../../../utils/help-dialog/help-dialog.service';
import { createShoppingId, normalizeShoppingList, SHOPPING_UNITS } from '../shopping-list.util';

export interface ShoppingCategoryEditData {
  category?: ShoppingCategory;
}

@Component({
  selector: 'app-shopping-category-edit',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    A11yModule,
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
  templateUrl: './shopping-category-edit.component.html',
  styleUrl: './shopping-category-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShoppingCategoryEditComponent {
  private readonly dialogRef = inject(MatDialogRef<ShoppingCategoryEditComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  readonly data = inject<ShoppingCategoryEditData>(MAT_DIALOG_DATA);

  private readonly source = this.data.category;
  readonly nameControl = new FormControl(this.source?.name ?? '', { nonNullable: true });
  readonly image = signal<string | undefined>(this.source?.image);
  readonly products = signal<ShoppingProduct[]>([...(this.source?.products ?? [])]);
  readonly productNameControl = new FormControl('', { nonNullable: true });
  readonly quantityControl = new FormControl(1, { nonNullable: true });
  readonly unitControl = new FormControl<ShoppingUnit>('piece', { nonNullable: true });
  readonly priceControl = new FormControl<number | null>(null);
  readonly units = SHOPPING_UNITS;

  get dialogTitle(): string {
    return this.source
      ? this.translation.t('common.tiles.shopping.editCategory')
      : this.translation.t('common.tiles.shopping.addCategory');
  }

  chooseImage(input: HTMLInputElement): void {
    input.click();
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !file.type.startsWith('image/')) return;

    const ref = this.dialog.open(AvatarCropperComponent, {
      data: {
        file,
        maxSizeMb: 0.5,
        resizeToWidth: 256,
        titleKey: 'common.tiles.shopping.categoryImageTitle',
        hintKey: 'common.tiles.shopping.categoryImageHint'
      },
      width: '420px',
      maxWidth: '95vw',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false
    });
    ref.afterClosed().subscribe((image?: string) => {
      if (image) this.image.set(image);
    });
  }

  removeImage(): void {
    this.image.set(undefined);
  }

  addProduct(): void {
    const name = this.productNameControl.value.trim();
    if (!name) return;
    this.products.update(products => [...products, {
      id: createShoppingId('product'),
      name,
      quantity: Math.max(0.01, Number(this.quantityControl.value) || 1),
      unit: this.unitControl.value,
      price: this.parsePrice(this.priceControl.value),
      needed: false,
      done: false,
      order: products.length
    }]);
    this.productNameControl.reset('');
    this.quantityControl.reset(1);
    this.priceControl.reset(null);
  }

  updateProduct(product: ShoppingProduct, field: 'name' | 'quantity' | 'price' | 'unit', value: unknown): void {
    this.products.update(products => products.map(entry => {
      if (entry.id !== product.id) return entry;
      if (field === 'name') return { ...entry, name: String(value).trim() || entry.name };
      if (field === 'quantity') return { ...entry, quantity: Math.max(0.01, Number(value) || 1) };
      if (field === 'price') return { ...entry, price: this.parsePrice(value) };
      return { ...entry, unit: value as ShoppingUnit };
    }));
  }

  toggleNeeded(product: ShoppingProduct): void {
    this.products.update(products => products.map(entry => entry.id === product.id
      ? { ...entry, needed: !entry.needed, done: false }
      : entry));
  }

  deleteProduct(product: ShoppingProduct): void {
    this.products.update(products => products
      .filter(entry => entry.id !== product.id)
      .map((entry, order) => ({ ...entry, order })));
  }

  dropProduct(event: CdkDragDrop<ShoppingProduct[]>): void {
    const products = [...this.products()];
    moveItemInArray(products, event.previousIndex, event.currentIndex);
    this.products.set(products.map((product, order) => ({ ...product, order })));
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    const name = this.nameControl.value.trim();
    if (!name) return;
    const category: ShoppingCategory = {
      id: this.source?.id ?? createShoppingId('category'),
      name,
      image: this.image(),
      order: this.source?.order ?? 0,
      products: this.products()
    };
    const normalized = normalizeShoppingList({ categories: [category], currency: 'EUR' }).categories[0];
    this.dialogRef.close(normalized);
  }

  private parsePrice(value: unknown): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const price = Number(String(value).replace(',', '.'));
    return Number.isFinite(price) && price >= 0 ? price : undefined;
  }
}
