import { Component, Input, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AirQualityData } from '../../../interfaces/air-quality-data';
import { Place } from '../../../interfaces/place';
import { DatasetState, OpenMeteoRefreshService } from '../../../services/open-meteo-refresh.service';
import { AirQualityComponent } from '../../air-quality/air-quality.component';
import { AirQualityMetricKey } from '../../../interfaces/air-quality-tile-value';
import { getAirQualityLevelInfo } from '../../../utils/air-quality-level.util';
import { TranslationHelperService } from '../../../services/translation-helper.service';

@Component({
  selector: 'app-air-quality-tile',
  imports: [MatIcon, MatButtonModule],
  templateUrl: './air-quality-tile.component.html',
  styleUrl: './air-quality-tile.component.css'
})
export class AirQualityTileComponent {
  private placeRef?: Place;
  private airQualityState?: DatasetState<AirQualityData>;

  @Input() set place(value: Place) {
    this.placeRef = value;
    this.airQualityState = this.refreshService.getAirQualityState(value);
    this.refreshService.refreshAirQuality(value);
  }

  // --- Kategorien ---
  private readonly pollenKeys: AirQualityMetricKey[] = [
    'alder_pollen',
    'birch_pollen',
    'grass_pollen',
    'mugwort_pollen',
    'olive_pollen',
    'ragweed_pollen'
  ];

  private readonly pollutantKeys: AirQualityMetricKey[] = [
    'pm10',
    'pm2_5',
    'carbon_monoxide',
    'nitrogen_dioxide',
    'sulphur_dioxide',
    'ozone'
  ];

