import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ShoppingCategory, ShoppingList, ShoppingProduct } from '../../../../interfaces/tile-settings';
import { LanguageService } from '../../../../services/language.service';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';
import { normalizeShoppingList } from '../shopping-list.util';

interface ShoppingModeData {
  shopping: ShoppingList;
}

interface ShoppingModeEntry {
  category: ShoppingCategory;
  product: ShoppingProduct;
}

@Component({
  selector: 'app-shopping-mode',
  standalone: true,
  imports: [DialogHeaderComponent, MatButtonModule, MatDialogActions, MatDialogContent, MatIcon, TranslocoPipe],
  templateUrl: './shopping-mode.component.html',
  styleUrl: './shopping-mode.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShoppingModeComponent {
  private readonly dialogRef = inject(MatDialogRef<ShoppingModeComponent>);
  private readonly data = inject<ShoppingModeData>(MAT_DIALOG_DATA);
  private readonly language = inject(LanguageService);

  readonly shopping = signal(normalizeShoppingList(this.data.shopping));
  readonly selectedCategoryId = signal<string | null>(null);
  readonly currentIndex = signal(0);
  readonly celebrating = signal(false);

  readonly activeCategories = computed(() => this.shopping().categories
    .filter(category => category.products.some(product => product.needed)));

  readonly entries = computed<ShoppingModeEntry[]>(() => {
    const selectedCategoryId = this.selectedCategoryId();
    return this.shopping().categories
      .filter(category => !selectedCategoryId || category.id === selectedCategoryId)
      .flatMap(category => category.products
        .filter(product => product.needed)
        .map(product => ({ category, product })));
  });

  readonly current = computed(() => this.entries()[this.currentIndex()] ?? null);
  readonly completedCount = computed(() => this.entries().filter(entry => entry.product.done).length);
  readonly estimatedTotal = computed(() => this.entries()
    .reduce((sum, entry) => sum + (entry.product.price ?? 0), 0));

  selectCategory(categoryId: string | null): void {
    this.selectedCategoryId.set(categoryId);
    this.currentIndex.set(0);
  }

  previous(): void {
    const length = this.entries().length;
    if (!length) return;
    this.currentIndex.set((this.currentIndex() - 1 + length) % length);
  }

  next(): void {
    const length = this.entries().length;
    if (!length) return;
    this.currentIndex.set((this.currentIndex() + 1) % length);
  }

  toggleCurrent(): void {
    const current = this.current();
    if (!current) return;
    const done = !current.product.done;
    this.shopping.update(list => ({
      ...list,
      categories: list.categories.map(category => category.id === current.category.id ? {
        ...category,
        products: category.products.map(product => product.id === current.product.id ? { ...product, done } : product)
      } : category)
    }));

    if (done) {
      this.celebrating.set(true);
      setTimeout(() => this.celebrating.set(false), 420);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.([35, 25, 55]);
      }
      const entries = this.entries();
      const currentIndex = this.currentIndex();
      const nextOpenIndex = entries.findIndex((_, offset) => {
        const index = (currentIndex + offset + 1) % entries.length;
        return !entries[index].product.done;
      });
      if (nextOpenIndex >= 0) {
        const targetIndex = (currentIndex + nextOpenIndex + 1) % entries.length;
        setTimeout(() => this.currentIndex.set(targetIndex), 260);
      }
    }
  }

  close(): void {
    this.dialogRef.close(this.shopping());
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat(this.language.effectiveLanguage(), { style: 'currency', currency: this.shopping().currency }).format(price);
  }
}
