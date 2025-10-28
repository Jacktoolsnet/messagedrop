import { Component, computed, effect, inject, signal } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { RouterLink } from '@angular/router';
import { StatisticService } from '../../services/statistic/statistic.service';
import { StatisticRangePreset } from '../../interfaces/statistic-range-preset.type';
import { MultiSeriesResponse } from '../../interfaces/statistic-multi-series-response.interface';
import { StatisticKeyChartComponent } from './key-chart/statistic-key-chart.component';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { StatisticSettingsComponent } from './settings/statistic-settings.component';
import { StatisticSettingsService } from '../../services/statistic/statistic-settings.service';
import { StatisticKeySetting } from '../../interfaces/statistic-key-setting.interface';
import { SeriesPoint } from '../../interfaces/statistic-series-point.interface';

@Component({
  selector: 'app-statistic',
  standalone: true,
  imports: [
    RouterLink,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatButtonToggleModule,
    StatisticKeyChartComponent,
    MatDialogModule
  ],
  templateUrl: './statistic.component.html',
  styleUrls: ['./statistic.component.css']
})

export class StatisticComponent {
  private readonly dialog = inject(MatDialog);
  private readonly settingsApi = inject(StatisticSettingsService);
  private readonly stat = inject(StatisticService);

  readonly ranges = [
    { value: '12m', label: 'Last year' },
    { value: '6m', label: 'Last six months' },
    { value: '3m', label: 'Last quarter' },
    { value: '1m', label: 'Last month' },
    { value: '1w', label: 'Week' },
    { value: '1d', label: 'Today' },
  ] as const;

  readonly selectedRange = signal<'12m' | '6m' | '3m' | '1m' | '1w' | '1d'>('1w');
  readonly keys = signal<string[]>([]);
  readonly loading = signal<boolean>(false);
  readonly hasKeys = computed(() => this.keys().length > 0);
  readonly lastSeries = signal<MultiSeriesResponse | null>(null);
  readonly settings = signal<Record<string, StatisticKeySetting>>({});
  readonly selectedKey = signal<string | null>(null);

  private readonly palette = [
    '#2563eb', // blue
    '#22c55e', // green
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#e11d48', // rose
    '#0ea5e9', // sky
    '#84cc16', // lime
    '#f97316'  // orange
  ];

  constructor() {
    // initial load
    this.loadKeys();
    // auto reload when range changes and we have keys
    effect(() => {
      const _r = this.selectedRange();
      const ks = this.keys();
      if (ks.length) this.loadSeries(ks, _r);
    });

    // load settings initially and provide a refresh fn
    const loadSettings = () => this.settingsApi.list().subscribe({
      next: (res) => {
        const map: Record<string, StatisticKeySetting> = {};
        (res?.settings ?? []).forEach(s => { map[s.metricKey] = s; });
        this.settings.set(map);
      }
    });
    loadSettings();
  }

  openSettings(): void {
    const ref = this.dialog.open(StatisticSettingsComponent, {
      width: '1200px',
      maxWidth: '98vw',
      maxHeight: '95vh'
    });
    ref.afterClosed().subscribe(changed => {
      if (changed) {
        // Reload settings, then refresh series to force chart re-rendering
        this.settingsApi.list().subscribe({
          next: (res) => {
            const map: Record<string, StatisticKeySetting> = {};
            (res?.settings ?? []).forEach(s => { map[s.metricKey] = s; });
            this.settings.set(map);
            this.reload();
          }
        });
      }
    });
  }

  onRangeChange(v: string | null): void {
    if (!v) return;
    if (this.selectedRange() === v) return;
    this.selectedRange.set(v as any);
  }

  reload(): void {
    const ks = this.keys();
    if (ks.length) this.loadSeries(ks, this.selectedRange());
  }

  colorFor(key: string): string {
    // settings override
    const cfg = this.settings()[key];
    if (cfg?.color) return cfg.color;
    // stable hash -> palette index
    let h = 5381;
    for (let i = 0; i < key.length; i++) {
      h = ((h << 5) + h) + key.charCodeAt(i); // djb2
      h |= 0; // 32-bit
    }
    const idx = Math.abs(h) % this.palette.length;
    return this.palette[idx];
  }

  titleFor(key: string): string { return this.settings()[key]?.displayName?.trim() || key; }
  iconFor(key: string): string { return this.settings()[key]?.iconName?.trim() || 'insights'; }
  orderedKeys(): string[] {
    const ks = this.keys();
    const map = this.settings();
    const withOrder = ks.map(k => ({ k, o: map[k]?.sortOrder ?? Number.MAX_SAFE_INTEGER }));
    withOrder.sort((a, b) => a.o - b.o || a.k.localeCompare(b.k));
    return withOrder.map(x => x.k);
  }

  selectKey(key: string): void {
    this.selectedKey.set(key);
  }

  clearSelection(): void {
    this.selectedKey.set(null);
  }

  private aggregatePoints(points: SeriesPoint[], preset: '12m'|'6m'|'3m'|'1m'|'1w'|'1d'): SeriesPoint[] {
    if (!points || points.length === 0) return [];
    if (preset === '12m' || preset === '6m' || preset === '3m') {
      // group by month YYYY-MM
      const map = new Map<string, number>();
      for (const p of points) {
        const key = (p.date || '').slice(0, 7); // YYYY-MM
        map.set(key, (map.get(key) || 0) + (p.value || 0));
      }
      const labels = Array.from(map.keys()).sort();
      return labels.map(d => ({ date: d, value: map.get(d) || 0 }));
    }
    if (preset === '1m') {
      // group by ISO week: YYYY-Www
      const weekKey = (s: string) => {
        const d = new Date(s + 'T00:00:00Z');
        // ISO week calculation
        const day = d.getUTCDay() || 7; // 1..7, Mon=1
        d.setUTCDate(d.getUTCDate() + 4 - day);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const week = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        const ww = String(week).padStart(2, '0');
        return `${d.getUTCFullYear()}-W${ww}`;
      };
      const map = new Map<string, number>();
      for (const p of points) {
        const key = weekKey(p.date);
        map.set(key, (map.get(key) || 0) + (p.value || 0));
      }
      const labels = Array.from(map.keys()).sort();
      return labels.map(d => ({ date: d, value: map.get(d) || 0 }));
    }
    // default: return as-is (daily)
    return points;
  }

  getPointsFor(key: string): SeriesPoint[] {
    const raw = this.lastSeries()?.series?.[key]?.points ?? [];
    return this.aggregatePoints(raw as SeriesPoint[], this.selectedRange());
  }

  private loadKeys(): void {
    this.loading.set(true);
    this.stat.getKeys().subscribe({
      next: (res) => {
        const list = res?.keys ?? [];
        this.keys.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.keys.set([]);
        this.loading.set(false);
      }
    });
  }

  private loadSeries(keys: string[], preset: StatisticRangePreset): void {
    this.loading.set(true);
    this.stat.getSeriesForKeys(keys, preset).subscribe({
      next: (res) => {
        this.lastSeries.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }
}