  // --- Label/Icon Maps ---
  private readonly labelMap: Record<string, string> = {
    alder_pollen: 'Alder Pollen',
    birch_pollen: 'Birch Pollen',
    grass_pollen: 'Grass Pollen',
    mugwort_pollen: 'Mugwort Pollen',
    olive_pollen: 'Olive Pollen',
    ragweed_pollen: 'Ragweed Pollen',
    pm10: 'PM10',
    pm2_5: 'PM2.5',
    carbon_monoxide: 'Carbon Monoxide',
    nitrogen_dioxide: 'Nitrogen Dioxide',
    sulphur_dioxide: 'Sulphur Dioxide',
    ozone: 'Ozone'
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

  private readonly dialog = inject(MatDialog);
  private readonly refreshService = inject(OpenMeteoRefreshService);
  private readonly translation = inject(TranslationHelperService);

  get airQuality(): AirQualityData | undefined {
    return this.airQualityState?.data() ?? undefined;
  }

  get minMax(): { min: number; max: number } | undefined {
    const key = this.dominantKey;
    if (!key) return undefined;
    return this.getHourlyMinMax(key);
  }

  get isStale(): boolean {
    return this.airQualityState?.isStale() ?? false;
  }

  get dominantKey(): AirQualityMetricKey | '' {
    return this.getDominantKey();
  }

  get label(): string {
    const key = this.dominantKey;
    return key ? this.getChartLabel(key) : '';
  }

  get value(): number {
    const key = this.dominantKey;
    return key ? this.getHourlyValue(key) : 0;
  }

  get level(): string {
    const key = this.dominantKey;
    if (!key) return '';
    const info = getAirQualityLevelInfo(key, this.value, document.body.classList.contains('dark'));
    return this.translation.t(info.labelKey);
  }

  get airQualityIcon(): string | undefined {
    const key = this.dominantKey;
    if (!key) return undefined;
    return this.getAirQualityIcon(key);
  }

  // --- Dominanz-Logik ---
  /** Wählt den Key mit dem höchsten Tages-Max. Präferenz: Pollen → sonst Schadstoffe. */
  private getDominantKey(): AirQualityMetricKey | '' {
    if (!this.airQuality?.hourly?.time) return '';

    const pollenWinner = this.getBestOfKeys(this.pollenKeys);
    if (pollenWinner) return pollenWinner as AirQualityMetricKey;

    const pollutantWinner = this.getBestOfKeys(this.pollutantKeys);
    if (pollutantWinner) return pollutantWinner as AirQualityMetricKey;

    return ''; // Fallback: nichts vorhanden
  }

  /** Liefert den Key mit größtem Tages-Max aus der gegebenen Liste oder '' wenn alles leer. */
  private getBestOfKeys(keys: readonly AirQualityMetricKey[]): AirQualityMetricKey | '' {
    let bestKey: AirQualityMetricKey | '' = '';
    let bestValue = -Infinity;

    for (const key of keys) {
      const mm = this.getHourlyMinMax(key);
      // Wenn Min/Max beides 0 und auch keine realen Werte vorhanden, ignorieren:
      const hasAnyValue = this.hasAnyTodayValue(key);
      if (!hasAnyValue) continue;

      if (mm && mm.max > bestValue) {
        bestValue = mm.max;
        bestKey = key;
      }
    }
    return bestKey;
  }

  private hasAnyTodayValue(key: string): boolean {
    const airQuality = this.airQuality;
    if (!airQuality?.hourly?.time) return false;
    const values = this.getHourlyArray(key);
    if (!Array.isArray(values)) return false;

    const currentDate = new Date().toISOString().split('T')[0];
    const timeArray = airQuality.hourly.time;
    for (let i = 0; i < timeArray.length; i++) {
      if (timeArray[i]?.startsWith(currentDate)) {
        const v = values[i];
        if (typeof v === 'number') return true;
      }
    }
    return false;
  }

  // --- Werte + Min/Max ---
  private getHourlyValue(key: string): number {
    const airQuality = this.airQuality;
    if (!airQuality?.hourly?.time) return 0;

    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentHour = now.getHours(); // 0-23

    const timeArray = airQuality.hourly.time;
    const baseIndex = timeArray.findIndex((t) => t.startsWith(`${currentDate}T00:00`));
    if (baseIndex === -1) return 0;

    const hourIndex = baseIndex + currentHour;
    const arr = this.getHourlyArray(key);
    if (!arr) {
      return 0;
    }
    const value = arr[hourIndex];
    return typeof value === 'number' ? value : 0;
  }

  private getHourlyMinMax(key: string): { min: number; max: number } | undefined {
    const airQuality = this.airQuality;
    if (!airQuality?.hourly?.time) {
      return undefined;
    }

    const timeArray = airQuality.hourly.time;
    const valuesArray = this.getHourlyArray(key);
    if (!Array.isArray(valuesArray)) return undefined;

    const currentDate = new Date().toISOString().split('T')[0];
    const valuesToday = timeArray
      .map((t: string, i: number) => (t?.startsWith(currentDate) ? valuesArray[i] : undefined))
      .filter((v: number | null | undefined): v is number => typeof v === 'number');

    if (valuesToday.length === 0) return undefined;
    return { min: Math.min(...valuesToday), max: Math.max(...valuesToday) };
  }

  // --- UI Hilfen ---
  private getAirQualityIcon(key: string): string {
    return this.iconMap[key] || 'help_outline';
  }

  getChartLabel(key: string): string {
    return this.labelMap[key] || key || 'Air Quality';
  }

  /**
   * Sehr einfache Level-Heuristik:
   * - Für Pollen: wie gehabt.
   * - Für Schadstoffe: grobe Stufen (Good/Moderate/Unhealthy/Very High) rein nach Rohwert.
   *   (Kann ich dir gern mit offiziellen AQI-Schwellen je Stoff verfeinern.)
   */
  private getLevelTextForCategoryValue(key: string, value: number): string {
    if (!value || value <= 0) return 'none';

    const isPollen = (this.pollenKeys as readonly string[]).includes(key);
    if (isPollen) {
      if (value <= 10) return 'low';
      if (value <= 30) return 'moderate';
      if (value <= 50) return 'high';
      return 'very high';
    }

    // Grobe Default-Schwellen für Schadstoffe (unit: µg/m³; CO hier als µg/m³ aus Open-Meteo)
    if (value <= 20) return 'good';
    if (value <= 50) return 'moderate';
    if (value <= 100) return 'unhealthy';
    return 'very high';
  }

  // --- Dialog ---
  public openAirQualityDetails(selectedKey?: AirQualityMetricKey): void {
    const location = this.placeRef?.location;
    const dialogRef = this.dialog.open(AirQualityComponent, {
      data: { airQuality: this.airQuality, selectedKey, place: this.placeRef, location },
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
    dialogRef.afterClosed().subscribe();
  }

  private getHourlyArray(key: string): (number | null)[] | undefined {
    const airQuality = this.airQuality;
    const hourly = airQuality?.hourly as Record<string, (number | null)[] | undefined> | undefined;
    return hourly?.[key];
  }
}
