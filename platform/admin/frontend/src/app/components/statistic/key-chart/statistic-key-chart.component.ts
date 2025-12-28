import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, effect, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Chart, ChartConfiguration, ChartType, Element, Plugin, registerables } from 'chart.js';
import { SeriesPoint } from '../../../interfaces/statistic-series-point.interface';

const valueLabelPlugin: Plugin = {
  id: 'valueLabel',
  afterDatasetsDraw(chart) {
    const chartType = ('type' in chart.config ? chart.config.type : undefined)
      ?? chart.config.data?.datasets?.[0]?.type;
    if (chartType !== 'bar') return;
    const { ctx } = chart;
    const dataset = chart.data.datasets[0];
    const data = Array.isArray(dataset?.data) ? dataset.data : [];
    const meta = chart.getDatasetMeta(0);
    if (!dataset || !meta?.data?.length) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '12px sans-serif';
    const paddingX = 6;
    const paddingY = 3;
    const radius = 4;
    const chartArea = chart.chartArea;

    const drawRoundedRect = (x: number, y: number, w: number, h: number) => {
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.lineTo(x + w - radius, y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
      ctx.lineTo(x + w, y + h - radius);
      ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
      ctx.lineTo(x + radius, y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
      ctx.lineTo(x, y + radius);
      ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    };

    meta.data.forEach((bar: Element, index: number) => {
      const value = data[index];
      if (value === null || value === undefined) return;
      const pos = bar.tooltipPosition(true);
      if (pos?.x == null || pos?.y == null) return;
      const props = bar.getProps(['x', 'y', 'base'], true) as unknown as {
        y?: number;
        base?: number;
      };
      const midY = Number.isFinite(props?.y) && Number.isFinite(props?.base)
        ? (Number(props!.y) + Number(props!.base)) / 2
        : pos.y;
      const label = String(value);
      const textWidth = ctx.measureText(label).width;
      const boxW = textWidth + paddingX * 2;
      const boxH = 12 + paddingY * 2;
      let boxX = pos.x - boxW / 2;
      let boxY = midY - boxH / 2;
      if (chartArea) {
        boxX = Math.min(Math.max(boxX, chartArea.left + 2), chartArea.right - boxW - 2);
        boxY = Math.min(Math.max(boxY, chartArea.top + 2), chartArea.bottom - boxH - 2);
      }
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      drawRoundedRect(boxX, boxY, boxW, boxH);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(label, boxX + boxW / 2, boxY + boxH / 2);
    });

    ctx.restore();
  }
};

Chart.register(...registerables, valueLabelPlugin);

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
    this.points();
    // defer until view is ready
    if (this.canvasRef) {
      this.render();
    }
  });

  // Re-render when style/type inputs change
  styleEffect = effect(() => {
    this.color();
    this.chartKind();
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
    const datasets = isLine
      ? [{
        label: this.title() || 'Series',
        data,
        borderColor: color,
        backgroundColor: `${color}33`,
        tension: 0.25,
        fill: true,
        pointRadius: 3
      }]
      : [{
        label: this.title() || 'Series',
        data,
        backgroundColor: `${color}cc`,
        borderColor: color
      }];

    const config: ChartConfiguration = {
      type: kind,
      data: {
        labels,
        datasets
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
