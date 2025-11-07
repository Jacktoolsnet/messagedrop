import { CommonModule } from '@angular/common';
import { HttpResponse } from '@angular/common/http';
import { AfterViewInit, Component, DestroyRef, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule } from '@angular/material/table';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { RouterLink } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';

import { TransparencyReport } from '../../../interfaces/transparency-report.interface';
import { TransparencyStats } from '../../../interfaces/transparency-stats.interface';
import { DsaService } from '../../../services/dsa/dsa/dsa.service';

Chart.register(...registerables, annotationPlugin);

interface RangeOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-dsa-transparency',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTableModule,
    MatTooltipModule,
    MatMenuModule,
    MatDividerModule
  ],
  templateUrl: './transparency.component.html',
  styleUrl: './transparency.component.css'
})
export class TransparencyComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly dsa = inject(DsaService);
  private readonly snack = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('statusChart') private statusChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('decisionChart') private decisionChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('trendChart') private trendChartRef?: ElementRef<HTMLCanvasElement>;

  readonly rangeOptions: RangeOption[] = [
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '365d', label: 'Last 12 months' },
    { value: 'all', label: 'All time' }
  ];

  readonly filterForm = this.fb.nonNullable.group({
    range: ['90d']
  });

  readonly stats = signal<TransparencyStats | null>(null);
  readonly reports = signal<TransparencyReport[]>([]);
  readonly loadingStats = signal(false);
  readonly loadingReports = signal(false);

  readonly reportColumns = ['title', 'period', 'format', 'generatedAt', 'actions'];

  private charts: Chart[] = [];
  private viewReady = false;
  private lastStats: TransparencyStats | null = null;

  ngOnInit(): void {
    const initialRange = this.filterForm.controls.range.value;
    this.loadStats(initialRange);
    this.loadReports(initialRange);
  }

  onRangeChange(event: MatChipListboxChange): void {
    const range = event.value;
    if (!range) return;
    this.filterForm.controls.range.setValue(range, { emitEvent: false });
    this.loadStats(range);
    this.loadReports(range);
  }

  setRange(range: string): void {
    if (!range) return;
    this.filterForm.controls.range.setValue(range, { emitEvent: false });
    this.loadStats(range);
    this.loadReports(range);
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (this.lastStats) {
      setTimeout(() => {
        if (this.lastStats) {
          this.renderCharts(this.lastStats);
        }
      });
    }
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  private loadStats(range: string): void {
    this.loadingStats.set(true);
    this.dsa.getTransparencyStats(range).subscribe({
      next: (data) => {
        this.stats.set(data);
        this.lastStats = data;
        this.loadingStats.set(false);
        if (this.viewReady) {
          setTimeout(() => {
            if (this.viewReady) {
              this.renderCharts(data);
            }
          });
        }
      },
      error: () => {
        this.loadingStats.set(false);
      }
    });
  }

  private loadReports(range: string): void {
    this.loadingReports.set(true);
    this.dsa.listTransparencyReports(range).subscribe({
      next: (rows) => {
        this.reports.set(rows ?? []);
        this.loadingReports.set(false);
      },
      error: () => {
        this.loadingReports.set(false);
      }
    });
  }

  private renderCharts(data: TransparencyStats): void {
    if (!this.statusChartRef || !this.decisionChartRef || !this.trendChartRef) return;
    this.destroyCharts();

    const statusCtx = this.statusChartRef.nativeElement.getContext('2d');
    const decisionCtx = this.decisionChartRef.nativeElement.getContext('2d');
    const trendCtx = this.trendChartRef.nativeElement.getContext('2d');
    if (!statusCtx || !decisionCtx || !trendCtx) return;

    const statusEntries = Object.entries(data.notices.byStatus);
    const statusConfig: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: statusEntries.map(([status]) => status),
        datasets: [{
          label: 'Notices',
          data: statusEntries.map(([, count]) => count),
          backgroundColor: '#05a51dbd'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    };

    const decisionEntries = Object.entries(data.decisions.byOutcome || {});
    const decisionConfig: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: decisionEntries.map(([outcome]) => outcome),
        datasets: [{
          label: 'Decisions',
          data: decisionEntries.map(([, count]) => count),
          backgroundColor: ['#4ade80', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa', '#f472b6']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    };

    const trendLabels = data.trend.map(item => item.month);
    const trendConfig: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        labels: trendLabels,
        datasets: [
          {
            label: 'Notices',
            data: data.trend.map(item => item.notices),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.3)',
            tension: 0.25,
            fill: true,
            pointRadius: 4
          },
          {
            label: 'Decisions',
            data: data.trend.map(item => item.decisions),
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.25)',
            tension: 0.25,
            fill: true,
            pointRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    };

    this.charts.push(
      new Chart(statusCtx, statusConfig),
      new Chart(decisionCtx, decisionConfig),
      new Chart(trendCtx, trendConfig)
    );
  }

  private destroyCharts(): void {
    this.charts.forEach(chart => chart.destroy());
    this.charts = [];
  }

  formatDuration(ms: number): string {
    if (!Number.isFinite(ms) || ms <= 0) return 'n/a';
    const totalHours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (parts.length === 0) parts.push('<1h');
    return parts.join(' ');
  }

  formatDate(ts: number | null | undefined): string {
    if (!ts) return 'n/a';
    return new Date(ts).toLocaleDateString();
  }

  formatDateTime(ts: number | null | undefined): string {
    if (!ts) return 'n/a';
    return new Date(ts).toLocaleString();
  }

  downloadReport(report: TransparencyReport): void {
    this.dsa.downloadTransparencyReport(report.id).subscribe({
      next: (response) => {
        const blob = response.body;
        if (!blob) {
          this.snack.open('Empty report received.', 'OK', { duration: 2500 });
          return;
        }
        const filename = this.resolveFilename(response, `transparency-${report.id}.csv`);
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.snack.open('Could not download report.', 'OK', { duration: 3000 });
      }
    });
  }

  private resolveFilename(response: HttpResponse<Blob>, fallback: string): string {
    const disposition = response.headers.get('Content-Disposition');
    if (!disposition) return fallback;
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(disposition);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1].replace(/"/g, ''));
      } catch {
        return match[1].replace(/"/g, '');
      }
    }
    return fallback;
  }

  labelForType(type: string): string {
    switch ((type || '').toUpperCase()) {
      case 'RECEIVED': return 'Received';
      case 'UNDER_REVIEW': return 'Under review';
      case 'DECIDED': return 'Decided';
      default: return type;
    }
  }

  labelForOutcome(outcome: string): string {
    const key = (outcome || '').toUpperCase();
    switch (key) {
      case 'REMOVE_CONTENT':
      case 'REMOVE':
        return 'Removed';
      case 'RESTRICT':
        return 'Restricted';
      case 'NO_ACTION':
        return 'No action';
      case 'FORWARD_TO_AUTHORITY':
        return 'Escalated';
      default:
        return outcome;
    }
  }

  automatedShare(stats: TransparencyStats | null): string {
    if (!stats) return 'n/a';
    const auto = stats.decisions.automated.automated;
    const total = stats.decisions.total || 1;
    const ratio = (auto / total) * 100;
    return `${auto} decisions (${ratio.toFixed(1)}%)`;
  }

  toEntries(record: Record<string, number> | null | undefined) {
    if (!record) return [];
    return Object.entries(record).map(([key, value]) => ({ key, value }));
  }
}
