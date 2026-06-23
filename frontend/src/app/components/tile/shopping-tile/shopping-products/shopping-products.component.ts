import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import { ShoppingCategory, ShoppingList, ShoppingProduct } from '../../../../interfaces/tile-settings';
import { LanguageService } from '../../../../services/language.service';
import { ShoppingImageStorageService } from '../../../../services/shopping-image-storage.service';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../../../utils/help-dialog/help-dialog.service';
import { saveDialogOnImplicitDismiss } from '../../../utils/dialog-auto-save.util';
import { ShoppingCategoryEditComponent } from '../shopping-category-edit/shopping-category-edit.component';
import { ShoppingProductEditComponent } from '../shopping-product-edit/shopping-product-edit.component';
import { ShoppingProductSortComponent } from '../shopping-product-sort/shopping-product-sort.component';

@Component({
  selector: 'app-shopping-products',
  standalone: true,
  imports: [DialogHeaderComponent, MatButtonModule, MatDialogActions, MatDialogContent, MatIcon, MatMenuModule, TranslocoPipe],
  templateUrl: './shopping-products.component.html',
  styleUrl: './shopping-products.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShoppingProductsComponent {
  private readonly dialogRef = inject(MatDialogRef<ShoppingProductsComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly language = inject(LanguageService);
  private readonly imageStorage = inject(ShoppingImageStorageService);
  readonly help = inject(HelpDialogService);
  readonly data = inject<{ category: ShoppingCategory; currency: string; selectionColor?: string }>(MAT_DIALOG_DATA);
  readonly products = signal(this.data.category.products.map(product => ({ ...product })));

  constructor() {
    saveDialogOnImplicitDismiss(this.dialogRef, () => this.save());
    void this.imageStorage.hydrateCategory(this.data.category).then(category => {
      this.data.category = {
        ...this.data.category,
        image: this.data.category.image ?? category.image,
        backgroundImage: this.data.category.backgroundImage ?? category.backgroundImage
      };
      this.products.update(products => products.map(product => ({
        ...product,
        image: product.image ?? category.products.find(item => item.id === product.id)?.image
      })));
    });
  }

  get backgroundImage(): string {
    return this.data.category.backgroundImage ? `url(${this.data.category.backgroundImage})` : 'none';
  }

  get backgroundTransparency(): string {
    return `${Math.min(100, Math.max(0, this.data.category.backgroundTransparency ?? 40))}%`;
  }


  editCategorySettings(): void {
    const ref = this.dialog.open(ShoppingCategoryEditComponent, {
      width: '420px',
      maxWidth: '95vw',
      data: { category: { ...this.data.category, products: this.products() } },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: true,
      autoFocus: false
    });
    ref.afterClosed().subscribe((updated?: ShoppingCategory) => {
      if (!updated) return;
      this.data.category = { ...updated, products: this.products() };
    });
  }


  outstandingCount(): number {
    return this.products().filter(product => product.needed && !product.done).length;
  }

  async startShopping(): Promise<void> {
    if (!this.outstandingCount()) return;
    const { ShoppingModeComponent } = await import('../shopping-mode/shopping-mode.component');
    const category = { ...this.data.category, products: this.products() };
    const shopping: ShoppingList = {
      categories: [category],
      currency: this.data.currency,
      selectionColor: this.data.selectionColor
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
      const updatedCategory = updated?.categories.find(item => item.id === category.id);
      if (updatedCategory) this.products.set(updatedCategory.products);
    });
  }

  addProduct(): void {
    this.openProductEditor();
  }

  editProduct(product: ShoppingProduct): void {
    this.openProductEditor(product);
  }

  deleteProduct(product: ShoppingProduct): void {
    this.products.update(products => products
      .filter(item => item.id !== product.id)
      .map((item, order) => ({ ...item, order })));
  }

  toggleNeeded(product: ShoppingProduct): void {
    this.products.update(products => products.map(item => item.id === product.id
      ? { ...item, needed: !item.needed, done: false }
      : item));
  }

  sortProducts(): void {
    if (this.products().length < 2) return;
    const ref = this.dialog.open(ShoppingProductSortComponent, {
      width: '480px',
      maxWidth: '95vw',
      data: { products: this.products() },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: true
    });
    ref.afterClosed().subscribe((products?: ShoppingProduct[]) => {
      if (products) this.products.set(products);
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    this.dialogRef.close({ ...this.data.category, products: this.products() } satisfies ShoppingCategory);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat(this.language.effectiveLanguage(), {
      style: 'currency',
      currency: this.data.currency
    }).format(price);
  }

  private openProductEditor(product?: ShoppingProduct): void {
    const ref = this.dialog.open(ShoppingProductEditComponent, {
      width: '560px',
      maxWidth: '95vw',
      data: { product },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: true
    });
    ref.afterClosed().subscribe((updated?: ShoppingProduct) => {
      if (!updated) return;
      if (!product) {
        this.products.update(products => [...products, { ...updated, order: products.length }]);
        return;
      }
      this.products.update(products => products.map(item => item.id === updated.id
        ? { ...updated, order: item.order }
        : item));
    });
  }
}
