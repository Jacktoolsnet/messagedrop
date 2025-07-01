import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { AirQualityData } from '../../../interfaces/air-quality-data';
import { Location } from '../../../interfaces/location';
import { Place } from '../../../interfaces/place';
import { AirQualityService } from '../../../services/air-quality.service';
import { GeolocationService } from '../../../services/geolocation.service';
import { UserService } from '../../../services/user.service';
import { AirQualityComponent } from '../../air-quality/air-quality.component';

@Component({
  selector: 'app-air-quality-tile',
  imports: [
    CommonModule,
    MatIcon
  ],
  templateUrl: './air-quality-tile.component.html',
  styleUrl: './air-quality-tile.component.css'
})
export class AirQualityTileComponent implements OnInit, OnDestroy {
  @Input() place!: Place;

  airQuality: AirQualityData | undefined;
  airQualityIcon: string | undefined;
  minMax: { min: number, max: number } | undefined;
  label: string = "";
  value: number = 0;
  level: string = '';

  // Define the possible keys for the hourly property
  private readonly pollenKeys = [
    'alder_pollen',
    'birch_pollen',
    'grass_pollen',
    'mugwort_pollen',
    'olive_pollen',
    'ragweed_pollen'
  ] as const;

  public constructor(
    private userService: UserService,
    private airQualityService: AirQualityService,
    private geolocationService: GeolocationService,
    private dialog: MatDialog,
  ) { }

  ngOnInit(): void {
    this.getAirQuality();
  }

  ngOnDestroy(): void { }

  private getAirQuality() {
    if (this.place.boundingBox) {
      let location: Location = this.geolocationService.getCenterOfBoundingBox(this.place.boundingBox)
      this.airQualityService
        .getAirQuality(
          location.plusCode,
          location.latitude,
          location.longitude,
          3
        )
        .subscribe({
          next: (airQuality) => {
            this.airQuality = airQuality;

            const getDominantPollenType = this.getDominantPollenType();
            this.label = this.getChartLabel(getDominantPollenType);
            this.value = this.getHourlyValue(getDominantPollenType)
            this.level = this.getLevelTextForCategoryValue(this.value)
            this.airQualityIcon = this.getAirQualityIcon(getDominantPollenType);
            this.minMax = this.getHourlyMinMax(getDominantPollenType);
          },
          error: (err) => { }
        });
    }
  }

  private getAirQualityIcon(key: string): string {
    const map: Record<string, string> = {
      alder_pollen: 'nature',
      birch_pollen: 'park',
      grass_pollen: 'grass',
      mugwort_pollen: 'spa',
      olive_pollen: 'eco',
      ragweed_pollen: 'local_florist'
    };
    return map[key] || 'help_outline';
  }

  private getLevelTextForCategoryValue(value: number): string {
    if (value === 0) return 'none';
    if (value <= 10) return 'low';
    if (value <= 30) return 'moderate';
    if (value <= 50) return 'high';
    return 'Very High';
  }

  private getDominantPollenType(): string {
    if (!this.airQuality || !this.airQuality.hourly?.time) return '';
    const timeArray = this.airQuality.hourly.time;
    const currentDate = new Date().toISOString().split('T')[0];

    let maxValue = -Infinity;
    let dominantKey = '';

    for (const key of this.pollenKeys) {
      const valuesArray = (this.airQuality.hourly as any)[key] as number[] | undefined;
      if (!valuesArray || !Array.isArray(valuesArray)) continue;

      const valuesForToday = timeArray
        .map((t: string, i: number) => t.startsWith(currentDate) ? valuesArray[i] : undefined)
        .filter((v: number | undefined): v is number => typeof v === 'number');

      const localMax = valuesForToday.length > 0 ? Math.max(...valuesForToday) : -Infinity;

      if (localMax > maxValue) {
        maxValue = localMax;
        dominantKey = key;
      }
    }
    return dominantKey;
  }

  private getHourlyValue(key: string): number {
    if (
      !this.airQuality ||
      !this.airQuality.hourly?.time ||
      !(key in this.airQuality.hourly)
    ) {
      return 0;
    }

    const now = new Date();
    const currentDate = now.toISOString().split('T')[0];
    const currentHour = now.getHours(); // 0–23

    const timeArray = this.airQuality.hourly.time;
    const baseIndex = timeArray.findIndex(t => t.startsWith(currentDate + 'T00:00'));

    if (baseIndex === -1) return 0;

    const hourIndex = baseIndex + currentHour;

    const valueArray = (this.airQuality.hourly as any)[key] as number[];
    const value = valueArray?.[hourIndex] ?? 0;

    return typeof value === 'number' ? value : 0;
  }

  private getHourlyMinMax(key: string): { min: number, max: number } {
    if (
      !this.airQuality ||
      !this.airQuality.hourly?.time ||
      !(key in this.airQuality.hourly)
    ) {
      return { min: 0, max: 0 };
    }
    const timeArray = this.airQuality.hourly.time;
    const valuesArray = (this.airQuality.hourly as any)[key] as number[];

    const currentDate = new Date().toISOString().split('T')[0];

    const valuesForToday = timeArray
      .map((t: string, i: number) => t.startsWith(currentDate) ? valuesArray[i] : undefined)
      .filter((v: number | undefined): v is number => typeof v === 'number');

    if (valuesForToday.length === 0) return { min: 0, max: 0 };

    return {
      min: Math.min(...valuesForToday),
      max: Math.max(...valuesForToday)
    };
  }

  public openAirQualityDetails(): void {
    const dialogRef = this.dialog.open(AirQualityComponent, {
      data: { airQuality: this.airQuality },
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
    dialogRef.afterOpened().subscribe();
    dialogRef.afterClosed().subscribe();
  }

  getChartLabel(key: string): string {
    const map: Record<string, string> = {
      alder_pollen: 'Alder Pollen',
      birch_pollen: 'Birch Pollen',
      grass_pollen: 'Grass Pollen',
      mugwort_pollen: 'Mugwort Pollen',
      olive_pollen: 'Olive Pollen',
      ragweed_pollen: 'Ragweed Pollen'
    };
    return map[key] || key;
  }
}

