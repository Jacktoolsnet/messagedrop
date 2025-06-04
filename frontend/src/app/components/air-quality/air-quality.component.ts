import { animate, style, transition, trigger } from '@angular/animations';
import { CommonModule } from '@angular/common';
import { Component, Inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable, catchError, map, of } from 'rxjs';
import { AirQualityData } from '../../interfaces/air-quality-data';
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
    AirQualityDetailComponent
  ],
  animations: [
    trigger('fadeIn', [
      transition(':enter', [
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 }))
      ])
    ]),
    trigger('fadeOut', [
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0 }))
      ])
    ])
  ],
  templateUrl: './air-quality.component.html',
  styleUrls: ['./air-quality.component.css']
})
export class AirQualityComponent implements OnInit {
  tileValues: {
    key: string;
    value: number;
    label: string;
    unit: string;
    color: string;
    icon: string;
    description: string;
    levelText: string;
  }[] = [];
  categoryModes: Array<'pollen' | 'particulateMatter' | 'pollutants'> = ['pollen', 'particulateMatter', 'pollutants'];
  selectedDayIndex = 0;
  selectedHour = 0;
  selectedCategory: 'pollen' | 'particulateMatter' | 'pollutants' = 'pollen';
  locationName$: Observable<string> | undefined;
  locationName: string = '';
  selectedTile: any = null;

  constructor(
    private mapService: MapService,
    private nominatimService: NominatimService,
    private dialog: MatDialog,
    private dialogRef: MatDialogRef<AirQualityComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { airQuality: AirQualityData }
  ) { }

  get airQuality(): AirQualityData | null {
    return this.data.airQuality;
  }

  ngOnInit(): void {
    if (this.selectedDayIndex === 0) {
      this.selectedHour = new Date().getHours();
    } else {
      this.selectedHour = 12;
    }
    this.checkAvailableCategories();
    this.getLocationName();
    this.updateTiles();
  }

  checkAvailableCategories(): void {
    let pollenAvailable = false;
    const values = this.airQuality?.hourly?.alder_pollen;
    if (Array.isArray(values) && values.some(v => v != null)) {
      pollenAvailable = true;
    }

    this.categoryModes = pollenAvailable
      ? ['pollen', 'particulateMatter', 'pollutants']
      : ['particulateMatter', 'pollutants'];

    if (!pollenAvailable && this.selectedCategory === 'pollen') {
      this.selectedCategory = 'pollutants';
    }
  }

  getCategoryKeys(): string[] {
    switch (this.selectedCategory) {
      case 'pollen':
        return ['alder_pollen', 'birch_pollen', 'grass_pollen', 'mugwort_pollen', 'olive_pollen', 'ragweed_pollen'];
      case 'particulateMatter':
        return ['pm10', 'pm2_5'];
      case 'pollutants':
        return ['carbon_monoxide', 'nitrogen_dioxide', 'sulphur_dioxide', 'ozone'];
    }
  }

