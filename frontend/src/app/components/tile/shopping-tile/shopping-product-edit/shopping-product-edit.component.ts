import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { ShoppingProduct, ShoppingUnit } from '../../../../interfaces/tile-settings';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';
import { createShoppingId, SHOPPING_UNITS } from '../shopping-list.util';

@Component({
  selector: 'app-shopping-product-edit',
  standalone: true,
  imports: [A11yModule, DialogHeaderComponent, ReactiveFormsModule, MatButtonModule, MatDialogActions, MatDialogContent, MatFormFieldModule, MatIcon, MatInputModule, MatSelectModule, TranslocoPipe],
  templateUrl: './shopping-product-edit.component.html',
  styleUrl: './shopping-product-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShoppingProductEditComponent {
  private readonly dialogRef = inject(MatDialogRef<ShoppingProductEditComponent>);
  private readonly translation = inject(TranslationHelperService);
  readonly product = inject<{ product?: ShoppingProduct }>(MAT_DIALOG_DATA).product;
  readonly nameControl = new FormControl(this.product?.name ?? '', { nonNullable: true });
  readonly quantityControl = new FormControl(this.product?.quantity ?? 1, { nonNullable: true });
  readonly unitControl = new FormControl<ShoppingUnit>(this.product?.unit ?? 'piece', { nonNullable: true });
  readonly priceControl = new FormControl<number | null>(this.product?.price ?? null);
  readonly units = SHOPPING_UNITS;

  get title(): string {
    return this.translation.t(this.product ? 'common.tiles.shopping.editProduct' : 'common.tiles.shopping.addProduct');
  }

  close(): void {
    this.dialogRef.close();
  }

  save(): void {
    const name = this.nameControl.value.trim();
    if (!name) return;
    const priceValue = this.priceControl.value;
    const price = priceValue === null || !Number.isFinite(Number(priceValue)) || Number(priceValue) < 0
      ? undefined
      : Number(priceValue);
    this.dialogRef.close({
      id: this.product?.id ?? createShoppingId('product'),
      name,
      quantity: Math.max(0.01, Number(this.quantityControl.value) || 1),
      unit: this.unitControl.value,
      price,
      needed: this.product?.needed ?? false,
      done: this.product?.done ?? false,
      order: this.product?.order ?? 0
    } satisfies ShoppingProduct);
  }
}
