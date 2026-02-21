import { ChangeDetectionStrategy, Component, Input, inject, signal } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { Place } from '../../../interfaces/place';
import { TileSetting } from '../../../interfaces/tile-settings';
import { Weather } from '../../../interfaces/weather';
import { GeolocationService } from '../../../services/geolocation.service';
import { DatasetState, OpenMeteoRefreshService } from '../../../services/open-meteo-refresh.service';
import { PlaceService } from '../../../services/place.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { WeatherTile } from '../../weather/weather-tile.interface';
import { WeatherComponent } from '../../weather/weather.component';
import { MigraineTileEditComponent } from './migraine-tile-edit/migraine-tile-edit.component';

@Component({
  selector: 'app-migraine-tile',
  standalone: true,
  imports: [MatIcon, MatButtonModule, TranslocoPipe],
  templateUrl: './migraine-tile.component.html',
  styleUrl: './migraine-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MigraineTileComponent {
  private readonly placeSignal = signal<Place | null>(null);
  readonly selectedDayOffset = signal<0 | 1>(0);

  @Input() set place(value: Place) {
    this.placeSignal.set(value);
    this.selectedDayOffset.set(0);
    this.weatherState = this.refreshService.getWeatherState(value);
    this.refreshService.refreshWeather(value);
  }

  @Input() set tile(value: TileSetting) {
    this.currentTile.set(value);
  }

  private readonly dialog = inject(MatDialog);
  private readonly placeService = inject(PlaceService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly refreshService = inject(OpenMeteoRefreshService);
  private readonly translation = inject(TranslationHelperService);

  readonly currentTile = signal<TileSetting | null>(null);
  private weatherState?: DatasetState<Weather>;

  get title(): string {
    const tile = this.currentTile();
    const fallback = this.translation.t('common.tileTypes.migraine');
    return tile?.payload?.title?.trim() || tile?.label || fallback;
  }

  get icon(): string {
    return this.currentTile()?.payload?.icon || 'crisis_alert';
  }

  get weather(): Weather | undefined {
    return this.weatherState?.data() ?? undefined;
  }

  get isStale(): boolean {
    return this.weatherState?.isStale() ?? false;
  }

  get hasTomorrow(): boolean {
    return this.getDateByOffset(1) !== undefined;
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

  private getBaseDayIndex(): number {
    const weather = this.weather;
    const daily = weather?.daily ?? [];
    if (daily.length === 0) return -1;

    const currentDate = weather?.current?.time?.split('T')[0];
    const currentIndex = currentDate ? daily.findIndex((day) => day.date === currentDate) : -1;
    return currentIndex >= 0 ? currentIndex : 0;
  }

  private getDayIndexByOffset(offset: 0 | 1): number {
    const baseDayIndex = this.getBaseDayIndex();
    if (baseDayIndex < 0) return -1;
    return baseDayIndex + offset;
  }

  private getDateByOffset(offset: 0 | 1): string | undefined {
    const weather = this.weather;
    if (!weather?.daily?.length) return undefined;

    const dayIndex = this.getDayIndexByOffset(offset);
    if (dayIndex < 0 || dayIndex >= weather.daily.length) return undefined;
    return weather.daily[dayIndex]?.date;
  }

  private hourlyForSelectedDay(field: keyof Weather['hourly'][number]): number[] {
    const weather = this.weather;
    const selectedDate = this.getDateByOffset(this.selectedDayOffset());
    if (!weather?.hourly || !selectedDate) return [];

    return weather.hourly
      .filter(h => h.time.startsWith(selectedDate))
      .map(h => Number(h[field]))
      .filter(v => !Number.isNaN(v));
  }

  get tempChange(): { value: number; level: 'none' | 'warn' | 'alert' } {
    const temps = this.hourlyForSelectedDay('temperature');
    const value = this.dailyRange(temps);
    const { tempWarn1, tempWarn2 } = this.thresholds();
    const level = value >= tempWarn2 ? 'alert' : value >= tempWarn1 ? 'warn' : 'none';
    return { value, level };
  }

  get pressureChange(): { value: number; level: 'none' | 'warn' | 'alert' } {
    const pressures = this.hourlyForSelectedDay('pressure');
    const value = this.dailyRange(pressures);
    const { pressureWarn1, pressureWarn2 } = this.thresholds();
    const level = value >= pressureWarn2 ? 'alert' : value >= pressureWarn1 ? 'warn' : 'none';
    return { value, level };
  }

  onDayChange(offset: 0 | 1): void {
    if (offset === 1 && !this.hasTomorrow) {
      return;
    }
    this.selectedDayOffset.set(offset);
  }

  edit(): void {
    const tile = this.currentTile();
    if (!tile) return;
    const ref = this.dialog.open(MigraineTileEditComponent, {
      width: '520px',
      data: {
        tile,
        onTileCommit: (updated: TileSetting) => this.applyTileUpdate(updated)
      },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
    });
    ref.afterClosed().subscribe((updated?: TileSetting) => {
      if (!updated) return;
      this.applyTileUpdate(updated);
    });
  }

  formatValue(val: number, unit: string): string {
    return `${val.toFixed(1)}${unit}`;
  }

  openWeatherDetails(tileType: 'temperature' | 'pressure'): void {
    const place = this.placeSignal();
    if (!place?.boundingBox) return;

    const selectedDayIndex = this.getDayIndexByOffset(this.selectedDayOffset());
    const dialogRef = this.dialog.open(WeatherComponent, {
      data: {
        weather: this.weather,
        location: this.geolocationService.getCenterOfBoundingBox(place.boundingBox),
        place: place
      },
      closeOnNavigation: true,
      minWidth: '90vw',
      width: '90vw',
      maxWidth: '90vw',
      minHeight: '90vh',
      height: '90vh',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(() => {
      const comp = dialogRef.componentInstance as WeatherComponent | undefined;
      if (selectedDayIndex >= 0) {
        comp?.onDayChange(selectedDayIndex);
      }
      const placeholder: WeatherTile = {
        type: tileType,
        label: '',
        icon: '',
        value: '',
        levelText: '',
        color: '',
        minMax: { min: 0, max: 0 }
      };
      comp?.onTileClick(placeholder);
    });
  }

  private applyTileUpdate(updated: TileSetting): void {
    const place = this.placeSignal();
    if (!place) return;
    const tiles = (place.tileSettings ?? []).map(t => t.id === updated.id ? { ...t, ...updated } : t);
    const updatedPlace = { ...place, tileSettings: tiles };
    this.placeSignal.set(updatedPlace);
    this.currentTile.set(updated);
    this.placeService.saveAdditionalPlaceInfos(updatedPlace);
  }
}
