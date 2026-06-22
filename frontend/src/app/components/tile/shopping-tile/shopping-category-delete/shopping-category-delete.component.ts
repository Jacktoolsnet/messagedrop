import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-shopping-category-delete',
  standalone: true,
  imports: [DialogHeaderComponent, MatButtonModule, MatDialogActions, MatDialogClose, MatDialogContent, MatIcon, TranslocoPipe],
  templateUrl: './shopping-category-delete.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShoppingCategoryDeleteComponent {
  readonly data = inject<{ name: string }>(MAT_DIALOG_DATA);
}
