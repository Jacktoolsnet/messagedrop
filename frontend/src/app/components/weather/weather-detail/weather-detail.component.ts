import { AfterViewInit, Component, ElementRef, inject, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
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
import annotationPlugin, { AnnotationOptions } from 'chartjs-plugin-annotation';
import { HourlyWeather } from '../../../interfaces/hourly-weather';
import { Weather } from '../../../interfaces/weather';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { getWeatherBaseColor } from '../../../utils/weather-level.util';
import { WeatherTile } from '../weather-tile.interface';
import { selectedPointLabelPlugin } from '../../../utils/chart-selected-point-label.plugin';

const RADAR_CHART_BREAKPOINT_PX = 700;
const RADAR_POINT_LABEL_PADDING_PX = 2;

@Component({
  selector: 'app-weather-detail',
  imports: [],
  templateUrl: './weather-detail.component.html',
  styleUrl: './weather-detail.component.css'
})
export class WeatherDetailComponent implements OnChanges, AfterViewInit, OnDestroy {
  @Input() tile!: WeatherTile;
  @Input() weather: Weather | null = null;
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
      LineController,
      RadarController,
      LineElement,
      PointElement,
      LinearScale,
      CategoryScale,
      RadialLinearScale,
      Title,
      Tooltip,
      Filler,
      annotationPlugin,
      selectedPointLabelPlugin
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
    if (changes['selectedDayIndex'] || changes['tile'] || changes['weather']) {
      this.updateChart();
      return;
    }
    if (changes['selectedHour'] && !changes['selectedHour'].firstChange) {
      this.moveSelectedHourAnnotation();
    }
  }

  private updateChart(forceRecreate = false): void {
    if (!this.weather || !this.tile) {
      return;
    }

    const selectedDate = this.weather.daily[this.selectedDayIndex]?.date;
    if (!selectedDate) {
      return;
    }

    const dayHourly = this.weather.hourly.filter((hour) => hour.time.startsWith(selectedDate));
    if (!dayHourly.length) {
      return;
    }

    const fullLabels = dayHourly.map((hour) => hour.time.split('T')[1].slice(0, 5));
    this.fullHourLabels = fullLabels;
    const selectedIndex = this.getSelectedIndex(dayHourly.length);

    if (this.useRadarChart) {
      this.updateRadarChart(dayHourly, fullLabels, selectedIndex, forceRecreate);
      return;
    }

    this.updateLineChart(dayHourly, fullLabels, selectedIndex, forceRecreate);
  }

  private updateLineChart(
    dayHourly: HourlyWeather[],
    fullLabels: string[],
    selectedIndex: number,
    forceRecreate: boolean
  ): void {
    let dataset: any = {
      data: [],
      label: '',
      borderColor: '',
      backgroundColor: '',
      tension: 0.3,
      fill: true,
      pointRadius: 3,
      pointBackgroundColor: []
    };

    let minY: number | undefined;
    let maxY: number | undefined;

    switch (this.tile.type) {
      case 'temperature': {
        const temps = dayHourly.map((hour) => hour.temperature);
        const minTemp = Math.min(...temps);
        const maxTemp = Math.max(...temps);
        const { min, max } = this.getHourlyMinMax('temperature');
        const minPadding = Math.max(Math.abs(min) * 0.1, 0.5);
        const maxPadding = Math.max(Math.abs(max) * 0.1, 0.5);
        minY = min - minPadding;
        maxY = max + maxPadding;
        dataset = {
          ...dataset,
          data: temps,
          label: this.translation.t('weather.chart.temperature'),
          pointBackgroundColor: temps.map((temp) => this.getTemperatureColor(temp)),
          segment: {
            borderColor: (ctx: any) => this.mixColors(
              this.getTemperatureColor(this.toChartNumber(ctx.p0.parsed.y)),
              this.getTemperatureColor(this.toChartNumber(ctx.p1.parsed.y))
            )
          },
          backgroundColor: (ctx: ScriptableContext<'line'>) => {
            const chartArea = ctx.chart.chartArea;
            if (!chartArea) {
              return this.toAlpha(this.getTemperatureColor(maxTemp), 0.24);
            }
            const gradient = ctx.chart.ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
            gradient.addColorStop(0, this.getTemperatureColor(minTemp));
            gradient.addColorStop(1, this.getTemperatureColor(maxTemp));
            return gradient;
          }
        };
        break;
      }
      case 'uvIndex': {
        const uvs = dayHourly.map((hour) => hour.uvIndex);
        const minUv = Math.min(...uvs);
        const maxUv = Math.max(...uvs);
        minY = 0;
        maxY = 11;
        dataset = {
          ...dataset,
          data: uvs,
          label: this.translation.t('weather.chart.uvIndex'),
          pointBackgroundColor: uvs.map((value) => this.getUvColor(value)),
          segment: {
            borderColor: (ctx: any) => this.mixColors(
              this.getUvColor(this.toChartNumber(ctx.p0.parsed.y)),
              this.getUvColor(this.toChartNumber(ctx.p1.parsed.y))
            )
          },
          backgroundColor: (ctx: ScriptableContext<'line'>) => {
            const chartArea = ctx.chart.chartArea;
            if (!chartArea) {
              return this.toAlpha(this.getUvColor(maxUv), 0.24);
            }
            const gradient = ctx.chart.ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
            gradient.addColorStop(0, this.getUvColor(minUv));
            gradient.addColorStop(1, this.getUvColor(maxUv));
            return gradient;
          }
        };
        break;
      }
      case 'precipitationprobability': {
        const precipitationProbability = dayHourly.map((hour) => hour.precipitationProbability);
        const baseColor = this.getBaseColorForSelectedValue(precipitationProbability, selectedIndex);
        minY = 0;
        maxY = 100;
        dataset = {
          ...dataset,
          data: precipitationProbability,
          label: this.translation.t('weather.chart.precipitationProbability'),
          borderColor: baseColor,
          backgroundColor: this.toAlpha(baseColor, 0.2),
          pointBackgroundColor: baseColor
        };
        break;
      }
      case 'precipitation': {
        const precipitation = dayHourly.map((hour) => hour.precipitation);
        const { max } = this.getHourlyMinMax('precipitation');
        const baseColor = this.getBaseColorForSelectedValue(precipitation, selectedIndex);
        minY = 0;
        maxY = max + max * 0.1;
        dataset = {
          ...dataset,
          data: precipitation,
          label: this.translation.t('weather.chart.precipitation'),
          borderColor: baseColor,
          backgroundColor: this.toAlpha(baseColor, 0.2),
          pointBackgroundColor: baseColor
        };
        break;
      }
      case 'wind': {
        const winds = dayHourly.map((hour) => hour.wind);
        const { min, max } = this.getHourlyMinMax('wind');
        const baseColor = this.getBaseColorForSelectedValue(winds, selectedIndex);
        minY = Math.max(min - min * 0.1, 0);
        maxY = max + max * 0.1;
        dataset = {
          ...dataset,
          data: winds,
          label: this.translation.t('weather.chart.wind'),
          borderColor: baseColor,
          backgroundColor: this.toAlpha(baseColor, 0.2),
          pointBackgroundColor: baseColor
        };
        break;
      }
      case 'pressure': {
        const pressures = dayHourly.map((hour) => hour.pressure);
        const { min, max } = this.getHourlyMinMax('pressure');
        const baseColor = this.getBaseColorForSelectedValue(pressures, selectedIndex);
        minY = min - 0.1;
        maxY = max + 0.1;
        dataset = {
          ...dataset,
          data: pressures,
          label: this.translation.t('weather.chart.pressure'),
          borderColor: baseColor,
          backgroundColor: this.toAlpha(baseColor, 0.2),
          pointBackgroundColor: baseColor
        };
        break;
      }
    }

    const annotations: Record<string, Partial<AnnotationOptions<'line'>>> = {};

    if (selectedIndex !== -1) {
      const value = this.getSelectedChartValue(dayHourly[selectedIndex]);
      const label = fullLabels[selectedIndex];
      const color = getWeatherBaseColor(this.tile.type, value);
      annotations['selectedHour'] = {
        type: 'line',
        xMin: label,
        xMax: label,
        yMin: value,
        yMax: value + 0.01,
        borderColor: color,
        borderWidth: 3,
        label: {
          display: true,
          content: `${label}: ${value}${this.getSelectedChartUnit()}`,
          backgroundColor: color,
          color: '#000000',
          position: 'start'
        }
      };
    }

    const isDark = document.body.classList.contains('dark');
    const textColor = isDark ? '#ffffff' : '#000000';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        annotation: { annotations },
        title: {
          display: true,
          text: this.tile.label,
          color: textColor,
          font: {
            size: 18,
            weight: 'bold'
          },
          padding: {
            top: 10,
            bottom: 20
          }
        }
      },
      scales: {
        x: {
          ticks: {
            color: textColor,
            maxRotation: 45,
            minRotation: 45
          },
          grid: { color: gridColor },
          title: {
            display: true,
            text: this.translation.t('weather.axis.time'),
            color: textColor,
            font: { size: 14, weight: 'bold' }
          }
        },
        y: {
          ticks: { color: textColor },
          grid: { color: gridColor },
          min: minY,
          max: maxY,
          title: {
            display: true,
            text: this.getSelectedChartUnit(),
            color: textColor,
            font: { size: 14, weight: 'bold' }
          }
        }
      }
    };

    this.chartData = { labels: fullLabels, datasets: [dataset] };
    this.ensureChart('line', forceRecreate);
    if (!this.chart) {
      return;
    }
    this.chart.data = this.chartData as any;
    this.chart.options = (this.chartOptions ?? {}) as any;
    this.chart.update();
  }

  private updateRadarChart(
    dayHourly: HourlyWeather[],
    fullLabels: string[],
    selectedIndex: number,
    forceRecreate: boolean
  ): void {
    const radialLabels = this.getRadarLabels(fullLabels);
    const selectedValue = this.getSelectedChartValue(dayHourly[selectedIndex] ?? dayHourly[0]);
    const selectedHourLabel = fullLabels[selectedIndex] ?? this.formatHour(selectedIndex);
    const selectedPointLabel = `${selectedHourLabel}: ${selectedValue}${this.getSelectedChartUnit()}`;
    const selectedPointColor = getWeatherBaseColor(this.tile.type, selectedValue);
    const isDark = document.body.classList.contains('dark');
    const textColor = isDark ? '#ffffff' : '#000000';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)';
    const { dataset, minY, maxY } = this.buildRadarDataset(dayHourly, selectedIndex);

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: 0
      },
      plugins: {
        legend: { display: false },
        annotation: { annotations: {} },
        title: {
          display: true,
          text: this.tile.label,
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
        tooltip: {
          callbacks: {
            title: (items: any[]) => this.getFullHourLabel(items[0]?.dataIndex ?? 0),
            label: (ctx: any) => `${ctx.formattedValue}${this.getSelectedChartUnit()}`
          }
        },
        selectedPointLabel: {
          display: true,
          pointIndex: selectedIndex,
          text: selectedPointLabel,
          backgroundColor: selectedPointColor,
          textColor: '#000000'
        }
      },
      scales: {
        r: {
          min: minY,
          max: maxY,
          beginAtZero: minY === 0,
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

    this.chartData = {
      labels: radialLabels,
      datasets: [dataset]
    };

    this.ensureChart('radar', forceRecreate);
    if (!this.chart) {
      return;
    }
    this.chart.data = this.chartData as any;
    this.chart.options = (this.chartOptions ?? {}) as any;
    this.chart.update();
  }

  private buildRadarDataset(
    dayHourly: HourlyWeather[],
    selectedIndex: number
  ): { dataset: any; minY: number; maxY: number } {
    const values = dayHourly.map((hour) => this.getSelectedChartValue(hour));
    const pointRadius = values.map((_value, index) => index === selectedIndex ? 6 : 3);
    const pointBorderWidth = values.map((_value, index) => index === selectedIndex ? 3 : 1);
    const pointBorderColor = values.map((_value, index) => index === selectedIndex ? '#ffffff' : 'rgba(255,255,255,0.35)');
    const baseColor = this.getBaseColorForSelectedValue(values, selectedIndex);

    switch (this.tile.type) {
      case 'temperature': {
        const minTemp = Math.min(...values);
        const maxTemp = Math.max(...values);
        const { minY, maxY } = this.getRadarScaleBounds(values);
        return {
          minY,
          maxY,
          dataset: {
            data: values,
            label: this.translation.t('weather.chart.temperature'),
            fill: true,
            tension: 0.25,
            pointRadius,
            pointBorderWidth,
            pointBorderColor,
            pointBackgroundColor: values.map((value) => this.getTemperatureColor(value)),
            segment: {
              borderColor: (ctx: any) => this.mixColors(
                this.getTemperatureColor(this.toChartNumber(ctx.p0.parsed.y)),
                this.getTemperatureColor(this.toChartNumber(ctx.p1.parsed.y))
              )
            },
            borderColor: this.mixColors(this.getTemperatureColor(minTemp), this.getTemperatureColor(maxTemp)),
            backgroundColor: (ctx: ScriptableContext<'radar'>) => this.createRadarGradient(
              ctx,
              this.getTemperatureColor(minTemp),
              this.getTemperatureColor(maxTemp)
            )
          }
        };
      }
      case 'uvIndex': {
        const minUv = Math.min(...values);
        const maxUv = Math.max(...values);
        const { minY, maxY } = this.getRadarScaleBounds(values, true);
        return {
          minY,
          maxY,
          dataset: {
            data: values,
            label: this.translation.t('weather.chart.uvIndex'),
            fill: true,
            tension: 0.25,
            pointRadius,
            pointBorderWidth,
            pointBorderColor,
            pointBackgroundColor: values.map((value) => this.getUvColor(value)),
            segment: {
              borderColor: (ctx: any) => this.mixColors(
                this.getUvColor(this.toChartNumber(ctx.p0.parsed.y)),
                this.getUvColor(this.toChartNumber(ctx.p1.parsed.y))
              )
            },
            borderColor: this.mixColors(this.getUvColor(minUv), this.getUvColor(maxUv)),
            backgroundColor: (ctx: ScriptableContext<'radar'>) => this.createRadarGradient(
              ctx,
              this.getUvColor(minUv),
              this.getUvColor(maxUv)
            )
          }
        };
      }
      case 'precipitationprobability': {
        const { minY, maxY } = this.getRadarScaleBounds(values, true);
        return {
          minY,
          maxY,
          dataset: {
            data: values,
            label: this.translation.t('weather.chart.precipitationProbability'),
            fill: true,
            tension: 0.25,
            pointRadius,
            pointBorderWidth,
            pointBorderColor,
            pointBackgroundColor: values.map((value) => getWeatherBaseColor(this.tile.type, value)),
            borderColor: baseColor,
            backgroundColor: this.toAlpha(baseColor, 0.2)
          }
        };
      }
      case 'precipitation': {
        const { minY, maxY } = this.getRadarScaleBounds(values, true);
        return {
          minY,
          maxY,
          dataset: {
            data: values,
            label: this.translation.t('weather.chart.precipitation'),
            fill: true,
            tension: 0.25,
            pointRadius,
            pointBorderWidth,
            pointBorderColor,
            pointBackgroundColor: values.map((value) => getWeatherBaseColor(this.tile.type, value)),
            borderColor: baseColor,
            backgroundColor: this.toAlpha(baseColor, 0.2)
          }
        };
      }
      case 'wind': {
        const { minY, maxY } = this.getRadarScaleBounds(values, true);
        return {
          minY,
          maxY,
          dataset: {
            data: values,
            label: this.translation.t('weather.chart.wind'),
            fill: true,
            tension: 0.25,
            pointRadius,
            pointBorderWidth,
            pointBorderColor,
            pointBackgroundColor: values.map((value) => getWeatherBaseColor(this.tile.type, value)),
            borderColor: baseColor,
            backgroundColor: this.toAlpha(baseColor, 0.2)
          }
        };
      }
      case 'pressure':
      default: {
        const { minY, maxY } = this.getRadarScaleBounds(values);
        return {
          minY,
          maxY,
          dataset: {
            data: values,
            label: this.translation.t('weather.chart.pressure'),
            fill: true,
            tension: 0.25,
            pointRadius,
            pointBorderWidth,
            pointBorderColor,
            pointBackgroundColor: values.map((value) => getWeatherBaseColor(this.tile.type, value)),
            borderColor: baseColor,
            backgroundColor: this.toAlpha(baseColor, 0.2)
          }
        };
      }
    }
  }

  private moveSelectedHourAnnotation(): void {
    if (!this.chart || !this.tile) {
      return;
    }

    if (this.useRadarChart) {
      this.updateRadarSelection();
      return;
    }

    const labels = Array.isArray(this.chartData.labels) ? this.chartData.labels : [];
    if (!labels.length) {
      return;
    }

    const selectedIndex = this.getSelectedIndex(labels.length);
    const labelValue = labels[selectedIndex];
    const label = (typeof labelValue === 'string' ? labelValue : this.formatHour(selectedIndex)).toString();
    const rawValue = this.chartData.datasets?.[0]?.data?.[selectedIndex];
    const numericValue = typeof rawValue === 'number' ? rawValue : Number(rawValue ?? 0);
    const color = getWeatherBaseColor(this.tile.type, numericValue);

    const annotations = this.ensureAnnotationConfig();
    const annotationKey = 'selectedHour';
    const existing = annotations[annotationKey];

    if (!existing) {
      annotations[annotationKey] = {
        type: 'line',
        xMin: label,
        xMax: label,
        yMin: numericValue,
        yMax: numericValue + 0.01,
        borderColor: color,
        borderWidth: 3,
        label: {
          display: true,
          content: `${label}: ${numericValue}${this.getSelectedChartUnit()}`,
          backgroundColor: color,
          color: '#000000',
          position: 'start'
        }
      };
    } else {
      existing.xMin = label;
      existing.xMax = label;
      existing.yMin = numericValue;
      existing.yMax = numericValue + 0.01;
      existing.label ??= {
        display: true,
        content: '',
        backgroundColor: color,
        color: '#000000',
        position: 'start'
      };
      existing.label.content = `${label}: ${numericValue}${this.getSelectedChartUnit()}`;
      existing.label.backgroundColor = color;
    }

    this.chart.update('none');
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
    const pointRadius = data.map((_value, index) => index === selectedIndex ? 6 : 3);
    const pointBorderWidth = data.map((_value, index) => index === selectedIndex ? 3 : 1);
    const pointBorderColor = data.map((_value, index) => index === selectedIndex ? '#ffffff' : 'rgba(255,255,255,0.35)');
    const dataset = this.chart.data.datasets[0] as any;
    const selectedValueRaw = data[selectedIndex];
    const selectedValue = typeof selectedValueRaw === 'number' ? selectedValueRaw : Number(selectedValueRaw ?? 0);

    dataset.pointRadius = pointRadius;
    dataset.pointBorderWidth = pointBorderWidth;
    dataset.pointBorderColor = pointBorderColor;

    const selectedPointLabel = `${this.getFullHourLabel(selectedIndex)}: ${selectedValue}${this.getSelectedChartUnit()}`;
    const selectedPointColor = getWeatherBaseColor(this.tile.type, selectedValue);
    const plugins = (this.chart.options.plugins ??= {}) as any;

    if (plugins.title) {
      plugins.title.text = this.tile.label;
    }

    plugins.selectedPointLabel = {
      display: true,
      pointIndex: selectedIndex,
      text: selectedPointLabel,
      backgroundColor: selectedPointColor,
      textColor: '#000000'
    };

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

  private getRadarScaleBounds(values: number[], forceZeroMin = false): { minY: number; maxY: number } {
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    let minY = forceZeroMin ? 0 : minValue;
    let maxY = maxValue;

    if (maxY === minY) {
      if (forceZeroMin) {
        maxY = maxY === 0 ? 1 : maxY;
      } else {
        minY = minY - Math.max(Math.abs(maxY) * 0.1, 0.5);
      }
    }

    return { minY, maxY };
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

  private createRadarGradient(
    ctx: ScriptableContext<'radar'>,
    innerColor: string,
    outerColor: string
  ): CanvasGradient | string {
    const chartArea = ctx.chart.chartArea;
    if (!chartArea) {
      return this.toAlpha(outerColor, 0.24);
    }

    const centerX = (chartArea.left + chartArea.right) / 2;
    const centerY = (chartArea.top + chartArea.bottom) / 2;
    const radius = Math.min(chartArea.right - chartArea.left, chartArea.bottom - chartArea.top) / 2;
    const gradient = ctx.chart.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, this.toAlpha(innerColor, 0.12));
    gradient.addColorStop(1, this.toAlpha(outerColor, 0.28));
    return gradient;
  }

  private getSelectedChartValue(hourData: HourlyWeather): number {
    switch (this.tile.type) {
      case 'temperature': return hourData.temperature;
      case 'precipitationprobability': return hourData.precipitationProbability;
      case 'precipitation': return hourData.precipitation;
      case 'uvIndex': return hourData.uvIndex;
      case 'wind': return hourData.wind;
      case 'pressure': return hourData.pressure;
      default: return 0;
    }
  }

  private getSelectedChartUnit(): string {
    switch (this.tile.type) {
      case 'temperature': return '°C';
      case 'precipitationprobability': return '%';
      case 'precipitation': return 'mm/h';
      case 'uvIndex': return '';
      case 'wind': return ' km/h';
      case 'pressure': return ' hPa';
      default: return '';
    }
  }

  mixColors(color1: string, color2: string): string {
    const hexToRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        }
        : { r: 0, g: 0, b: 0 };
    };

    const rgbToHex = (r: number, g: number, b: number) =>
      '#' +
      [r, g, b]
        .map((value) => {
          const hex = value.toString(16);
          return hex.length === 1 ? `0${hex}` : hex;
        })
        .join('');

    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);

    const mixed = {
      r: Math.round((rgb1.r + rgb2.r) / 2),
      g: Math.round((rgb1.g + rgb2.g) / 2),
      b: Math.round((rgb1.b + rgb2.b) / 2)
    };

    return rgbToHex(mixed.r, mixed.g, mixed.b);
  }

  getTemperatureColor(temp: number): string {
    return getWeatherBaseColor('temperature', temp);
  }

  getUvColor(uv: number): string {
    return getWeatherBaseColor('uvIndex', uv);
  }

  getHourlyMinMax(field: 'temperature' | 'precipitation' | 'wind' | 'pressure'): { min: number, max: number } {
    if (!this.weather || !this.weather.hourly) return { min: 0, max: 0 };

    const values = this.weather.hourly
      .map((hour) => hour[field])
      .filter((value) => typeof value === 'number');

    if (values.length === 0) return { min: 0, max: 0 };

    const min = Math.min(...values);
    const max = Math.max(...values);

    return { min, max };
  }

  private getBaseColorForSelectedValue(values: number[], selectedIndex: number): string {
    const safeIndex = selectedIndex >= 0 && selectedIndex < values.length ? selectedIndex : Math.floor(values.length / 2);
    const value = values[safeIndex] ?? 0;
    return getWeatherBaseColor(this.tile.type, value);
  }

  private toAlpha(color: string, alpha: number): string {
    const hex = color.replace('#', '');
    const bigint = parseInt(hex, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  private toChartNumber(value: number | null | undefined, fallback = 0): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }
}
