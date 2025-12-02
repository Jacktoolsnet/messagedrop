import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DateTime } from 'luxon';
import { AirQualityData } from '../../../interfaces/air-quality-data';
import { Location } from '../../../interfaces/location';
import { Place } from '../../../interfaces/place';
import { AirQualityService } from '../../../services/air-quality.service';
import { GeolocationService } from '../../../services/geolocation.service';
import { PlaceService } from '../../../services/place.service';
import { AirQualityComponent } from '../../air-quality/air-quality.component';
import { AirQualityMetricKey } from '../../../interfaces/air-quality-tile-value';
import { getAirQualityLevelInfo } from '../../../utils/air-quality-level.util';

@Component({
  selector: 'app-air-quality-tile',
  imports: [CommonModule, MatIcon, MatButtonModule],
  templateUrl: './air-quality-tile.component.html',
  styleUrl: './air-quality-tile.component.css'
})
export class AirQualityTileComponent implements OnInit {
  @Input() place!: Place;

  airQuality: AirQualityData | undefined;
  airQualityIcon: string | undefined;
  minMax: { min: number; max: number } | undefined;
  label = '';
  value = 0;
  level = '';
  dominantKey: AirQualityMetricKey | '' = '';
  isStale = false;

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

  private readonly placeService = inject(PlaceService);
  private readonly airQualityService = inject(AirQualityService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly dialog = inject(MatDialog);

  ngOnInit(): void {
    console.log(this.place.datasets.airQualityDataset.data);
    if (this.place.datasets.airQualityDataset.data) {
      if (this.placeService.isDatasetExpired(this.place.datasets.airQualityDataset)) {
        // show cached while refreshing
        this.airQuality = this.place.datasets.airQualityDataset.data;
        this.updateFromAirQuality();
        this.isStale = true;
        this.getAirQuality();
      } else {
        this.airQuality = this.place.datasets.airQualityDataset.data;
        this.updateFromAirQuality();
        this.isStale = false;
      }
    } else {
      this.getAirQuality();
    }
  }

  // --- Fetch + Update ---
  private getAirQuality() {
    if (!this.place?.boundingBox) return;

    const location: Location = this.geolocationService.getCenterOfBoundingBox(this.place.boundingBox);

    this.airQualityService
      .getAirQuality(location.plusCode, location.latitude, location.longitude, 3)
      .subscribe({
        next: (airQuality) => {
          if (airQuality) {
            this.place.datasets.airQualityDataset.data = airQuality;
            this.place.datasets.airQualityDataset.lastUpdate = DateTime.now();
            this.airQuality = airQuality;
            this.updateFromAirQuality();
            this.isStale = false;
          } else {
            this.useCachedAsStale();
          }
        },
        error: () => {
          this.useCachedAsStale();
        }
      });
  }

  private useCachedAsStale(): void {
    if (this.place.datasets.airQualityDataset.data) {
      this.airQuality = this.place.datasets.airQualityDataset.data;
      this.updateFromAirQuality();
      this.isStale = true;
    } else {
      this.airQuality = undefined;
      this.value = 0;
      this.level = '';
      this.minMax = undefined;
      this.isStale = true;
    }
  }

  private updateFromAirQuality(): void {
    const dominant = this.getDominantKey();
    this.dominantKey = dominant;

    if (!dominant) {
      this.label = '';
      this.value = 0;
      this.level = '';
      this.airQualityIcon = undefined;
      this.minMax = undefined;
      return;
    }

    this.label = this.getChartLabel(dominant);
    this.value = this.getHourlyValue(dominant);
    const info = getAirQualityLevelInfo(dominant, this.value, document.body.classList.contains('dark'));
    this.level = info.label;
    this.airQualityIcon = this.getAirQualityIcon(dominant);
    this.minMax = this.getHourlyMinMax(dominant);
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

      if (mm.max > bestValue) {
        bestValue = mm.max;
        bestKey = key;
      }
    }
    return bestKey;
  }

  private hasAnyTodayValue(key: string): boolean {
    if (!this.airQuality?.hourly?.time) return false;
    const values = this.getHourlyArray(key);
    if (!Array.isArray(values)) return false;

    const currentDate = new Date().toISOString().split('T')[0];
    const timeArray = this.airQuality.hourly.time;
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
    if (!this.airQuality?.hourly?.time) return 0;

    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentHour = now.getHours(); // 0-23

    const timeArray = this.airQuality.hourly.time;
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

  private getHourlyMinMax(key: string): { min: number; max: number } {
    if (!this.airQuality?.hourly?.time) {
      return { min: 0, max: 0 };
    }

    const timeArray = this.airQuality.hourly.time;
    const valuesArray = this.getHourlyArray(key);
    if (!Array.isArray(valuesArray)) return { min: 0, max: 0 };

    const currentDate = new Date().toISOString().split('T')[0];
    const valuesToday = timeArray
      .map((t: string, i: number) => (t?.startsWith(currentDate) ? valuesArray[i] : undefined))
      .filter((v: number | null | undefined): v is number => typeof v === 'number');

    if (valuesToday.length === 0) return { min: 0, max: 0 };
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
    const dialogRef = this.dialog.open(AirQualityComponent, {
      data: { airQuality: this.airQuality, selectedKey },
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
    const hourly = this.airQuality?.hourly as Record<string, (number | null)[] | undefined> | undefined;
    return hourly?.[key];
  }
}