  getDayLabels(): string[] {
    const uniqueDates = Array.from(new Set(this.airQuality?.hourly.time.map(t => t.split('T')[0]) || []));
    return uniqueDates.map(dateStr => {
      const date = new Date(dateStr);
      const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: '2-digit' };
      return date.toLocaleDateString(undefined, options);
    });
  }

  getCurrentValue(key: string): number {
    const date = this.airQuality?.hourly.time[this.getDayTimeIndices(this.selectedDayIndex)[12]]; // Mittagswert
    const arr = (this.airQuality?.hourly as any)[key] as number[];
    const idx = this.airQuality?.hourly.time.indexOf(date!);
    return arr?.[idx!] ?? 0;
  }

  getDayTimeIndices(dayIndex: number): number[] {
    const uniqueDates = Array.from(new Set(this.airQuality?.hourly.time.map(t => t.split('T')[0]) || []));
    const targetDate = uniqueDates[dayIndex];
    return this.airQuality!.hourly.time
      .map((t, idx) => ({ t, idx }))
      .filter(entry => entry.t.startsWith(targetDate))
      .map(entry => entry.idx);
  }

  getChartLabel(key: string): string {
    const map: Record<string, string> = {
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
    return map[key] || key;
  }

  getCategoryLabel(category: string): string {
    switch (category) {
      case 'pollen': return 'Pollen';
      case 'particulateMatter': return 'Particulate Matter';
      case 'pollutants': return 'Pollutants';
      default: return category;
    }
  }

  getCategoryIcon(category: string): string {
    switch (category) {
      case 'pollen': return 'grass';
      case 'particulateMatter': return 'blur_on';
      case 'pollutants': return 'science';
      default: return 'bar_chart';
    }
  }

  onDayChange(index: number): void {
    this.selectedDayIndex = index;
    if (this.selectedDayIndex === 0) {
      this.selectedHour = new Date().getHours();
    } else {
      this.selectedHour = 12;
    }
    this.updateTiles();
  }

  onHourChange(): void {
    this.updateTiles(); // falls du dynamisch Inhalte aktualisierst
  }

  updateTiles(): void {
    if (!this.airQuality) return;

    const timeIndices = this.getDayTimeIndices(this.selectedDayIndex);
    const hourIndex = timeIndices[this.selectedHour];

    this.tileValues = this.getCategoryKeys().map((key) => {
      const valueArray = (this.airQuality!.hourly as any)[key] as number[];
      const value = valueArray?.[hourIndex] ?? 0;
      return {
        key,
        value,
        label: this.getChartLabel(key),
        unit: this.getUnitForKey(key),
        color: this.getPollenColor(value),
        icon: this.getWeatherIcon(key),
        description: this.getValueDescription(value, key),
        levelText: this.getLevelTextForCategoryValue(this.selectedCategory, value),
      };
    });
  }

  onCategoryToggle(category: 'pollen' | 'particulateMatter' | 'pollutants'): void {
    this.selectedCategory = category;
    this.updateTiles();
  }

  getLocationName(): void {
    this.locationName$ = this.nominatimService
      .getAddress(this.mapService.getMapLocation().latitude, this.mapService.getMapLocation().longitude)
      .pipe(
        map(res => {
          const addr = res.address;
          const place = addr?.city || addr?.town || addr?.village || addr?.hamlet || 'Unknown';
          const country = addr?.country || '';
          this.locationName = `${place}${country ? ', ' + country : ''}`
          return this.locationName;
        }),
        catchError(() => of('Air Quality'))
      );
  }

  getWeatherIcon(key: string): string {
    const map: Record<string, string> = {
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
    return map[key] || 'help_outline';
  }

  getLevelTextForCategoryValue(category: string, value: number): string {
    switch (category) {
      case 'pollen':
        if (value === 0) return 'None';
        if (value <= 10) return 'Low';
        if (value <= 30) return 'Moderate';
        if (value <= 50) return 'High';
        return 'Very High';

      case 'particulateMatter':
        // Beispiel für PM10 / µg/m³
        if (value <= 20) return 'Good';
        if (value <= 40) return 'Moderate';
        if (value <= 60) return 'Unhealthy for Sensitive';
        if (value <= 100) return 'Unhealthy';
        return 'Very Unhealthy';

      case 'pollutants':
        // Beispiel für NO2 / µg/m³
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

  getValueForKey(key: string): number {
    const dayIndices = this.getDayTimeIndices(this.selectedDayIndex);
    const values = (this.airQuality!.hourly as any)[key] as number[];
    const dayValues = dayIndices.map(i => values[i]).filter(v => v !== null && v !== undefined);
    const sum = dayValues.reduce((a, b) => a + b, 0);
    return dayValues.length ? Math.round(sum / dayValues.length) : 0;
  }

  getUnitForKey(key: string): string {
    if (key.endsWith('_pollen')) return ''; // Pollen meist ohne Einheit
    if (key === 'pm10' || key === 'pm2_5') return 'µg/m³';
    if (key === 'carbon_monoxide') return 'ppm';
    if (key === 'nitrogen_dioxide' || key === 'sulphur_dioxide' || key === 'ozone') return 'ppb';
    return '';
  }

  getPollenColor(value: number): string {
    if (value === 0) return '#BDBDBD';       // Grau
    if (value <= 10) return '#4CAF50';       // Grün
    if (value <= 30) return '#FFEB3B';       // Gelb
    if (value <= 50) return '#FF9800';       // Orange
    return '#F44336';                        // Rot
  }

  getSeverityLabel(value: number): string {
    if (value === 0) return 'None';
    if (value <= 10) return 'Low';
    if (value <= 30) return 'Moderate';
    if (value <= 50) return 'High';
    return 'Very High';
  }

  getInfoTooltip(key: string): string {
    return this.infoTooltips[key] || 'No description available.';
  }

  getValueDescription(value: number, key: string): string {
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
      const pollutantsInfo: Record<string, string> = {
        carbon_monoxide: 'Carbon monoxide (CO) – a colorless, odorless gas harmful in high concentrations.',
        nitrogen_dioxide: 'Nitrogen dioxide (NO₂) – a pollutant from traffic and combustion.',
        sulphur_dioxide: 'Sulphur dioxide (SO₂) – can irritate airways and affect lung function.',
        ozone: 'Ozone (O₃) – high levels can lead to respiratory problems.',
      };
      return pollutantsInfo[key] || 'Air pollutant level.';
    }

    return 'No description available.';
  }

  private infoTooltips: Record<string, string> = {
    // Pollen
    alder_pollen: 'Alder pollen can cause allergic reactions like sneezing or itchy eyes.',
    birch_pollen: 'Birch pollen is a common allergen, especially in spring.',
    grass_pollen: 'Grass pollen is a major cause of hay fever during the summer months.',
    mugwort_pollen: 'Mugwort pollen is active late summer and may trigger asthma.',
    olive_pollen: 'Olive pollen is common in Mediterranean areas.',
    ragweed_pollen: 'Ragweed pollen is highly allergenic and spreads easily.',

    // Particulate Matter
    pm10: 'PM10 refers to coarse particles that can enter the lungs and cause respiratory issues.',
    pm2_5: 'PM2.5 are fine particles that penetrate deep into the lungs and bloodstream.',

    // Pollutants
    carbon_monoxide: 'CO is a toxic gas that can impair oxygen transport in the body.',
    nitrogen_dioxide: 'NO₂ is produced by traffic emissions and affects lung function.',
    sulphur_dioxide: 'SO₂ can cause respiratory symptoms and aggravate asthma.',
    ozone: 'O₃ is a reactive gas that can cause airway inflammation and breathing issues.',
  };

  onTileClick(tile: any): void {
    if (tile.value == null || tile.value === 0) return;
    this.selectedTile = tile;
  }
}