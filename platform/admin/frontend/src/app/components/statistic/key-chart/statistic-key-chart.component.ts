import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, effect, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Chart, ChartConfiguration, ChartType, registerables } from 'chart.js';
import { SeriesPoint } from '../../../interfaces/statistic-series-point.interface';

Chart.register(...registerables);

@Component({
  selector: 'app-statistic-key-chart',
  standalone: true,
  imports: [MatCardModule, MatIconModule],
  templateUrl: './statistic-key-chart.component.html',
  styleUrls: ['./statistic-key-chart.component.css']
})
export class StatisticKeyChartComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') private canvasRef?: ElementRef<HTMLCanvasElement>;
  private chart?: Chart;

  readonly title = input<string>('');
  readonly points = input<SeriesPoint[] | null>(null);
  readonly chartKind = input<Exclude<ChartType, 'radar' | 'polarArea' | 'scatter' | 'bubble'>>('line');
  readonly color = input<string>('#2563eb');
  readonly iconName = input<string>('insights');
  readonly tall = input<boolean>(false);

  ngAfterViewInit(): void {
    this.render();
  }

  ngOnDestroy(): void {
    this.destroy();
  }

  // Re-render when input points change
  pointsEffect = effect(() => {
    const _ = this.points();
    // defer until view is ready
    if (this.canvasRef) {
      this.render();
    }
  });

  private render(): void {
    if (!this.canvasRef) return;
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    const pts = this.points() ?? [];
    const labels = pts.map(p => p.date);
    const data = pts.map(p => p.value);

    const kind = this.chartKind();
    const color = this.color();
    const isLine = kind === 'line';
    const config: ChartConfiguration = {
      type: kind,
      data: {
        labels,
        datasets: [
          isLine ? {
            label: this.title() || 'Series',
            data,
            borderColor: color,
            backgroundColor: color + '33',
            tension: 0.25,
            fill: true,
            pointRadius: 3
          } : {
            label: this.title() || 'Series',
            data,
            backgroundColor: color + 'cc',
            borderColor: color
          }
        ] as any
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    };

    this.destroy();
    this.chart = new Chart(ctx, config);
  }

  private destroy(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = undefined;
    }
  }
}
