import { CommonModule } from '@angular/common';
import { Component, Injector, OnInit, computed, effect, inject, runInInjectionContext, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { Observable, catchError, map, of } from 'rxjs';
import { AirQualityData } from '../../interfaces/air-quality-data';
import { AirQualityCategory, AirQualityMetricKey, AirQualityTileValue } from '../../interfaces/air-quality-tile-value';
import { getAirQualityLevelInfo } from '../../utils/air-quality-level.util';
import { NominatimService } from '../../services/nominatim.service';
import { Location } from '../../interfaces/location';
import { Place } from '../../interfaces/place';
import { DatasetState, OpenMeteoRefreshService } from '../../services/open-meteo-refresh.service';
import { AirQualityDetailComponent } from './air-quality-detail/air-quality-detail.component';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-air-quality',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSliderModule,
    FormsModule,
    AirQualityDetailComponent,
    MatButtonToggleModule,
    TranslocoPipe
  ],
  templateUrl: './air-quality.component.html',
  styleUrls: ['./air-quality.component.css']
})
export class AirQualityComponent implements OnInit {
  private readonly nominatimService = inject(NominatimService);
  private readonly dialogData = inject<{ airQuality?: AirQualityData; selectedKey?: AirQualityMetricKey; place?: Place; location?: Location }>(MAT_DIALOG_DATA);
  private readonly refreshService = inject(OpenMeteoRefreshService);
  private readonly translation = inject(TranslationHelperService);
  private readonly injector = inject(Injector);
  readonly help = inject(HelpDialogService);

