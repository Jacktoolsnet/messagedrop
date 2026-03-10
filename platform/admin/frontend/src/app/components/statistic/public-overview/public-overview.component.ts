import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { MultiSeriesResponse } from '../../../interfaces/statistic-multi-series-response.interface';
import { SeriesPoint } from '../../../interfaces/statistic-series-point.interface';
import { AuthService } from '../../../services/auth/auth.service';
import { StatisticService } from '../../../services/statistic/statistic.service';
import { StatisticKeyChartComponent } from '../key-chart/statistic-key-chart.component';

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

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly overview = signal<MultiSeriesResponse | null>(null);
  readonly backLink = computed(() => this.auth.isLoggedIn() ? '/dashboard/statistic' : '/');
  readonly totalEvents = computed(() =>
    this.metrics.reduce((sum, metric) => sum + this.totalFor(metric.key), 0)
  );
  readonly peakValue = computed(() =>
    this.metrics.reduce((max, metric) => Math.max(max, this.maxFor(metric.key)), 0)
  );

  readonly metrics: PublicMetricTile[] = [
    { key: 'client.connect', title: 'Page views', icon: 'visibility', color: '#2563eb' },
    { key: 'message.create', title: 'New messages', icon: 'chat', color: '#16a34a' },
    { key: 'message.search', title: 'Search requests', icon: 'search', color: '#ea580c' },
    { key: 'user.create', title: 'New users', icon: 'person_add', color: '#7c3aed' }
  ];

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.statistics.getPublicOverview7d().subscribe({
      next: (data) => {
        this.overview.set(data);
      },
      error: () => {
        this.error.set('Could not load public statistics.');
      },
      complete: () => {
        this.loading.set(false);
      }
    });
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
