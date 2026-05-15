import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { RouterLink } from '@angular/router';
import { MultiSeriesResponse } from '../../../interfaces/statistic-multi-series-response.interface';
import { SeriesPoint } from '../../../interfaces/statistic-series-point.interface';
import { AuthService } from '../../../services/auth/auth.service';
import { StatisticService } from '../../../services/statistic/statistic.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { StatisticKeyChartComponent } from '../key-chart/statistic-key-chart.component';

type PublicStatisticRange = 1 | 7;

interface PublicMetricTile {
  key: string;
  title: string;
  icon: string;
  color: string;
}

@Component({
  selector: 'app-public-overview',
  standalone: true,
  imports: [
    RouterLink,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatProgressBarModule,
    MatCardModule,
    StatisticKeyChartComponent
  ],
  templateUrl: './public-overview.component.html',
  styleUrls: ['./public-overview.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PublicOverviewComponent implements OnInit {
  private readonly statistics = inject(StatisticService);
  private readonly auth = inject(AuthService);
  readonly i18n = inject(TranslationHelperService);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly overview = signal<MultiSeriesResponse | null>(null);
  readonly selectedDays = signal<PublicStatisticRange>(1);
  readonly backLink = computed(() => this.auth.isLoggedIn() ? '/dashboard/statistic' : '/');
  readonly chartKind = computed(() => this.selectedDays() === 1 ? 'bar' : 'line');
  readonly totalLabel = computed(() => this.selectedDays() === 1 ? this.i18n.t('Total today:') : this.i18n.t('Total (7 days):'));
  readonly peakLabel = computed(() => this.selectedDays() === 1 ? this.i18n.t('Peak today:') : this.i18n.t('Peak/day:'));

  readonly metrics: PublicMetricTile[] = [
    { key: 'client.connect', title: this.i18n.t('Page views'), icon: 'visibility', color: '#2563eb' },
    { key: 'message.create', title: this.i18n.t('New messages'), icon: 'chat', color: '#16a34a' },
    { key: 'message.search', title: this.i18n.t('Search requests'), icon: 'search', color: '#ea580c' },
    { key: 'user.create', title: this.i18n.t('New users'), icon: 'person_add', color: '#7c3aed' }
  ];

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.statistics.getPublicOverview(this.selectedDays()).subscribe({
      next: (data) => {
        this.overview.set(data);
      },
      error: () => {
        this.error.set(this.i18n.t('Could not load public statistics.'));
      },
      complete: () => {
        this.loading.set(false);
      }
    });
  }

  setRange(days: PublicStatisticRange): void {
    if (this.selectedDays() === days) return;
    this.selectedDays.set(days);
    this.reload();
  }

  onRangeChange(days: PublicStatisticRange | null): void {
    if (!days) return;
    this.setRange(days);
  }

  pointsFor(key: string): SeriesPoint[] {
    return this.overview()?.series?.[key]?.points ?? [];
  }

  totalFor(key: string): number {
    return this.overview()?.series?.[key]?.total ?? 0;
  }

  maxFor(key: string): number {
    return this.overview()?.series?.[key]?.max ?? 0;
  }
}
