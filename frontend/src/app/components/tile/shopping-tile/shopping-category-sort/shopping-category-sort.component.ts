import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { ShoppingCategory } from '../../../../interfaces/tile-settings';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';
import { saveDialogOnImplicitDismiss } from '../../../utils/dialog-auto-save.util';

@Component({
  selector: 'app-shopping-category-sort',
  standalone: true,
  imports: [DialogHeaderComponent, MatButtonModule, MatDialogActions, MatDialogContent, MatIcon, CdkDrag, CdkDropList, CdkDragHandle, TranslocoPipe],
  templateUrl: './shopping-category-sort.component.html',
  styleUrl: './shopping-category-sort.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShoppingCategorySortComponent {
  private readonly dialogRef = inject(MatDialogRef<ShoppingCategorySortComponent>);
  private readonly data = inject<{ categories: ShoppingCategory[] }>(MAT_DIALOG_DATA);
  readonly categories = signal(this.data.categories.map(category => ({ ...category })));

  constructor() {
    saveDialogOnImplicitDismiss(this.dialogRef, () => this.apply());
  }

  drop(event: CdkDragDrop<ShoppingCategory[]>): void {
    const categories = [...this.categories()];
    moveItemInArray(categories, event.previousIndex, event.currentIndex);
    this.categories.set(categories.map((category, order) => ({ ...category, order })));
  }

  close(): void {
    this.dialogRef.close();
  }

  apply(): void {
    this.dialogRef.close(this.categories());
  }
}
