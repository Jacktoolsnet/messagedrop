import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, catchError, map, of } from 'rxjs';
import { AirQualityData } from '../../interfaces/air-quality-data';
import { AirQualityCategory, AirQualityMetricKey, AirQualityTileValue } from '../../interfaces/air-quality-tile-value';
import { getAirQualityLevelInfo } from '../../utils/air-quality-level.util';
import { MapService } from '../../services/map.service';
import { NominatimService } from '../../services/nominatim.service';
import { AirQualityDetailComponent } from './air-quality-detail/air-quality-detail.component';

@Component({
  selector: 'app-air-quality',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSliderModule,
    FormsModule,
    AirQualityDetailComponent,
    MatButtonToggleModule
  ],
  templateUrl: './air-quality.component.html',
  styleUrls: ['./air-quality.component.css']
})
export class AirQualityComponent implements OnInit {
  private readonly mapService = inject(MapService);
  private readonly nominatimService = inject(NominatimService);
  private readonly dialogData = inject<{ airQuality: AirQualityData; selectedKey?: AirQualityMetricKey }>(MAT_DIALOG_DATA);

  tileValues: AirQualityTileValue[] = [];
  allTileValues: AirQualityTileValue[] = [];
  categoryModes: AirQualityCategory[] = ['pollen', 'particulateMatter', 'pollutants'];
  selectedDayIndex = 0;
  selectedHour = 0;
  selectedCategory: AirQualityCategory = 'pollen';
  selectedTile: AirQualityTileValue | null = null;
  tileIndex = 0;
  allKeys: AirQualityMetricKey[] = [];
  dayLabels: string[] = [];
  locationName?: string;
  locationName$?: Observable<string>;

  get airQuality(): AirQualityData | null {
    return this.dialogData?.airQuality ?? null;
  }

