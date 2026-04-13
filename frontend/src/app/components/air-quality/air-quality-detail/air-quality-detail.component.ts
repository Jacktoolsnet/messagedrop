import { AfterViewInit, Component, ElementRef, inject, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import {
  CategoryScale,
  Chart,
  ChartType,
  Filler,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  RadarController,
  RadialLinearScale,
  ScriptableContext,
  Title,
  Tooltip
} from 'chart.js';
import annotationPlugin, { AnnotationOptions, ScaleValue as AnnotationScaleValue } from 'chartjs-plugin-annotation';
import { AirQualityTileValue } from '../../../interfaces/air-quality-tile-value';
import { TranslationHelperService } from '../../../services/translation-helper.service';

const RADAR_CHART_BREAKPOINT_PX = 700;
const RADAR_POINT_LABEL_PADDING_PX = 2;

@Component({
  selector: 'app-air-quality-detail',
  standalone: true,
  imports: [MatDialogModule],
  templateUrl: './air-quality-detail.component.html',
  styleUrl: './air-quality-detail.component.css'
})
export class AirQualityDetailComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() tile: AirQualityTileValue | null = null;
  @Input() selectedDayIndex = 0;
  @Input() selectedHour = 0;
  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private readonly translation = inject(TranslationHelperService);
  private readonly radarMediaQuery = typeof window !== 'undefined'
    ? window.matchMedia(`(max-width: ${RADAR_CHART_BREAKPOINT_PX}px)`)
    : null;
  private useRadarMode = this.radarMediaQuery?.matches ?? false;
  private readonly radarMediaQueryListener = (event: MediaQueryListEvent) => {
    this.useRadarMode = event.matches;
    this.updateChart(true);
  };
  private fullHourLabels: string[] = [];
  private currentChartType: ChartType | null = null;

  chartOptions: any = {};
  chartData: any = { labels: [], datasets: [] };

  get useRadarChart(): boolean {
    return this.useRadarMode;
  }

  constructor() {
    Chart.register(
      CategoryScale,
      LinearScale,
      PointElement,
      LineElement,
      Filler,
      Title,
      Tooltip,
      LineController,
      RadarController,
      RadialLinearScale,
      annotationPlugin
    );
  }

  ngAfterViewInit(): void {
    this.radarMediaQuery?.addEventListener('change', this.radarMediaQueryListener);
    this.updateChart(true);
  }

  ngOnDestroy(): void {
    this.radarMediaQuery?.removeEventListener('change', this.radarMediaQueryListener);
    this.chart?.destroy();
    this.chart = null;
    this.currentChartType = null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedDayIndex'] || changes['tile']) {
      this.updateChart();
      return;
    }

    if (changes['selectedHour'] && !changes['selectedHour'].firstChange) {
      this.moveSelectedHourAnnotation();
    }
  }

  updateChart(forceRecreate = false): void {
    if (!this.tile?.values || !this.tile?.time) {
      return;
    }

    const tile = this.tile;
    const start = this.selectedDayIndex * 24;
    const end = start + 24;
    const dayValues = tile.values.slice(start, end);
    const fullLabels = tile.time.slice(start, end).map((time) => time.slice(11));
    this.fullHourLabels = fullLabels;

    if (!dayValues.length) {
      return;
    }

    if (this.useRadarChart) {
      this.updateRadarChart(dayValues, fullLabels, forceRecreate);
      return;
    }

    this.updateLineChart(dayValues, fullLabels, forceRecreate);
  }

  private updateLineChart(dayValues: number[], fullLabels: string[], forceRecreate: boolean): void {
    const tile = this.tile;
    if (!tile) {
      return;
    }

    const globalMin = Math.min(...tile.values);
    const globalMax = Math.max(...tile.values);
    const selectedIndex = this.getSelectedIndex(dayValues.length);
    const hourLabel = fullLabels[selectedIndex] ?? this.formatHour(selectedIndex);
    const hourLabelScale: AnnotationScaleValue = hourLabel;
    const value = dayValues[selectedIndex] ?? 0;
    const annotationLabel = `${hourLabel}: ${this.formatValueWithUnit(value)}`;

    const isDark = document.body.classList.contains('dark');
    const textColor = isDark ? '#ffffff' : '#000000';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

    this.chartData = {
      labels: fullLabels,
      datasets: [{
        label: tile.label,
        data: dayValues,
        borderColor: tile.color,
        backgroundColor: (ctx: ScriptableContext<'line'>) => {
          const chartArea = ctx.chart.chartArea;
          if (!chartArea) {
            return this.toAlpha(tile.color, 0.24);
          }
          const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, chartArea.bottom - chartArea.top);
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

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: (ctx: any) => this.formatValueWithUnit(Number(ctx.formattedValue)),
            title: (ctx: any[]) => this.getTimeLabel(ctx[0].dataIndex)
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
            text: this.translation.t('weather.airQuality.axis.time'),
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

    this.ensureChart('line', forceRecreate);
    if (!this.chart) {
      return;
    }

    this.chart.data = this.chartData as any;
    this.chart.options = (this.chartOptions ?? {}) as any;
    this.chart.update();
  }

  private updateRadarChart(dayValues: number[], fullLabels: string[], forceRecreate: boolean): void {
    const tile = this.tile;
    if (!tile) {
      return;
    }

    const selectedIndex = this.getSelectedIndex(dayValues.length);
    const selectedValue = dayValues[selectedIndex] ?? 0;
    const { minY, maxY } = this.getRadarScaleBounds(dayValues);
    const isDark = document.body.classList.contains('dark');
    const textColor = isDark ? '#ffffff' : '#000000';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';

    this.chartData = {
      labels: this.getRadarLabels(fullLabels),
      datasets: [{
        label: tile.label,
        data: dayValues,
        borderColor: tile.color,
        backgroundColor: (ctx: ScriptableContext<'radar'>) => this.createRadarGradient(ctx, tile.color),
        fill: true,
        pointRadius: dayValues.map((_value, index) => index === selectedIndex ? 6 : 3),
        pointBorderWidth: dayValues.map((_value, index) => index === selectedIndex ? 3 : 1),
        pointBorderColor: dayValues.map((_value, index) => index === selectedIndex ? '#ffffff' : 'rgba(255,255,255,0.35)'),
        pointBackgroundColor: tile.color,
        tension: 0.3
      }]
    };

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: 0
      },
      plugins: {
        tooltip: {
          callbacks: {
            title: (items: any[]) => this.getFullHourLabel(items[0]?.dataIndex ?? 0),
            label: (ctx: any) => this.formatValueWithUnit(Number(ctx.formattedValue))
          }
        },
        legend: { display: false },
        title: {
          display: true,
          text: [tile.label, `${this.getFullHourLabel(selectedIndex)}: ${this.formatValueWithUnit(selectedValue)}`],
          color: textColor,
          font: {
            size: 18,
            weight: 'bold'
          },
          padding: {
            top: 6,
            bottom: 12
          }
        },
        annotation: {
          annotations: {}
        }
      },
      scales: {
        r: {
          beginAtZero: minY === 0,
          min: minY,
          max: maxY,
          grid: { color: gridColor },
          angleLines: { color: gridColor },
          pointLabels: {
            color: textColor,
            padding: RADAR_POINT_LABEL_PADDING_PX,
            font: {
              size: 10,
              weight: 600
            }
          },
          ticks: {
            color: textColor,
            backdropColor: 'transparent',
            showLabelBackdrop: false,
            maxTicksLimit: 4
          }
        }
      },
      elements: {
        line: {
          borderWidth: 2.5
        }
      }
    };

    this.ensureChart('radar', forceRecreate);
    if (!this.chart) {
      return;
    }

    this.chart.data = this.chartData as any;
    this.chart.options = (this.chartOptions ?? {}) as any;
    this.chart.update();
  }

  getTimeLabel(hour: number): string {
    return this.getFullHourLabel(hour);
  }

  getValueLabel(hour: number): string {
    const value = this.tile?.values?.[this.selectedDayIndex * 24 + hour];
    return value != null ? this.formatValueWithUnit(value) : '–';
  }

  moveSelectedHourAnnotation(): void {
    if (!this.chart || !this.tile) {
      return;
    }

    if (this.useRadarChart) {
      this.updateRadarSelection();
      return;
    }

    const chart = this.chart;
    const tile = this.tile;
    const labels = Array.isArray(this.chartData.labels) ? this.chartData.labels : [];
    const selectedIndex = this.getSelectedIndex(labels.length || 24);
    const labelValue = labels?.[selectedIndex];
    const hourLabel = (typeof labelValue === 'string' ? labelValue : this.formatHour(selectedIndex)).toString();
    const rawValue = this.chartData.datasets?.[0]?.data?.[selectedIndex];
    const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0);
    const labelText = `${hourLabel}: ${this.formatValueWithUnit(numericValue)}`;

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
        content: '',
        backgroundColor: tile.color,
        color: '#000',
        position: 'start'
      };
      existing.label.content = labelText;
      existing.label.backgroundColor = tile.color;
    }

    chart.update('none');
  }

  private updateRadarSelection(): void {
    if (!this.chart || !this.tile || this.currentChartType !== 'radar') {
      return;
    }

    const data = this.chart.data.datasets?.[0]?.data ?? [];
    if (!data.length) {
      return;
    }

    const selectedIndex = this.getSelectedIndex(data.length);
    const dataset = this.chart.data.datasets[0] as any;
    const selectedValueRaw = data[selectedIndex];
    const selectedValue = typeof selectedValueRaw === 'number' ? selectedValueRaw : Number(selectedValueRaw ?? 0);

    dataset.pointRadius = data.map((_value, index) => index === selectedIndex ? 6 : 3);
    dataset.pointBorderWidth = data.map((_value, index) => index === selectedIndex ? 3 : 1);
    dataset.pointBorderColor = data.map((_value, index) => index === selectedIndex ? '#ffffff' : 'rgba(255,255,255,0.35)');

    if (this.chart.options.plugins?.title) {
      this.chart.options.plugins.title.text = [
        this.tile.label,
        `${this.getFullHourLabel(selectedIndex)}: ${this.formatValueWithUnit(selectedValue)}`
      ];
    }

    this.chart.update('none');
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

  private ensureChart(chartType: ChartType, forceRecreate = false): void {
    if (!this.chartCanvas?.nativeElement) {
      return;
    }

    if (!forceRecreate && this.chart && this.currentChartType === chartType) {
      return;
    }

    this.chart?.destroy();
    this.chart = new Chart(this.chartCanvas.nativeElement, {
      type: chartType,
      data: this.chartData,
      options: this.chartOptions
    });
    this.currentChartType = chartType;
  }

  private getSelectedIndex(length: number): number {
    if (length <= 0) {
      return 0;
    }
    return Math.max(0, Math.min(this.selectedHour, length - 1));
  }

  private getRadarScaleBounds(values: number[]): { minY: number; maxY: number } {
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    return {
      minY: 0,
      maxY: maxValue === 0 ? 1 : maxValue
    };
  }

  private getRadarLabels(labels: string[]): string[] {
    return labels.map((_label, index) => index % 6 === 0 ? `${index}` : '');
  }

  private getFullHourLabel(index: number): string {
    return this.fullHourLabels[index] ?? this.formatHour(index);
  }

  private formatHour(index: number): string {
    return `${index.toString().padStart(2, '0')}:00`;
  }

  private formatValueWithUnit(value: number): string {
    const unit = this.tile?.unit?.trim() ?? '';
    return unit ? `${value} ${unit}` : `${value}`;
  }

  private createRadarGradient(ctx: ScriptableContext<'radar'>, color: string): CanvasGradient | string {
    const chartArea = ctx.chart.chartArea;
    if (!chartArea) {
      return this.toAlpha(color, 0.22);
    }

    const centerX = (chartArea.left + chartArea.right) / 2;
    const centerY = (chartArea.top + chartArea.bottom) / 2;
    const radius = Math.min(chartArea.right - chartArea.left, chartArea.bottom - chartArea.top) / 2;
    const gradient = ctx.chart.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, this.toAlpha(color, 0.12));
    gradient.addColorStop(1, this.toAlpha(color, 0.28));
    return gradient;
  }

  private toAlpha(color: string, alpha: number): string {
    const hex = color.replace('#', '');
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
}
