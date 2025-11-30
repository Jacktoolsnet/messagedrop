import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIcon } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { DateTime } from 'luxon';
import { Place } from '../../../interfaces/place';
import { TileSetting } from '../../../interfaces/tile-settings';
import { PlaceService } from '../../../services/place.service';
import { MigraineTileEditComponent } from './migraine-tile-edit/migraine-tile-edit.component';
import { MatDialog } from '@angular/material/dialog';
import { Weather } from '../../../interfaces/weather';

@Component({
  selector: 'app-migraine-tile',
  standalone: true,
  imports: [CommonModule, MatIcon, MatButtonModule],
  templateUrl: './migraine-tile.component.html',
  styleUrl: './migraine-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MigraineTileComponent implements OnChanges {
  @Input() tile!: TileSetting;
  @Input() place!: Place;

  private readonly dialog = inject(MatDialog);
  private readonly placeService = inject(PlaceService);
  private readonly cdr = inject(ChangeDetectorRef);

  readonly currentTile = signal<TileSetting | null>(null);

  ngOnChanges(): void {
    this.currentTile.set(this.tile);
  }

  get title(): string {
    const tile = this.currentTile();
    return tile?.payload?.title?.trim() || tile?.label || 'Migraine alert';
  }

  get icon(): string {
    return this.currentTile()?.payload?.icon || 'crisis_alert';
  }

  get weather(): Weather | undefined {
    return this.place.datasets.weatherDataset.data;
  }

  private thresholds() {
    const defaults = { tempWarn1: 5, tempWarn2: 8, pressureWarn1: 6, pressureWarn2: 10 };
    return { ...defaults, ...(this.currentTile()?.payload?.migraine || {}) };
  }

  private dailyRange(values: number[]): number {
    if (values.length === 0) return 0;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return Number((max - min).toFixed(1));
  }

  private todaysHourly(field: keyof Weather['hourly'][number]): number[] {
    if (!this.weather?.hourly || !this.weather.current?.time) return [];
    const currentDate = this.weather.current.time.split('T')[0];
    return this.weather.hourly
      .filter(h => h.time.startsWith(currentDate))
      .map(h => Number(h[field]))
      .filter(v => !Number.isNaN(v));
  }

  get tempChange(): { value: number; level: 'none' | 'warn' | 'alert' } {
    const temps = this.todaysHourly('temperature');
    const value = this.dailyRange(temps);
    const { tempWarn1, tempWarn2 } = this.thresholds();
    const level = value >= tempWarn2 ? 'alert' : value >= tempWarn1 ? 'warn' : 'none';
    return { value, level };
  }

  get pressureChange(): { value: number; level: 'none' | 'warn' | 'alert' } {
    const pressures = this.todaysHourly('pressure');
    const value = this.dailyRange(pressures);
    const { pressureWarn1, pressureWarn2 } = this.thresholds();
    const level = value >= pressureWarn2 ? 'alert' : value >= pressureWarn1 ? 'warn' : 'none';
    return { value, level };
  }

  get isStale(): boolean {
    return this.placeService.isDatasetExpired(this.place.datasets.weatherDataset, 60);
  }

  edit(): void {
    const tile = this.currentTile();
    if (!tile) return;
    const ref = this.dialog.open(MigraineTileEditComponent, {
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

  formatValue(val: number, unit: string): string {
    return `${val.toFixed(1)}${unit}`;
  }

}
