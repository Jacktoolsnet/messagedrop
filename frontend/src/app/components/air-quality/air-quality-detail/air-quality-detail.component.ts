
import { AfterViewInit, Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { CategoryScale, Chart, ChartConfiguration, ChartType, Filler, LinearScale, LineController, LineElement, PointElement, ScriptableContext, Title, Tooltip } from 'chart.js';
import annotationPlugin, { AnnotationOptions, ScaleValue as AnnotationScaleValue } from 'chartjs-plugin-annotation';
import { AirQualityTileValue } from '../../../interfaces/air-quality-tile-value';

@Component({
  selector: 'app-air-quality-detail',
  standalone: true,
  imports: [
    MatDialogModule
],
  templateUrl: './air-quality-detail.component.html',
  styleUrl: './air-quality-detail.component.css'
})

export class AirQualityDetailComponent implements OnChanges, AfterViewInit {
  @Input() tile: AirQualityTileValue | null = null;
  @Input() selectedDayIndex = 0;
  @Input() selectedHour = 0;
  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  private chart: Chart | null = null;

  lineChartType: ChartType = 'line';
  chartOptions: ChartConfiguration['options'] = {};
  chartData: ChartConfiguration['data'] = { labels: [], datasets: [] };

  constructor() {
    Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Title, Tooltip, LineController, annotationPlugin);
  }

  ngAfterViewInit(): void {
    if (!this.chartCanvas?.nativeElement) {
      return;
    }

    this.chart = new Chart(this.chartCanvas.nativeElement, {
      type: this.lineChartType,
      data: this.chartData,
      options: this.chartOptions
    });

    this.updateChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedDayIndex'] && !changes['selectedDayIndex'].firstChange) {
      this.updateChart();
    }

    if (changes['selectedHour'] && !changes['selectedHour'].firstChange) {
      this.moveSelectedHourAnnotation();
    }

    if (changes['tile'] && changes['tile'].currentValue) {
      this.updateChart();
    }
  }

  updateChart(): void {
    if (!this.tile?.values || !this.tile?.time) {
      return;
    }

    const tile = this.tile;
    const start = this.selectedDayIndex * 24;
    const end = start + 24;
    const dayValues = tile.values.slice(start, end);
    const dayLabels = tile.time.slice(start, end).map((t: string) => t.slice(11));

    const globalMin = Math.min(...tile.values);
    const globalMax = Math.max(...tile.values);

    this.chartData = {
      labels: dayLabels,
      datasets: [{
        label: tile.label,
        data: dayValues,
        borderColor: tile.color,
        backgroundColor: (ctx: ScriptableContext<'line'>) => {
          const currentChart = ctx.chart;
          const gradientHeight = currentChart.height ?? currentChart.canvas.height ?? 0;
          const gradient = currentChart.ctx.createLinearGradient(0, 0, 0, gradientHeight);
          gradient.addColorStop(0, tile.color);
          gradient.addColorStop(1, 'rgba(255,255,255,0.1)');
          return gradient;
        },
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: tile.color,
        tension: 0.3
      }]
    };

    const hour = this.selectedHour;
    const hourLabel = (dayLabels[hour] ?? `${hour}:00`).toString();
    const hourLabelScale: AnnotationScaleValue = hourLabel;
    const value = dayValues[hour] ?? 0;
    const annotationLabel = `${hourLabel}: ${value}${tile.unit}`;

    const isDark = document.body.classList.contains('dark');
    const textColor = isDark ? '#ffffff' : '#000000';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.formattedValue} ${tile.unit}`,
            title: ctx => this.getTimeLabel(ctx[0].dataIndex)
          }
        },
        legend: { display: false },
        title: {
          display: true,
          text: tile.label,
          color: textColor,
          font: {
            size: 18,
            weight: 'bold'
          },
          padding: {
            top: 10,
            bottom: 20
          }
        },
        annotation: {
          annotations: {
            selectedHour: {
              type: 'line',
              xMin: hourLabelScale,
              xMax: hourLabelScale,
              yMin: value,
              yMax: value + 0.01,
              borderColor: tile.color,
              borderWidth: 3,
              label: {
                display: true,
                content: annotationLabel,
                backgroundColor: tile.color,
                color: '#000000',
                position: 'start'
              }
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Time',
            color: textColor,
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            color: textColor,
            maxRotation: 45,
            minRotation: 45
          },
          grid: {
            color: gridColor
          }
        },
        y: {
          beginAtZero: true,
          min: globalMin,
          max: globalMax,
          title: {
            display: true,
            text: tile.unit,
            color: textColor,
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            color: textColor
          },
          grid: {
            color: gridColor
          }
        }
      }
    };

    const chart = this.chart;
    if (!chart) {
      return;
    }

    chart.data = this.chartData;
    chart.options = this.chartOptions;
    chart.update();

  }

  getTimeLabel(hour: number): string {
    const label = this.tile?.time?.[this.selectedDayIndex * 24 + hour];
    return label?.slice(11) ?? `${hour}:00`;
  }

  getValueLabel(hour: number): string {
    const value = this.tile?.values?.[this.selectedDayIndex * 24 + hour];
    return value != null && this.tile ? `${value} ${this.tile.unit}` : '–';
  }

  moveSelectedHourAnnotation(): void {
    if (!this.chart || !this.tile) {
      return;
    }

    const chart = this.chart;
    const tile = this.tile;
    const hour = this.selectedHour;
    const labels = Array.isArray(this.chartData.labels) ? this.chartData.labels : [];
    const labelValue = labels?.[hour];
    const hourLabel = (typeof labelValue === 'string' ? labelValue : `${hour}:00`).toString();
    const rawValue = this.chartData.datasets?.[0]?.data?.[hour];
    const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0);
    const labelText = `${hourLabel}: ${numericValue}${tile.unit}`;

    const annotations = this.ensureAnnotationConfig();
    const annotationKey = 'selectedHour';
    const hourLabelScale: AnnotationScaleValue = hourLabel;
    const existing = annotations[annotationKey];

    if (!existing) {
      annotations[annotationKey] = {
        type: 'line',
        xMin: hourLabelScale,
        xMax: hourLabelScale,
        yMin: numericValue,
        yMax: numericValue + 0.01,
        borderColor: tile.color,
        borderWidth: 3,
        label: {
          display: true,
          content: labelText,
          backgroundColor: tile.color,
          color: '#000',
          position: 'start'
        }
      };
    } else {
      existing.xMin = hourLabelScale;
      existing.xMax = hourLabelScale;
      existing.yMin = numericValue;
      existing.yMax = numericValue + 0.01;
      existing.label ??= {
        display: true,
        content: labelText,
        backgroundColor: tile.color,
        color: '#000',
        position: 'start'
      };
      existing.label.content = labelText;
      existing.label.backgroundColor = tile.color;
    }

    chart.update('none');
  }

  private ensureAnnotationConfig(): Record<string, AnnotationOptions<'line'>> {
    if (!this.chart) {
      return {};
    }
    const plugins = (this.chart.options.plugins ??= {});
    const annotationOptions = (plugins.annotation ??= { annotations: {} });
    if (Array.isArray(annotationOptions.annotations) || !annotationOptions.annotations) {
      annotationOptions.annotations = {};
    }
    return annotationOptions.annotations as Record<string, AnnotationOptions<'line'>>;
  }
}
