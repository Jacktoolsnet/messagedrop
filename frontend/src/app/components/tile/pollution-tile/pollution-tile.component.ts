import { ChangeDetectionStrategy, Component, Input, inject, signal } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { AirQualityData } from '../../../interfaces/air-quality-data';
import { AirQualityMetricKey } from '../../../interfaces/air-quality-tile-value';
import { Place } from '../../../interfaces/place';
import { TileSetting } from '../../../interfaces/tile-settings';
import { DatasetState, OpenMeteoRefreshService } from '../../../services/open-meteo-refresh.service';
import { PlaceService } from '../../../services/place.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { getAirQualityLevelInfo } from '../../../utils/air-quality-level.util';
import { AirQualityComponent } from '../../air-quality/air-quality.component';
import { PollutionTileEditComponent } from './pollution-tile-edit/pollution-tile-edit.component';

@Component({
  selector: 'app-pollution-tile',
  standalone: true,
  imports: [MatIcon, MatButtonModule, TranslocoPipe],
  templateUrl: './pollution-tile.component.html',
  styleUrl: './pollution-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PollutionTileComponent {
  private readonly placeSignal = signal<Place | null>(null);
  @Input() set place(value: Place) {
    this.placeSignal.set(value);
    this.airQualityState = this.refreshService.getAirQualityState(value);
    this.refreshService.refreshAirQuality(value);
  }

  @Input() set tile(value: TileSetting) {
    this.currentTile.set(value);
  }

  readonly currentTile = signal<TileSetting | null>(null);
  private airQualityState?: DatasetState<AirQualityData>;

  private readonly placeService = inject(PlaceService);
  private readonly dialog = inject(MatDialog);
  private readonly refreshService = inject(OpenMeteoRefreshService);
  private readonly translation = inject(TranslationHelperService);

  private readonly pollenKeys = [
    'alder_pollen',
    'birch_pollen',
    'grass_pollen',
    'mugwort_pollen',
    'olive_pollen',
    'ragweed_pollen'
  ];

  private readonly pollutantKeys = [
    'pm10',
    'pm2_5',
    'carbon_monoxide',
    'nitrogen_dioxide',
    'sulphur_dioxide',
    'ozone'
  ];

  private readonly labelKeyMap: Record<string, string> = {
    alder_pollen: 'weather.airQuality.metric.alderPollen',
    birch_pollen: 'weather.airQuality.metric.birchPollen',
    grass_pollen: 'weather.airQuality.metric.grassPollen',
    mugwort_pollen: 'weather.airQuality.metric.mugwortPollen',
    olive_pollen: 'weather.airQuality.metric.olivePollen',
    ragweed_pollen: 'weather.airQuality.metric.ragweedPollen',
    pm10: 'weather.airQuality.metric.pm10',
    pm2_5: 'weather.airQuality.metric.pm2_5',
    carbon_monoxide: 'weather.airQuality.metric.carbonMonoxide',
    nitrogen_dioxide: 'weather.airQuality.metric.nitrogenDioxide',
    sulphur_dioxide: 'weather.airQuality.metric.sulphurDioxide',
    ozone: 'weather.airQuality.metric.ozone'
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

  get airQuality(): AirQualityData | undefined {
    return this.airQualityState?.data() ?? undefined;
  }

  get isStale(): boolean {
    return this.airQualityState?.isStale() ?? false;
  }

  get title(): string {
    const tile = this.currentTile();
    const fallback = this.translation.t('common.tileTypes.pollution');
    return tile?.payload?.title?.trim() || tile?.label || fallback;
  }

  get icon(): string {
    return this.currentTile()?.payload?.icon || 'air';
  }

  get selectedKeys(): string[] {
    return this.currentTile()?.payload?.pollution?.keys ?? [];
  }

  get metrics(): { key: string; label: string; icon: string; value: string; level: 'none' | 'warn' | 'alert'; color: string }[] {
    const airQuality = this.airQuality;
    if (!airQuality || !airQuality.hourly?.time) return [];
    const isDarkMode = document.body.classList.contains('dark');
    const available = this.getAvailableKeys();
    const keysToUse = this.selectedKeys.filter(k => available.has(k));
    return keysToUse.map(key => {
      const values = this.getTodayValues(key);
      const maxVal = values.length ? Math.max(...values) : 0;
      const info = getAirQualityLevelInfo(key as AirQualityMetricKey, maxVal, isDarkMode);
      return {
        key,
        label: this.translation.t(this.labelKeyMap[key] ?? 'weather.airQuality.metric.unknown'),
        icon: this.iconMap[key] ?? 'blur_on',
        value: maxVal ? maxVal.toFixed(1) : '0',
        level: info.severity,
        color: info.color
      };
    });
  }

  private getTodayValues(key: string): number[] {
    const airQuality = this.airQuality;
    if (!airQuality?.hourly?.time) return [];
    const times = airQuality.hourly.time;
    const { time: _time, ...rest } = airQuality.hourly;
    void _time;
    const hourly = rest as Record<string, (number | null | undefined)[] | undefined>;
    const dataArray = hourly[key];
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

  private getAvailableKeys(): Set<string> {
    const set = new Set<string>([...this.pollutantKeys, ...this.pollenKeys]);
    if (!this.hasAnyPollenData()) {
      this.pollenKeys.forEach(k => set.delete(k));
    }
    return set;
  }

  private hasAnyPollenData(): boolean {
    const airQuality = this.airQuality;
    if (!airQuality?.hourly) return false;
    const { time: _time, ...rest } = airQuality.hourly;
    void _time;
    const hourly = rest as Record<string, (number | null | undefined)[] | undefined>;
    return this.pollenKeys.some(key => {
      const arr = hourly[key];
      return Array.isArray(arr) && arr.some(v => typeof v === 'number');
    });
  }

  edit(): void {
    const tile = this.currentTile();
    if (!tile) return;
    const availableKeys = Array.from(this.getAvailableKeys());
    const ref = this.dialog.open(PollutionTileEditComponent, {
      panelClass: 'pollution-edit-dialog',
      width: 'min(520px, 95vw)',
      maxWidth: '95vw',
      maxHeight: '95vh',
      height: 'auto',
      data: { tile, availableKeys }
    });
    ref.afterClosed().subscribe((updated?: TileSetting) => {
      if (!updated) return;
      const place = this.placeSignal();
      if (!place) return;
      const tiles = (place.tileSettings ?? []).map(t => t.id === updated.id ? { ...t, ...updated } : t);
      const updatedPlace = { ...place, tileSettings: tiles };
      this.placeSignal.set(updatedPlace);
      this.currentTile.set(updated);
      this.placeService.saveAdditionalPlaceInfos(updatedPlace);
    });
  }

  openAirQualityDetails(key: string): void {
    const metricKey = key as AirQualityMetricKey;
    const place = this.placeSignal() ?? undefined;
    const location = place?.location;
    this.dialog.open(AirQualityComponent, {
      data: { airQuality: this.airQuality, selectedKey: metricKey, place, location },
      closeOnNavigation: true,
      minWidth: '90vw',
      width: '90vw',
      maxWidth: '90vw',
      minHeight: '95vh',
      height: '95vh',
      maxHeight: '95vh',
      hasBackdrop: true,
      autoFocus: false
    });
  }
}
