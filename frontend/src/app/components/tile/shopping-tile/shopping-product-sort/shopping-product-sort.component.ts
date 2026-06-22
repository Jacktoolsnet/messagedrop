import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ShoppingProduct } from '../../../../interfaces/tile-settings';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-shopping-product-sort',
  standalone: true,
  imports: [DialogHeaderComponent, MatButtonModule, MatDialogActions, MatDialogContent, MatIcon, CdkDrag, CdkDropList, CdkDragHandle, TranslocoPipe],
  templateUrl: './shopping-product-sort.component.html',
  styleUrl: './shopping-product-sort.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShoppingProductSortComponent {
  private readonly dialogRef = inject(MatDialogRef<ShoppingProductSortComponent>);
  readonly products = signal(inject<{ products: ShoppingProduct[] }>(MAT_DIALOG_DATA).products.map(product => ({ ...product })));

  drop(event: CdkDragDrop<ShoppingProduct[]>): void {
    const products = [...this.products()];
    moveItemInArray(products, event.previousIndex, event.currentIndex);
    this.products.set(products.map((product, order) => ({ ...product, order })));
  }

  close(): void {
    this.dialogRef.close();
  }

  apply(): void {
    this.dialogRef.close(this.products());
  }
}