  ngOnInit(): void {
    this.selectedHour = new Date().getHours();
    this.checkAvailableCategories();
    this.getLocationName();
    const initialKey = this.dialogData.selectedKey;
    if (initialKey) {
      this.setSelectionByKey(initialKey);
    } else {
      this.updateTiles();
    }
    this.dayLabels = this.getDayLabels();
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
      this.allTileValues = this.getAllTileValues();
      this.allKeys = this.getAllCategoryKeys();
      this.tileIndex = this.allKeys.findIndex(k => k === key);
      this.selectedTile = this.allTileValues.find(t => t.key === key) ?? null;
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
      alder_pollen: 'Alder Pollen',
      birch_pollen: 'Birch Pollen',
      grass_pollen: 'Grass Pollen',
      mugwort_pollen: 'Mugwort Pollen',
      olive_pollen: 'Olive Pollen',
      ragweed_pollen: 'Ragweed Pollen',
      pm10: 'PM10',
      pm2_5: 'PM2.5',
      carbon_monoxide: 'CO',
      nitrogen_dioxide: 'NO₂',
      sulphur_dioxide: 'SO₂',
      ozone: 'Ozone'
    };
    return map[key] ?? key;
  }

  getCategoryLabel(category: AirQualityCategory): string {
    switch (category) {
      case 'pollen': return 'Pollen';
      case 'particulateMatter': return 'Particulate Matter';
      case 'pollutants': return 'Pollutants';
      default: return category;
    }
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
    this.selectedDayIndex = index;
    this.updateTiles();
  }

  onHourChange(): void {
    this.updateTiles();
  }

  updateTiles(): void {
    const airQuality = this.airQuality;
    if (!airQuality) return;

    const timeIndices = this.getDayTimeIndices(this.selectedDayIndex);
    const hourIndex = timeIndices[this.selectedHour] ?? null;
    const fullTimeArray = airQuality.hourly.time;

    const isDarkMode = document.body.classList.contains('dark');
    this.tileValues = this.getCategoryKeys().map((key) => {
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
        levelText: levelInfo.label,
        minMax: this.getHourlyMinMaxFromAirQuality(key)
      };
    });

    this.allKeys = this.getAllCategoryKeys();
  }

  onCategoryToggle(category: AirQualityCategory): void {
    this.selectedCategory = category;
    this.updateTiles();
  }

  getLocationName(): void {
    this.locationName$ = this.nominatimService
      .getNominatimPlaceByLocation(this.mapService.getMapLocation())
      .pipe(
        map(res => {
          const addr = res.nominatimPlace.address;
          const place = addr?.city || addr?.town || addr?.village || addr?.hamlet || 'Unknown';
          const country = addr?.country || '';
          this.locationName = `${place}${country ? ', ' + country : ''}`;
          return this.locationName;
        }),
        catchError(() => of('Air Quality'))
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
        if (value === 0) return 'None';
        if (value <= 10) return 'Low';
        if (value <= 30) return 'Moderate';
        if (value <= 50) return 'High';
        return 'Very High';
      case 'particulateMatter':
        if (value <= 20) return 'Good';
        if (value <= 40) return 'Moderate';
        if (value <= 60) return 'Unhealthy for Sensitive';
        if (value <= 100) return 'Unhealthy';
        return 'Very Unhealthy';
      case 'pollutants':
        if (value <= 40) return 'Good';
        if (value <= 100) return 'Moderate';
        if (value <= 200) return 'Unhealthy';
        return 'Very Unhealthy';
      default:
        return 'Unknown';
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
    if (value === 0) return 'None';
    if (value <= 10) return 'Low';
    if (value <= 30) return 'Moderate';
    if (value <= 50) return 'High';
    return 'Very High';
  }

  getInfoTooltip(key: AirQualityMetricKey): string {
    return this.infoTooltips[key] || 'No description available.';
  }

  getValueDescription(value: number, key: AirQualityMetricKey): string {
    if (this.selectedCategory === 'pollen') {
      if (value === 0) return 'No pollen exposure expected.';
      if (value <= 10) return 'Low pollen concentration.';
      if (value <= 30) return 'Moderate pollen concentration.';
      if (value <= 50) return 'High pollen concentration.';
      return 'Very high pollen concentration.';
    }

    if (this.selectedCategory === 'particulateMatter') {
      if (key === 'pm10') {
        if (value <= 20) return 'Low PM10 level. Air quality is good.';
        if (value <= 40) return 'Moderate PM10 level.';
        if (value <= 60) return 'Unhealthy for sensitive groups.';
        return 'High PM10 level. Consider limiting outdoor activity.';
      }
      if (key === 'pm2_5') {
        if (value <= 10) return 'Low PM2.5 level. Air is clean.';
        if (value <= 25) return 'Moderate PM2.5 level.';
        if (value <= 50) return 'High PM2.5. Avoid prolonged exposure.';
        return 'Very high PM2.5. Unhealthy air quality.';
      }
    }

    if (this.selectedCategory === 'pollutants') {
      const pollutantsInfo: Partial<Record<AirQualityMetricKey, string>> = {
        carbon_monoxide: 'Carbon monoxide (CO) – a colorless, odorless gas harmful in high concentrations.',
        nitrogen_dioxide: 'Nitrogen dioxide (NO₂) – a pollutant from traffic and combustion.',
        sulphur_dioxide: 'Sulphur dioxide (SO₂) – can irritate airways and affect lung function.',
        ozone: 'Ozone (O₃) – high levels can lead to respiratory problems.',
      };
      return pollutantsInfo[key] || 'Air pollutant level.';
    }

    return 'No description available.';
  }

  private readonly infoTooltips: Partial<Record<AirQualityMetricKey, string>> = {
    alder_pollen: 'Alder pollen can cause allergic reactions like sneezing or itchy eyes.',
    birch_pollen: 'Birch pollen is a common allergen, especially in spring.',
    grass_pollen: 'Grass pollen is a major cause of hay fever during the summer months.',
    mugwort_pollen: 'Mugwort pollen is active late summer and may trigger asthma.',
    olive_pollen: 'Olive pollen is common in Mediterranean areas.',
    ragweed_pollen: 'Ragweed pollen is highly allergenic and spreads easily.',
    pm10: 'PM10 refers to coarse particles that can enter the lungs and cause respiratory issues.',
    pm2_5: 'PM2.5 are fine particles that penetrate deep into the lungs and bloodstream.',
    carbon_monoxide: 'CO is a toxic gas that can impair oxygen transport in the body.',
    nitrogen_dioxide: 'NO₂ is produced by traffic emissions and affects lung function.',
    sulphur_dioxide: 'SO₂ can cause respiratory symptoms and aggravate asthma.',
    ozone: 'O₃ is a reactive gas that can cause airway inflammation and breathing issues.',
  };

  onTileClick(tile: AirQualityTileValue): void {
    if (tile.minMax.min === 0 && tile.minMax.max === 0) {
      return;
    }
    this.allTileValues = this.getAllTileValues();
    this.allKeys = this.getAllCategoryKeys();
    this.tileIndex = this.allKeys.findIndex(k => k === tile.key);
    this.selectedTile = tile;
  }

  selectPreviousTile(): void {
    if (this.tileIndex > 0) {
      this.tileIndex--;
      const key = this.allKeys[this.tileIndex];
      this.selectedTile = this.allTileValues.find(t => t.key === key) ?? null;
    }
  }

  selectNextTile(): void {
    if (this.tileIndex < this.allKeys.length - 1) {
      this.tileIndex++;
      const key = this.allKeys[this.tileIndex];
      this.selectedTile = this.allTileValues.find(t => t.key === key) ?? null;
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
          levelText: levelInfo.label,
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
