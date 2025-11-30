import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TileSetting } from '../../../../interfaces/tile-settings';
import { MaticonPickerComponent } from '../../../utils/maticon-picker/maticon-picker.component';
import { MatDialog } from '@angular/material/dialog';
import { A11yModule } from '@angular/cdk/a11y';

interface PollutionTileDialogData {
  tile: TileSetting;
}

@Component({
  selector: 'app-pollution-tile-edit',
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
    MatSlideToggleModule,
    A11yModule
  ],
  templateUrl: './pollution-tile-edit.component.html',
  styleUrl: './pollution-tile-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PollutionTileEditComponent {
  private readonly dialogRef = inject(MatDialogRef<PollutionTileEditComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  readonly data = inject<PollutionTileDialogData>(MAT_DIALOG_DATA);

  readonly titleControl = this.fb.control(this.data.tile.payload?.title ?? this.data.tile.label ?? 'Pollution');
  readonly icon = signal<string | undefined>(this.data.tile.payload?.icon ?? 'air');

  readonly keys = [
    { key: 'alder_pollen', label: 'Alder' },
    { key: 'birch_pollen', label: 'Birch' },
    { key: 'grass_pollen', label: 'Grass' },
    { key: 'mugwort_pollen', label: 'Mugwort' },
    { key: 'olive_pollen', label: 'Olive' },
    { key: 'ragweed_pollen', label: 'Ragweed' },
    { key: 'pm10', label: 'PM10' },
    { key: 'pm2_5', label: 'PM2.5' },
    { key: 'ozone', label: 'O₃' },
    { key: 'nitrogen_dioxide', label: 'NO₂' },
    { key: 'sulphur_dioxide', label: 'SO₂' },
    { key: 'carbon_monoxide', label: 'CO' }
  ];

  readonly selectedKeys = signal<Set<string>>(new Set(this.data.tile.payload?.pollution?.keys ?? ['alder_pollen', 'birch_pollen', 'grass_pollen', 'mugwort_pollen', 'olive_pollen', 'ragweed_pollen']));

  toggleKey(key: string, checked: boolean): void {
    const next = new Set(this.selectedKeys());
    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this.selectedKeys.set(next);
  }

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
    const title = this.titleControl.value?.trim() || 'Pollution';
    const keys = Array.from(this.selectedKeys());
    const updated: TileSetting = {
      ...this.data.tile,
      label: title,
      payload: {
        ...this.data.tile.payload,
        title,
        icon: this.icon(),
        pollution: {
          keys
        }
      }
    };
    this.dialogRef.close(updated);
  }
}
