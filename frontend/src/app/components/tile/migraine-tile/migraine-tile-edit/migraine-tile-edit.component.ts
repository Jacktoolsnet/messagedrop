import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { TileSetting } from '../../../../interfaces/tile-settings';
import { MaticonPickerComponent } from '../../../utils/maticon-picker/maticon-picker.component';
import { MatDialog } from '@angular/material/dialog';
import { A11yModule } from '@angular/cdk/a11y';

interface MigraineTileDialogData {
  tile: TileSetting;
}

@Component({
  selector: 'app-migraine-tile-edit',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIcon,
    A11yModule
  ],
  templateUrl: './migraine-tile-edit.component.html',
  styleUrl: './migraine-tile-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MigraineTileEditComponent {
  private readonly dialogRef = inject(MatDialogRef<MigraineTileEditComponent>);
  private readonly dialog = inject(MatDialog);
  readonly data = inject<MigraineTileDialogData>(MAT_DIALOG_DATA);

  readonly titleControl = new FormControl(this.data.tile.payload?.title ?? this.data.tile.label ?? 'Migraine alert', { nonNullable: true });

  private defaults = {
    tempWarn1: 5,
    tempWarn2: 8,
    pressureWarn1: 6,
    pressureWarn2: 10
  };

  readonly tempWarn1 = new FormControl(this.data.tile.payload?.migraine?.tempWarn1 ?? this.defaults.tempWarn1, { nonNullable: true, validators: [Validators.required, Validators.min(0)] });
  readonly tempWarn2 = new FormControl(this.data.tile.payload?.migraine?.tempWarn2 ?? this.defaults.tempWarn2, { nonNullable: true, validators: [Validators.required, Validators.min(0)] });
  readonly pressureWarn1 = new FormControl(this.data.tile.payload?.migraine?.pressureWarn1 ?? this.defaults.pressureWarn1, { nonNullable: true, validators: [Validators.required, Validators.min(0)] });
  readonly pressureWarn2 = new FormControl(this.data.tile.payload?.migraine?.pressureWarn2 ?? this.defaults.pressureWarn2, { nonNullable: true, validators: [Validators.required, Validators.min(0)] });
  readonly icon = signal<string | undefined>(this.data.tile.payload?.icon ?? 'crisis_alert');

  pickIcon(): void {
    const ref = this.dialog.open(MaticonPickerComponent, {
      width: '520px',
      data: { current: this.icon() }
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
    if (this.tempWarn1.invalid || this.tempWarn2.invalid || this.pressureWarn1.invalid || this.pressureWarn2.invalid) {
      this.tempWarn1.markAsTouched();
      this.tempWarn2.markAsTouched();
      this.pressureWarn1.markAsTouched();
      this.pressureWarn2.markAsTouched();
      return;
    }

    const title = this.titleControl.value.trim() || 'Migraine alert';
    const updated: TileSetting = {
      ...this.data.tile,
      label: title,
      payload: {
        ...this.data.tile.payload,
        title,
        icon: this.icon(),
        migraine: {
          tempWarn1: this.tempWarn1.value,
          tempWarn2: this.tempWarn2.value,
          pressureWarn1: this.pressureWarn1.value,
          pressureWarn2: this.pressureWarn2.value
        }
      }
    };
    this.dialogRef.close(updated);
  }
}
