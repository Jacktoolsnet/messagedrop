import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Place } from '../../../interfaces/place';
import { TileSetting } from '../../../interfaces/tile-settings';
import { AirQualityData } from '../../../interfaces/air-quality-data';
import { PlaceService } from '../../../services/place.service';
import { MatDialog } from '@angular/material/dialog';
import { PollutionTileEditComponent } from './pollution-tile-edit/pollution-tile-edit.component';
import { AirQualityComponent } from '../../air-quality/air-quality.component';
import { AirQualityMetricKey } from '../../../interfaces/air-quality-tile-value';
import { getAirQualityLevelInfo } from '../../../utils/air-quality-level.util';

@Component({
  selector: 'app-pollution-tile',
  standalone: true,
  imports: [CommonModule, MatIcon, MatButtonModule],
  templateUrl: './pollution-tile.component.html',
  styleUrl: './pollution-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PollutionTileComponent implements OnChanges {
  @Input() tile!: TileSetting;
  @Input() place!: Place;

  readonly currentTile = signal<TileSetting | null>(null);
  airQuality?: AirQualityData;
  isStale = false;

  private readonly placeService = inject(PlaceService);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);

  private readonly labelMap: Record<string, string> = {
    alder_pollen: 'Alder',
    birch_pollen: 'Birch',
    grass_pollen: 'Grass',
    mugwort_pollen: 'Mugwort',
    olive_pollen: 'Olive',
    ragweed_pollen: 'Ragweed',
    pm10: 'PM10',
    pm2_5: 'PM2.5',
    carbon_monoxide: 'CO',
    nitrogen_dioxide: 'NO₂',
    sulphur_dioxide: 'SO₂',
    ozone: 'O₃'
  };

  private readonly iconMap: Record<string, string> = {
    alder_pollen: 'nature',
    birch_pollen: 'park',
    grass_pollen: 'grass',
    mugwort_pollen: 'spa',
    olive_pollen: 'eco',
    ragweed_pollen: 'local_florist',
    pm10: 'blur_on',
    pm2_5: 'grain',
    carbon_monoxide: 'air',
    nitrogen_dioxide: 'cloud',
    sulphur_dioxide: 'cloud_queue',
    ozone: 'filter_drama'
  };

  ngOnChanges(): void {
    this.currentTile.set(this.tile);
    this.airQuality = this.place.datasets.airQualityDataset.data;
    this.isStale = this.placeService.isDatasetExpired(this.place.datasets.airQualityDataset);
  }

  get title(): string {
    const tile = this.currentTile();
    return tile?.payload?.title?.trim() || tile?.label || 'Pollution';
  }

  get icon(): string {
    return this.currentTile()?.payload?.icon || 'air';
  }

  get selectedKeys(): string[] {
    return this.currentTile()?.payload?.pollution?.keys ?? [];
  }

  get metrics(): { key: string; label: string; icon: string; value: string; level: 'none' | 'warn' | 'alert' }[] {
    if (!this.airQuality || !this.airQuality.hourly?.time) return [];
    const currentDate = new Date().toISOString().split('T')[0];
    return this.selectedKeys.map(key => {
      const values = this.getTodayValues(key);
      const maxVal = values.length ? Math.max(...values) : 0;
      const level = getAirQualityLevelInfo(key as AirQualityMetricKey, maxVal).severity;
      return {
        key,
        label: this.labelMap[key] ?? key,
        icon: this.iconMap[key] ?? 'blur_on',
        value: maxVal ? maxVal.toFixed(1) : '0',
        level
      };
    });
  }

  private getTodayValues(key: string): number[] {
    if (!this.airQuality?.hourly?.time) return [];
    const times = this.airQuality.hourly.time;
    const dataArray = (this.airQuality.hourly as any)[key] as number[] | undefined;
    if (!dataArray) return [];
    const currentDate = new Date().toISOString().split('T')[0];
    const values: number[] = [];
    for (let i = 0; i < times.length; i++) {
      if (times[i]?.startsWith(currentDate)) {
        const v = dataArray[i];
        if (typeof v === 'number') {
          values.push(v);
        }
      }
    }
    return values;
  }

  edit(): void {
    const tile = this.currentTile();
    if (!tile) return;
    const ref = this.dialog.open(PollutionTileEditComponent, {
      width: '520px',
      data: { tile }
    });
    ref.afterClosed().subscribe((updated?: TileSetting) => {
      if (!updated) return;
      const tiles = (this.place.tileSettings ?? []).map(t => t.id === updated.id ? { ...t, ...updated } : t);
      const updatedPlace = { ...this.place, tileSettings: tiles };
      this.place = updatedPlace;
      this.currentTile.set(updated);
      this.placeService.saveAdditionalPlaceInfos(updatedPlace);
      this.cdr.markForCheck();
    });
  }

  openAirQualityDetails(key: string): void {
    const metricKey = key as AirQualityMetricKey;
    this.dialog.open(AirQualityComponent, {
      data: { airQuality: this.airQuality, selectedKey: metricKey },
      closeOnNavigation: true,
      minWidth: '90vw',
      width: '90vw',
      maxWidth: '90vw',
      minHeight: '90vh',
      height: '90vh',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });
  }
}
