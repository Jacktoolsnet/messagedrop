import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { A11yModule } from '@angular/cdk/a11y';
import { TileSetting } from '../../../../interfaces/tile-settings';
import { MaticonPickerComponent } from '../../../utils/maticon-picker/maticon-picker.component';
import { MatDialog } from '@angular/material/dialog';

interface MultitextTileDialogData {
  tile: TileSetting;
}

@Component({
  selector: 'app-multitext-tile-edit',
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
  templateUrl: './multitext-tile-edit.component.html',
  styleUrl: './multitext-tile-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MultitextTileEditComponent {
  private readonly dialogRef = inject(MatDialogRef<MultitextTileEditComponent>);
  private readonly dialog = inject(MatDialog);
  readonly data = inject<MultitextTileDialogData>(MAT_DIALOG_DATA);

  readonly titleControl = new FormControl(this.data.tile.payload?.title ?? this.data.tile.label ?? 'Multitext', { nonNullable: true });
  readonly textControl = new FormControl(this.data.tile.payload?.text ?? '', { nonNullable: true });
  readonly icon = signal<string | undefined>(this.data.tile.payload?.icon);

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
    const title = this.titleControl.value.trim() || 'Multitext';
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
