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
    StatisticKeyChartComponent
  ],
  templateUrl: './statistic.component.html',
  styleUrls: ['./statistic.component.css']
})

export class StatisticComponent {
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

  constructor() {
    // initial load
    this.loadKeys();
    // auto reload when range changes and we have keys
    effect(() => {
      const _r = this.selectedRange();
      const ks = this.keys();
      if (ks.length) this.loadSeries(ks, _r);
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
