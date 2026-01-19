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
  @Input() set place(value: Place) {
    this.placeSignal.set(value);
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

  edit(): void {
    const tile = this.currentTile();
    if (!tile) return;
    const ref = this.dialog.open(MigraineTileEditComponent, {
      width: '520px',
      data: { tile }
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

  formatValue(val: number, unit: string): string {
    return `${val.toFixed(1)}${unit}`;
  }

  openWeatherDetails(tileType: 'temperature' | 'pressure'): void {
    const place = this.placeSignal();
    if (!place?.boundingBox) return;
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
      hasBackdrop: false,
      autoFocus: false
    });

    dialogRef.afterOpened().subscribe(() => {
      const comp = dialogRef.componentInstance as WeatherComponent | undefined;
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
}
