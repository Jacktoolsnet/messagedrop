import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { TileSetting } from '../../../../interfaces/tile-settings';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { HelpDialogService } from '../../../utils/help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';
import {
  TileDisplaySettingsDialogData,
  TileDisplaySettingsDialogComponent,
  TileDisplaySettingsDialogResult
} from '../../tile-display-settings-dialog/tile-display-settings-dialog.component';

interface PollutionTileDialogData {
  tile: TileSetting;
  availableKeys?: string[];
}

@Component({
  selector: 'app-pollution-tile-edit',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    MatDialogModule,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatIcon,
    MatSlideToggleModule,
    TranslocoPipe
  ],
  templateUrl: './pollution-tile-edit.component.html',
  styleUrl: './pollution-tile-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PollutionTileEditComponent {
  private readonly dialogRef = inject(MatDialogRef<PollutionTileEditComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  readonly data = inject<PollutionTileDialogData>(MAT_DIALOG_DATA);
  private readonly fallbackTitle = this.translation.t('common.tileTypes.pollution');

  readonly title = signal(
    (this.data.tile.payload?.title ?? this.data.tile.label ?? this.fallbackTitle).trim() || this.fallbackTitle
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

  openDisplaySettings(): void {
    const ref = this.dialog.open<TileDisplaySettingsDialogComponent, TileDisplaySettingsDialogData, TileDisplaySettingsDialogResult | undefined>(
      TileDisplaySettingsDialogComponent,
      {
        width: '460px',
        maxWidth: '95vw',
        data: {
          title: this.title(),
          icon: this.icon(),
          fallbackTitle: this.fallbackTitle,
          dialogTitleKey: 'common.tileSettings.title'
        },
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        disableClose: false,
      }
    );

    ref.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }
      this.title.set(result.title);
      this.icon.set(result.icon);
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  save(): void {
    const title = this.title().trim() || this.fallbackTitle;
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
