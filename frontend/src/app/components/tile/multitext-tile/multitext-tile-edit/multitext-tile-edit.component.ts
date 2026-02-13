import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { A11yModule } from '@angular/cdk/a11y';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { TileSetting } from '../../../../interfaces/tile-settings';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { HelpDialogService } from '../../../utils/help-dialog/help-dialog.service';
import { MaticonPickerComponent } from '../../../utils/maticon-picker/maticon-picker.component';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';

interface MultitextTileDialogData {
  tile: TileSetting;
}

@Component({
  selector: 'app-multitext-tile-edit',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    ReactiveFormsModule,
    MatDialogModule,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIcon,
    A11yModule,
    TranslocoPipe
  ],
  templateUrl: './multitext-tile-edit.component.html',
  styleUrl: './multitext-tile-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MultitextTileEditComponent {
  private readonly dialogRef = inject(MatDialogRef<MultitextTileEditComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  readonly data = inject<MultitextTileDialogData>(MAT_DIALOG_DATA);

  readonly titleControl = new FormControl(
    this.data.tile.payload?.title ?? this.data.tile.label ?? this.translation.t('common.tileTypes.multitext'),
    { nonNullable: true }
  );
  readonly textControl = new FormControl(this.data.tile.payload?.text ?? '', { nonNullable: true });
  readonly icon = signal<string | undefined>(this.data.tile.payload?.icon);

  get headerTitle(): string {
    return this.titleControl.value.trim() || this.translation.t('common.tileTypes.multitext');
  }

  get headerIcon(): string {
    return this.icon() || 'notes';
  }

  pickIcon(): void {
    const ref = this.dialog.open(MaticonPickerComponent, {
      width: '520px',
      data: { current: this.icon() },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
    });

    ref.afterClosed().subscribe((selected?: string | null) => {
      if (selected !== undefined) {
        this.icon.set(selected || undefined);
      }
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    const title = this.titleControl.value.trim() || this.translation.t('common.tileTypes.multitext');
    const text = this.textControl.value;
    const updated: TileSetting = {
      ...this.data.tile,
      label: title,
      payload: {
        ...this.data.tile.payload,
        title,
        text,
        icon: this.icon()
      }
    };
    this.dialogRef.close(updated);
  }
}