  private readonly tileValuesSignal = signal<AirQualityTileValue[]>([]);
  private readonly allTileValuesSignal = signal<AirQualityTileValue[]>([]);
  private readonly allKeysSignal = signal<AirQualityMetricKey[]>([]);
  readonly tileValues = this.tileValuesSignal.asReadonly();
  readonly allTileValues = this.allTileValuesSignal.asReadonly();
  readonly allKeys = this.allKeysSignal.asReadonly();
  readonly dayLabels = computed(() => {
    const times = this.airQuality?.hourly.time ?? [];
    const uniqueDates = Array.from(new Set(times.map(t => t.split('T')[0])));
    return uniqueDates.map(dateStr => {
      const date = new Date(dateStr);
      const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: '2-digit' };
      return date.toLocaleDateString(undefined, options);
    });
  });
  categoryModes: AirQualityCategory[] = ['pollen', 'particulateMatter', 'pollutants'];
  selectedDayIndex = 0;
  selectedHour = 0;
  selectedCategory: AirQualityCategory = 'pollen';
  selectedTile: AirQualityTileValue | null = null;
  tileIndex = 0;
  locationName?: string;
  locationName$?: Observable<string>;
  private readonly airQualitySignal = signal<AirQualityData | null>(null);
  readonly airQualitySig = this.airQualitySignal.asReadonly();
  private airQualityState?: DatasetState<AirQualityData>;
  private initialKeyApplied = false;

  get airQuality(): AirQualityData | null {
    return this.airQualitySignal();
  }

  ngOnInit(): void {
    this.selectedHour = new Date().getHours();
    this.getLocationName();
    const initialKey = this.dialogData.selectedKey;
    const place = this.dialogData.place;
    if (place) {
      this.airQualityState = this.refreshService.getAirQualityState(place);
      this.refreshService.refreshAirQuality(place);
    }
    const initialAirQuality = this.dialogData.airQuality ?? this.airQualityState?.data() ?? null;
    this.airQualitySignal.set(initialAirQuality);
    runInInjectionContext(this.injector, () => {
      effect(() => {
        const nextAirQuality = this.airQualityState?.data() ?? this.dialogData.airQuality ?? null;
        this.airQualitySignal.set(nextAirQuality);
        if (!nextAirQuality) {
          this.tileValuesSignal.set([]);
          this.allTileValuesSignal.set([]);
          this.allKeysSignal.set([]);
          return;
        }
        this.checkAvailableCategories();
        const labels = this.dayLabels();
        if (this.selectedDayIndex >= labels.length) {
          this.selectedDayIndex = 0;
        }
        if (!this.categoryModes.includes(this.selectedCategory)) {
          this.selectedCategory = this.categoryModes[0] ?? this.selectedCategory;
        }
        if (initialKey && !this.initialKeyApplied) {
          this.initialKeyApplied = true;
          this.setSelectionByKey(initialKey);
        } else {
          this.updateTiles();
        }
      });
    });
  }

  private getCategoryForKey(key: AirQualityMetricKey): AirQualityCategory | null {
    if (['alder_pollen', 'birch_pollen', 'grass_pollen', 'mugwort_pollen', 'olive_pollen', 'ragweed_pollen'].includes(key)) {
      return 'pollen';
    }
    if (['pm10', 'pm2_5'].includes(key)) {
      return 'particulateMatter';
    }
    if (['carbon_monoxide', 'nitrogen_dioxide', 'sulphur_dioxide', 'ozone'].includes(key)) {
      return 'pollutants';
    }
    return null;
  }

  private setSelectionByKey(key: AirQualityMetricKey): void {
    const category = this.getCategoryForKey(key);
    if (category) {
      if (!this.categoryModes.includes(category)) {
        this.updateTiles();
        return;
      }
      this.selectedCategory = category;
      this.updateTiles();
      const allTileValues = this.getAllTileValues();
      const allKeys = this.getAllCategoryKeys();
      this.allTileValuesSignal.set(allTileValues);
      this.allKeysSignal.set(allKeys);
      this.tileIndex = allKeys.findIndex(k => k === key);
      this.selectedTile = allTileValues.find(t => t.key === key) ?? null;
    } else {
      this.updateTiles();
    }
  }

  checkAvailableCategories(): void {
    const values = this.airQuality?.hourly?.alder_pollen;
    const pollenAvailable = Array.isArray(values) && values.some(v => v != null);

    this.categoryModes = pollenAvailable
      ? ['pollen', 'particulateMatter', 'pollutants']
      : ['particulateMatter', 'pollutants'];

    if (!pollenAvailable && this.selectedCategory === 'pollen') {
      this.selectedCategory = 'pollutants';
    }
  }

  getCategoryKeys(): AirQualityMetricKey[] {
    return this.getCategoryKeysByType(this.selectedCategory);
  }

  getAllCategoryKeys(): AirQualityMetricKey[] {
    return [
      ...this.getCategoryKeysByType('pollen'),
      ...this.getCategoryKeysByType('particulateMatter'),
      ...this.getCategoryKeysByType('pollutants')
    ];
  }

  getCategoryKeysByType(type: AirQualityCategory): AirQualityMetricKey[] {
    switch (type) {
      case 'pollen':
        return ['alder_pollen', 'birch_pollen', 'grass_pollen', 'mugwort_pollen', 'olive_pollen', 'ragweed_pollen'];
      case 'particulateMatter':
        return ['pm10', 'pm2_5'];
      case 'pollutants':
        return ['carbon_monoxide', 'nitrogen_dioxide', 'sulphur_dioxide', 'ozone'];
      default:
        return [];
    }
  }

  getDayLabels(): string[] {
    const times = this.airQuality?.hourly.time ?? [];
    const uniqueDates = Array.from(new Set(times.map(t => t.split('T')[0])));
    return uniqueDates.map(dateStr => {
      const date = new Date(dateStr);
      const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: '2-digit' };
      return date.toLocaleDateString(undefined, options);
    });
  }

  getCurrentValue(key: AirQualityMetricKey): number {
    const indices = this.getDayTimeIndices(this.selectedDayIndex);
    const middayIndex = indices[12];
    if (middayIndex == null) return 0;
    const values = this.getHourlyValues(key);
    return values?.[middayIndex] ?? 0;
  }

  getDayTimeIndices(dayIndex: number): number[] {
    const times = this.airQuality?.hourly.time;
    if (!times?.length) {
      return [];
    }
    const uniqueDates = Array.from(new Set(times.map(t => t.split('T')[0])));
    const targetDate = uniqueDates[dayIndex];
    if (!targetDate) {
      return [];
    }
    return times
      .map((t, idx) => ({ t, idx }))
      .filter(entry => entry.t.startsWith(targetDate))
      .map(entry => entry.idx);
  }

  getChartLabel(key: AirQualityMetricKey): string {
    const map: Partial<Record<AirQualityMetricKey, string>> = {
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
    const labelKey = map[key] ?? 'weather.airQuality.metric.unknown';
    return this.translation.t(labelKey);
  }

  getCategoryLabel(category: AirQualityCategory): string {
    const map: Record<AirQualityCategory, string> = {
      pollen: 'weather.airQuality.category.pollen',
      particulateMatter: 'weather.airQuality.category.particulateMatter',
      pollutants: 'weather.airQuality.category.pollutants'
    };
    return this.translation.t(map[category] ?? 'common.unknown');
  }

  getCategoryIcon(category: AirQualityCategory): string {
    switch (category) {
      case 'pollen': return 'grass';
      case 'particulateMatter': return 'blur_on';
      case 'pollutants': return 'science';
      default: return 'bar_chart';
    }
  }

  onDayChange(index: number): void {
    this.selectedDayIndex = Number(index);
    this.updateTiles();
  }

  onHourChange(): void {
    if (!this.selectedTile) {
      this.updateTiles();
    }
  }

  clearSelectedTile(): void {
    this.selectedTile = null;
    this.updateTiles();
  }

  updateTiles(): void {
    const airQuality = this.airQuality;
    if (!airQuality) return;

    const timeIndices = this.getDayTimeIndices(this.selectedDayIndex);
    let hourIndex = timeIndices[this.selectedHour] ?? null;
    if (hourIndex == null && timeIndices.length) {
      const fallbackIndex = timeIndices[0];
      hourIndex = fallbackIndex ?? null;
      const fallbackTime = airQuality.hourly.time[fallbackIndex];
      const fallbackHour = fallbackTime?.split('T')[1]?.slice(0, 2);
      if (fallbackHour) {
        const parsed = Number(fallbackHour);
        if (!Number.isNaN(parsed)) {
          this.selectedHour = parsed;
        }
      }
    }
    const fullTimeArray = airQuality.hourly.time;

    const isDarkMode = document.body.classList.contains('dark');
    const tileValues = this.getCategoryKeys().map((key) => {
      const values = this.getHourlyValues(key) ?? [];
      const currentValue = hourIndex != null ? values[hourIndex] ?? 0 : 0;
      const levelInfo = getAirQualityLevelInfo(key, currentValue, isDarkMode);
      return {
        key,
        value: currentValue,
        values,
        time: fullTimeArray,
        label: this.getChartLabel(key),
        unit: this.getUnitForKey(key),
        color: levelInfo.color,
        icon: this.getWeatherIcon(key),
        description: this.getValueDescription(currentValue, key),
        levelText: this.translation.t(levelInfo.labelKey),
        minMax: this.getHourlyMinMaxFromAirQuality(key)
      };
    });

    this.tileValuesSignal.set(tileValues);
    this.allKeysSignal.set(this.getAllCategoryKeys());
  }

  onCategoryToggle(category: AirQualityCategory): void {
    this.selectedCategory = category;
    this.updateTiles();
  }

  getLocationName(): void {
    const location = this.dialogData.location ?? this.dialogData.place?.location;
    if (!location) {
      this.locationName$ = of(this.translation.t('weather.airQuality.title'));
      return;
    }
    this.locationName$ = this.nominatimService
      .getNominatimPlaceByLocation(location)
      .pipe(
        map(res => {
          const addr = res.nominatimPlace.address;
          const place = addr?.city || addr?.town || addr?.village || addr?.hamlet || this.translation.t('common.unknown');
          const country = addr?.country || '';
          this.locationName = `${place}${country ? ', ' + country : ''}`;
          return this.locationName;
        }),
        catchError(() => of(this.translation.t('weather.airQuality.title')))
      );
  }

  getWeatherIcon(key: AirQualityMetricKey): string {
    const map: Partial<Record<AirQualityMetricKey, string>> = {
      alder_pollen: 'nature',
      birch_pollen: 'park',
      grass_pollen: 'grass',
      mugwort_pollen: 'spa',
      olive_pollen: 'eco',
      ragweed_pollen: 'local_florist',
      pm10: 'blur_on',
      pm2_5: 'filter_drama',
      carbon_monoxide: 'cloud',
      nitrogen_dioxide: 'waves',
      sulphur_dioxide: 'science',
      ozone: 'flare'
    };
    return map[key] ?? 'help_outline';
  }

  getLevelTextForCategoryValue(category: AirQualityCategory, value: number): string {
    switch (category) {
      case 'pollen':
        if (value === 0) return this.translation.t('weather.airQuality.pollen.none');
        if (value <= 10) return this.translation.t('weather.airQuality.pollen.low');
        if (value <= 30) return this.translation.t('weather.airQuality.pollen.moderate');
        if (value <= 50) return this.translation.t('weather.airQuality.pollen.high');
        return this.translation.t('weather.airQuality.pollen.veryHigh');
      case 'particulateMatter':
        if (value <= 20) return this.translation.t('weather.airQuality.particulateMatter.good');
        if (value <= 40) return this.translation.t('weather.airQuality.particulateMatter.moderate');
        if (value <= 60) return this.translation.t('weather.airQuality.particulateMatter.unhealthySensitive');
        if (value <= 100) return this.translation.t('weather.airQuality.particulateMatter.unhealthy');
        return this.translation.t('weather.airQuality.particulateMatter.veryUnhealthy');
      case 'pollutants':
        if (value <= 40) return this.translation.t('weather.airQuality.pollutants.good');
        if (value <= 100) return this.translation.t('weather.airQuality.pollutants.moderate');
        if (value <= 200) return this.translation.t('weather.airQuality.pollutants.unhealthy');
        return this.translation.t('weather.airQuality.pollutants.veryUnhealthy');
      default:
        return this.translation.t('common.unknown');
    }
  }

  getLevelClass(value: number): string {
    if (value === 0) return 'level-none';
    if (value <= 10) return 'level-low';
    if (value <= 30) return 'level-moderate';
    if (value <= 50) return 'level-high';
    if (value <= 70) return 'level-very-high';
    return 'level-extreme';
  }

  getValueForKey(key: AirQualityMetricKey): number {
    const dayIndices = this.getDayTimeIndices(this.selectedDayIndex);
    const values = this.getHourlyValues(key);
    if (!values?.length) return 0;
    const dayValues = dayIndices
      .map(i => values[i])
      .filter((v): v is number => v != null);
    const sum = dayValues.reduce((a, b) => a + b, 0);
    return dayValues.length ? Math.round(sum / dayValues.length) : 0;
  }

  getUnitForKey(key: AirQualityMetricKey): string {
    if (key.endsWith('_pollen')) return '';
    if (key === 'pm10' || key === 'pm2_5') return 'µg/m³';
    if (key === 'carbon_monoxide') return 'ppm';
    if (key === 'nitrogen_dioxide' || key === 'sulphur_dioxide' || key === 'ozone') return 'ppb';
    return '';
  }

  getPollenColor(value: number): string {
    const isDarkMode = document.body.classList.contains('dark');
    const color = (() => {
      if (value === 0) return '#BDBDBD';
      if (value <= 10) return '#4CAF50';
      if (value <= 30) return '#FFC107';
      if (value <= 50) return '#FF5722';
      return '#F44336';
    })();
    return isDarkMode ? color : this.adjustColor(color, -50);
  }

  private adjustColor(hex: string, amount: number): string {
    return '#' + hex.replace(/^#/, '').replace(/../g, c =>
      ('0' + Math.min(255, Math.max(0, parseInt(c, 16) + amount)).toString(16)).slice(-2)
    );
  }

  getSeverityLabel(value: number): string {
    if (value === 0) return this.translation.t('weather.airQuality.pollen.none');
    if (value <= 10) return this.translation.t('weather.airQuality.pollen.low');
    if (value <= 30) return this.translation.t('weather.airQuality.pollen.moderate');
    if (value <= 50) return this.translation.t('weather.airQuality.pollen.high');
    return this.translation.t('weather.airQuality.pollen.veryHigh');
  }

  getInfoTooltip(key: AirQualityMetricKey): string {
    const tooltipKey = this.infoTooltipKeys[key];
    return tooltipKey ? this.translation.t(tooltipKey) : this.translation.t('weather.airQuality.noDescription');
  }

  getValueDescription(value: number, key: AirQualityMetricKey): string {
    if (this.selectedCategory === 'pollen') {
      if (value === 0) return this.translation.t('weather.airQuality.description.pollen.none');
      if (value <= 10) return this.translation.t('weather.airQuality.description.pollen.low');
      if (value <= 30) return this.translation.t('weather.airQuality.description.pollen.moderate');
      if (value <= 50) return this.translation.t('weather.airQuality.description.pollen.high');
      return this.translation.t('weather.airQuality.description.pollen.veryHigh');
    }

    if (this.selectedCategory === 'particulateMatter') {
      if (key === 'pm10') {
        if (value <= 20) return this.translation.t('weather.airQuality.description.pm10.low');
        if (value <= 40) return this.translation.t('weather.airQuality.description.pm10.moderate');
        if (value <= 60) return this.translation.t('weather.airQuality.description.pm10.sensitive');
        return this.translation.t('weather.airQuality.description.pm10.high');
      }
      if (key === 'pm2_5') {
        if (value <= 10) return this.translation.t('weather.airQuality.description.pm2_5.low');
        if (value <= 25) return this.translation.t('weather.airQuality.description.pm2_5.moderate');
        if (value <= 50) return this.translation.t('weather.airQuality.description.pm2_5.high');
        return this.translation.t('weather.airQuality.description.pm2_5.veryHigh');
      }
    }

    if (this.selectedCategory === 'pollutants') {
      const pollutantsInfo: Partial<Record<AirQualityMetricKey, string>> = {
        carbon_monoxide: 'weather.airQuality.description.pollutants.carbonMonoxide',
        nitrogen_dioxide: 'weather.airQuality.description.pollutants.nitrogenDioxide',
        sulphur_dioxide: 'weather.airQuality.description.pollutants.sulphurDioxide',
        ozone: 'weather.airQuality.description.pollutants.ozone'
      };
      const descriptionKey = pollutantsInfo[key] ?? 'weather.airQuality.description.pollutants.default';
      return this.translation.t(descriptionKey);
    }

    return this.translation.t('weather.airQuality.noDescription');
  }

  private readonly infoTooltipKeys: Partial<Record<AirQualityMetricKey, string>> = {
    alder_pollen: 'weather.airQuality.tooltips.alderPollen',
    birch_pollen: 'weather.airQuality.tooltips.birchPollen',
    grass_pollen: 'weather.airQuality.tooltips.grassPollen',
    mugwort_pollen: 'weather.airQuality.tooltips.mugwortPollen',
    olive_pollen: 'weather.airQuality.tooltips.olivePollen',
    ragweed_pollen: 'weather.airQuality.tooltips.ragweedPollen',
    pm10: 'weather.airQuality.tooltips.pm10',
    pm2_5: 'weather.airQuality.tooltips.pm2_5',
    carbon_monoxide: 'weather.airQuality.tooltips.carbonMonoxide',
    nitrogen_dioxide: 'weather.airQuality.tooltips.nitrogenDioxide',
    sulphur_dioxide: 'weather.airQuality.tooltips.sulphurDioxide',
    ozone: 'weather.airQuality.tooltips.ozone'
  };

  onTileClick(tile: AirQualityTileValue): void {
    if (tile.minMax.min === 0 && tile.minMax.max === 0) {
      return;
    }
    const allTileValues = this.getAllTileValues();
    const allKeys = this.getAllCategoryKeys();
    this.allTileValuesSignal.set(allTileValues);
    this.allKeysSignal.set(allKeys);
    this.tileIndex = allKeys.findIndex(k => k === tile.key);
    this.selectedTile = tile;
  }

  selectPreviousTile(): void {
    if (this.tileIndex > 0) {
      this.tileIndex--;
      const key = this.allKeys()[this.tileIndex];
      this.selectedTile = this.allTileValues().find(t => t.key === key) ?? null;
    }
  }

  selectNextTile(): void {
    if (this.tileIndex < this.allKeys().length - 1) {
      this.tileIndex++;
      const key = this.allKeys()[this.tileIndex];
      this.selectedTile = this.allTileValues().find(t => t.key === key) ?? null;
    }
  }

  getAllTileValues(): AirQualityTileValue[] {
    const airQuality = this.airQuality;
    if (!airQuality) return [];

    const timeIndices = this.getDayTimeIndices(this.selectedDayIndex);
    const hourIndex = timeIndices[this.selectedHour] ?? null;
    const fullTimeArray = airQuality.hourly.time;

    const isDarkMode = document.body.classList.contains('dark');
    return this.categoryModes.flatMap((category) =>
      this.getCategoryKeysByType(category).map((key) => {
        const values = this.getHourlyValues(key) ?? [];
        const currentValue = hourIndex != null ? values[hourIndex] ?? 0 : 0;
        const levelInfo = getAirQualityLevelInfo(key, currentValue, isDarkMode);
        return {
          key,
          value: currentValue,
          values,
          time: fullTimeArray,
          label: this.getChartLabel(key),
          unit: this.getUnitForKey(key),
          color: levelInfo.color,
          icon: this.getWeatherIcon(key),
          description: this.getValueDescription(currentValue, key),
          levelText: this.translation.t(levelInfo.labelKey),
          minMax: this.getHourlyMinMaxFromAirQuality(key)
        };
      })
    );
  }

  getHourlyMinMaxFromAirQuality(field: AirQualityMetricKey): { min: number; max: number } {
    const airQuality = this.airQuality;
    if (!airQuality) {
      return { min: 0, max: 0 };
    }
    const timeArray = airQuality.hourly.time;
    const uniqueDates = [...new Set(timeArray.map(t => t.split('T')[0]))];

    if (this.selectedDayIndex >= uniqueDates.length) {
      return { min: 0, max: 0 };
    }

    const selectedDate = uniqueDates[this.selectedDayIndex];
    const indicesForDay = timeArray
      .map((t, i) => t.startsWith(selectedDate) ? i : -1)
      .filter(i => i !== -1);

    const values = indicesForDay
      .map(i => (airQuality.hourly[field])[i])
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));

    if (values.length === 0) return { min: 0, max: 0 };

    return {
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }

  private getHourlyValues(key: AirQualityMetricKey): number[] | undefined {
    return this.airQuality?.hourly[key];
  }
}
