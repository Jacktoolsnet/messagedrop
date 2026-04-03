import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DialogActionBarComponent } from '../../../shared/dialog-action-bar/dialog-action-bar.component';
import { DialogHeaderComponent } from '../../../shared/dialog-header/dialog-header.component';
import { TranslationHelperService } from '../../../../services/translation-helper.service';

export interface StickerCategoryNameDialogData {
  title: string;
  initialName?: string;
}

@Component({
  selector: 'app-sticker-category-name-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    DialogHeaderComponent,
    DialogActionBarComponent
  ],
  templateUrl: './sticker-category-name-dialog.component.html',
  styleUrl: './sticker-category-name-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StickerCategoryNameDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<StickerCategoryNameDialogComponent, string | null>);
  private readonly fb = inject(FormBuilder);

  protected readonly data = inject<StickerCategoryNameDialogData>(MAT_DIALOG_DATA);
  protected readonly i18n = inject(TranslationHelperService);

  protected readonly form = this.fb.nonNullable.group({
    name: this.fb.nonNullable.control(this.data.initialName?.trim() ?? '', {
      validators: [Validators.required, Validators.pattern(/\S/)]
    })
  });

  close(): void {
    this.dialogRef.close(null);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const name = this.form.controls.name.value.trim();
    if (!name) {
      return;
    }
    this.dialogRef.close(name);
  }
}
