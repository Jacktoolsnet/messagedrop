import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslocoPipe } from '@jsverse/transloco';
import { ShoppingCategory } from '../../../../interfaces/tile-settings';
import { DisplayMessageService } from '../../../../services/display-message.service';
import { ShoppingTemplateService } from '../../../../services/shopping-template.service';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { saveDialogOnImplicitDismiss } from '../../../utils/dialog-auto-save.util';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../../../utils/help-dialog/help-dialog.service';
import { MaticonPickerComponent } from '../../../utils/maticon-picker/maticon-picker.component';

export interface ShoppingTileSettingsData {
  title: string;
  icon?: string;
  fallbackTitle: string;
  categories: ShoppingCategory[];
}

export interface ShoppingTileSettingsResult {
  title: string;
  icon?: string;
  categories: ShoppingCategory[];
}

@Component({
  selector: 'app-shopping-tile-settings',
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
    TranslocoPipe
  ],
  templateUrl: './shopping-tile-settings.component.html',
  styleUrl: './shopping-tile-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ShoppingTileSettingsComponent {
  private readonly dialogRef = inject(MatDialogRef<ShoppingTileSettingsComponent, ShoppingTileSettingsResult | undefined>);
  private readonly dialog = inject(MatDialog);
  private readonly messages = inject(DisplayMessageService);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  readonly templateService = inject(ShoppingTemplateService);
  readonly data = inject<ShoppingTileSettingsData>(MAT_DIALOG_DATA);

  readonly titleControl = new FormControl(this.data.title, { nonNullable: true });
  readonly templateControl = new FormControl<string | null>(null);
  readonly icon = signal<string | undefined>(this.data.icon);
  readonly categories = signal(this.data.categories.map(category => ({
    ...category,
    products: category.products.map(product => ({ ...product }))
  })));

  constructor() {
    saveDialogOnImplicitDismiss(this.dialogRef, () => this.save());
  }

  templateLabel(templateId: string): string {
    const template = this.templateService.templates.find(item => item.id === templateId);
    return template ? this.templateService.templateName(template) : templateId;
  }

  templateStats(): { categories: number; products: number } | null {
    const template = this.templateService.templates.find(item => item.id === this.templateControl.value);
    return template ? {
      categories: template.categories.length,
      products: template.categories.reduce((sum, category) => sum + category.products.length, 0)
    } : null;
  }

  addTemplate(): void {
    const templateId = this.templateControl.value;
    if (!templateId) return;
    const result = this.templateService.merge(this.categories(), templateId);
    this.categories.set(result.categories);
    this.messages.open(
      this.translation.t('common.tiles.shopping.templates.importSuccess', {
        categories: result.addedCategories,
        products: result.addedProducts
      }),
      this.translation.t('common.actions.ok'),
      { duration: 3500 }
    );
  }

  pickIcon(): void {
    const ref = this.dialog.open(MaticonPickerComponent, {
      width: '520px',
      data: { current: this.icon() },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false
    });
    ref.afterClosed().subscribe((selected?: string | null) => {
      if (selected !== undefined) this.icon.set(selected || undefined);
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    this.dialogRef.close({
      title: this.titleControl.value.trim() || this.data.fallbackTitle,
      icon: this.icon(),
      categories: this.categories()
    });
  }
}
