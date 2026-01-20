import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { TileSetting } from '../../../../interfaces/tile-settings';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { MaticonPickerComponent } from '../../../utils/maticon-picker/maticon-picker.component';
import { MatDialog } from '@angular/material/dialog';
import { A11yModule } from '@angular/cdk/a11y';

interface PollutionTileDialogData {
  tile: TileSetting;
  availableKeys?: string[];
}

@Component({
  selector: 'app-pollution-tile-edit',
  standalone: true,
  imports: [
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
    A11yModule,
    TranslocoPipe
],
  templateUrl: './pollution-tile-edit.component.html',
  styleUrl: './pollution-tile-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PollutionTileEditComponent {
  private readonly dialogRef = inject(MatDialogRef<PollutionTileEditComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly translation = inject(TranslationHelperService);
  readonly data = inject<PollutionTileDialogData>(MAT_DIALOG_DATA);

  readonly titleControl = this.fb.control(
    this.data.tile.payload?.title ?? this.data.tile.label ?? this.translation.t('common.tileTypes.pollution')
  );
  readonly icon = signal<string | undefined>(this.data.tile.payload?.icon ?? 'air');

  private readonly allKeys = [
    { key: 'alder_pollen', labelKey: 'weather.airQuality.metric.alderPollen' },
    { key: 'birch_pollen', labelKey: 'weather.airQuality.metric.birchPollen' },
    { key: 'grass_pollen', labelKey: 'weather.airQuality.metric.grassPollen' },
    { key: 'mugwort_pollen', labelKey: 'weather.airQuality.metric.mugwortPollen' },
    { key: 'olive_pollen', labelKey: 'weather.airQuality.metric.olivePollen' },
    { key: 'ragweed_pollen', labelKey: 'weather.airQuality.metric.ragweedPollen' },
    { key: 'pm10', labelKey: 'weather.airQuality.metric.pm10' },
    { key: 'pm2_5', labelKey: 'weather.airQuality.metric.pm2_5' },
    { key: 'ozone', labelKey: 'weather.airQuality.metric.ozone' },
    { key: 'nitrogen_dioxide', labelKey: 'weather.airQuality.metric.nitrogenDioxide' },
    { key: 'sulphur_dioxide', labelKey: 'weather.airQuality.metric.sulphurDioxide' },
    { key: 'carbon_monoxide', labelKey: 'weather.airQuality.metric.carbonMonoxide' }
  ];

  readonly keys = this.filterKeys();

  readonly selectedKeys = signal<Set<string>>(new Set(this.initialSelectedKeys()));

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
      data: { current: this.icon() },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop-transparent',
      disableClose: true,
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
    const title = this.titleControl.value?.trim() || this.translation.t('common.tileTypes.pollution');
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

  private filterKeys() {
    const allowed = new Set(this.data.availableKeys ?? this.allKeys.map(k => k.key));
    return this.allKeys.filter(k => allowed.has(k.key));
  }

  private initialSelectedKeys(): string[] {
    const existing = this.data.tile.payload?.pollution?.keys;
    const allowed = new Set(this.data.availableKeys ?? this.allKeys.map(k => k.key));
    if (existing) {
      return existing.filter(k => allowed.has(k));
    }
    // default: pollen if available, else pollutants
    const pollenDefaults = ['alder_pollen', 'birch_pollen', 'grass_pollen', 'mugwort_pollen', 'olive_pollen', 'ragweed_pollen'];
    const defaultList = pollenDefaults.filter(k => allowed.has(k));
    if (defaultList.length) return defaultList;
    return this.allKeys.map(k => k.key).filter(k => allowed.has(k));
  }
}
