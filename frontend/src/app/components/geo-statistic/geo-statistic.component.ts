import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import {
  CategoryScale, Chart, ChartConfiguration, ChartType,
  Filler,
  LinearScale, LineController, LineElement, PointElement, SubTitle, Title, Tooltip
} from 'chart.js';
import { debounceTime, fromEvent, Subscription } from 'rxjs';
import { GeoStatistic } from '../../interfaces/geo-statistic';
import { TranslationHelperService } from '../../services/translation-helper.service';
type WorldBankKey = keyof GeoStatistic['worldBank'];
type IndicatorCategory = 'economy' | 'social' | 'climate';
interface IndicatorDefinition { key: string }
interface CategoryColor { border: string; background: string; point: string }

@Component({
  selector: 'app-geo-statistic',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatIconModule,
    MatSelectModule,
    MatTooltipModule,
    MatExpansionModule,
    MatButtonModule,
    MatTooltipModule,
    TranslocoPipe
  ],
  templateUrl: './geo-statistic.component.html',
  styleUrl: './geo-statistic.component.css'
})
export class GeoStatisticComponent implements AfterViewInit, OnDestroy {

  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  private chart!: Chart;
  @ViewChild('dialogContent', { static: true }) dialogContentRef!: ElementRef;
  private resizeObserver?: ResizeObserver;
  private windowResizeSub?: Subscription;
  private langChangeSub?: Subscription;

  private readonly dialogData = inject<{ geoStatistic: GeoStatistic }>(MAT_DIALOG_DATA);
  readonly geoStatistic = this.dialogData.geoStatistic;
  private readonly translation = inject(TranslationHelperService);
  private readonly transloco = inject(TranslocoService);

  selectedCategory: IndicatorCategory = 'economy';
  selectedIndicator: IndicatorDefinition | null = null;
  currentIndicatorDescription = '';
  public isSmallScreen = false;

  readonly categories: readonly { value: IndicatorCategory; labelKey: string }[] = [
    { value: 'economy', labelKey: 'common.geoStatistic.categories.economy' },
    { value: 'social', labelKey: 'common.geoStatistic.categories.social' },
    { value: 'climate', labelKey: 'common.geoStatistic.categories.climate' }
  ] as const;

  // Original complete map
  private readonly fullIndicatorMap: Record<IndicatorCategory, IndicatorDefinition[]> = {
    economy: [
      { key: 'gdp' },
      { key: 'gdpPerCapita' },
      { key: 'militaryExpenditure' },
      { key: 'governmentSpending' },
      { key: 'inflation' },
      { key: 'unemployment' },
      { key: 'investment' }
    ],
    social: [
      { key: 'lifeExpectancy' },
      { key: 'povertyRate' },
      { key: 'literacyRate' },
      { key: 'primaryEnrollment' },
      { key: 'secondaryEnrollment' },
      { key: 'giniIndex' }
    ],
    climate: [
      { key: 'co2Emissions' },
      { key: 'renewableEnergy' },
      { key: 'forestArea' },
      { key: 'airPollution' },
      { key: 'energyUse' },
      { key: 'temperatureTrend' },
      { key: 'precipitationTrend' }
    ]
  };

  private readonly categoryColors: Record<IndicatorCategory, CategoryColor> = {
    economy: {
      border: '#2196F3',
      background: 'rgba(33, 150, 243, 0.3)',
      point: '#2196F3'
    },
    social: {
      border: '#9C27B0',
      background: 'rgba(156, 39, 176, 0.3)',
      point: '#9C27B0'
    },
    climate: {
      border: '#4CAF50',
      background: 'rgba(76, 175, 80, 0.3)',
      point: '#4CAF50'
    }
  };

  private readonly indicatorUnits: Record<string, string> = {
    gdp: 'common.geoStatistic.units.usd',
    gdpPerCapita: 'common.geoStatistic.units.usdPerPerson',
    militaryExpenditure: 'common.geoStatistic.units.usd',
    governmentSpending: 'common.geoStatistic.units.usd',
    inflation: 'common.geoStatistic.units.percent',
    unemployment: 'common.geoStatistic.units.percent',
    investment: 'common.geoStatistic.units.usd',
    lifeExpectancy: 'common.geoStatistic.units.years',
    povertyRate: 'common.geoStatistic.units.people',
    literacyRate: 'common.geoStatistic.units.percent',
    primaryEnrollment: 'common.geoStatistic.units.percent',
    secondaryEnrollment: 'common.geoStatistic.units.percent',
    giniIndex: '',
    co2Emissions: 'common.geoStatistic.units.kilotons',
    renewableEnergy: 'common.geoStatistic.units.mwh',
    forestArea: 'common.geoStatistic.units.percent',
    airPollution: 'common.geoStatistic.units.micrograms',
    energyUse: 'common.geoStatistic.units.kgOilEqPerCapita',
    temperatureTrend: 'common.geoStatistic.units.celsius',
    precipitationTrend: 'common.geoStatistic.units.mm'
  };

  // Filtered map (only those with available data)
  indicatorMap: Partial<Record<IndicatorCategory, IndicatorDefinition[]>> = {};

  private readonly lineChartType: ChartType = 'line';
  chartData: ChartConfiguration['data'] = { labels: [], datasets: [] };
  chartOptions: ChartConfiguration['options'] = {};

  constructor() {
    Chart.register(
      LineController,
      LineElement,
      PointElement,
      LinearScale,
      CategoryScale,
      Filler,
      Title,
      Tooltip,
      SubTitle
    );

    // Build filtered indicators
    this.buildIndicatorMap();
  }

  ngAfterViewInit(): void {
    this.chart = new Chart(this.chartCanvas.nativeElement, {
      type: this.lineChartType,
      data: this.chartData,
      options: this.chartOptions
    });
    // Beobachtet lokale Größenänderungen (z. B. Inhalte im Dialog)
    this.resizeObserver = new ResizeObserver(() => {
      this.checkScreenSize();
      this.setChartOptionsForIndicator(this.selectedIndicator?.key || 'gdp');
      this.updateChartSize();
    });
    this.resizeObserver.observe(this.dialogContentRef.nativeElement);

    // Beobachtet Fensteränderungen (z. B. Browser maximieren)
    this.windowResizeSub = fromEvent(window, 'resize')
      .pipe(debounceTime(200))  // Warte 200ms, bevor es reagiert
      .subscribe(() => {
        this.setChartOptionsForIndicator(this.selectedIndicator?.key || 'gdp');
        this.checkScreenSize();
        this.updateChartSize();
      });

    this.langChangeSub = this.transloco.langChanges$.subscribe(() => {
      if (this.selectedIndicator) {
        this.setChartOptionsForIndicator(this.selectedIndicator.key);
        this.updateChartLabel(this.selectedIndicator.key);
        this.chart?.update();
      }
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.windowResizeSub?.unsubscribe();
    this.langChangeSub?.unsubscribe();
  }

  private updateChartSize() {
    this.chart?.resize();
    this.chart?.update();
  }

  checkScreenSize() {
    this.isSmallScreen = window.innerWidth < 600;
  }

  buildIndicatorMap() {
    const weatherKeys = ['temperatureTrend', 'precipitationTrend'] as const;
    const resultMap: Partial<Record<IndicatorCategory, IndicatorDefinition[]>> = {};

    (Object.keys(this.fullIndicatorMap) as IndicatorCategory[]).forEach((category) => {
      resultMap[category] = this.fullIndicatorMap[category].filter(indicator => {
        let data: { year: string; value: number | null }[] | undefined;
        if (weatherKeys.includes(indicator.key as typeof weatherKeys[number])) {
          data =
            indicator.key === 'temperatureTrend'
              ? this.geoStatistic.weatherHistory.temperatureTrend
              : this.geoStatistic.weatherHistory.precipitationTrend;
        } else {
          data = this.geoStatistic.worldBank[indicator.key as WorldBankKey];
        }

        return Array.isArray(data) && data.some(item => item?.value !== null && item?.value !== undefined);
      });
    });

    this.indicatorMap = resultMap;
  }

  setChartOptionsForIndicator(indicatorKey: string) {
    const unitKey = this.indicatorUnits[indicatorKey];
    const unit = unitKey ? this.translation.t(unitKey) : '';
    const locale = navigator.language;
    const allIndicators = Object.values(this.fullIndicatorMap).flat();
    const indicator = allIndicators.find(i => i.key === indicatorKey);
    const label = indicator ? this.getIndicatorLabel(indicator.key) : indicatorKey;
    const description = this.getIndicatorDescription(indicatorKey);
    const canvasWidth = this.chart?.width || 300;
    const isSmallScreen = window.innerWidth < 500 || canvasWidth < 300;

    this.chartOptions = {
      responsive: true,
      plugins: {
        legend: { display: true },
        title: {
          display: !isSmallScreen,  // nur bei größeren Screens
          text: label,
          color: '#ccc',
          font: {
            size: 18,
            weight: 'bold'
          }
        },
        subtitle: {
          display: !isSmallScreen,
          text: description,
          color: '#aaa',
          font: {
            size: 12,
            family: 'Arial',
            weight: 'normal',
            lineHeight: 1.2
          },
          padding: {
            top: 10,
            bottom: 20
          },
          align: 'center'
        },
        tooltip: {
          enabled: true,
          callbacks: {
            label: (context) => {
              const rawValue = context.raw as number;
              let formatted = '';
              if (Math.abs(rawValue) >= 1_000_000) {
                formatted = new Intl.NumberFormat(locale, {
                  notation: 'compact',
                  compactDisplay: 'short',
                  maximumFractionDigits: 1
                }).format(rawValue);
              } else {
                formatted = new Intl.NumberFormat(locale, {
                  maximumFractionDigits: 0
                }).format(rawValue);
              }
              return unit ? `${formatted} ${unit}` : `${formatted}`;
            }
          }
        }
      },
      scales: {
        y: {
          ticks: {
            color: '#ccc',
            callback: (value: string | number) => {
              const num = typeof value === 'number' ? value : Number(value);
              let formatted = '';
              if (Math.abs(num) >= 1_000_000) {
                formatted = new Intl.NumberFormat(locale, {
                  notation: 'compact',
                  compactDisplay: 'short',
                  maximumFractionDigits: 1
                }).format(num);
              } else {
                formatted = new Intl.NumberFormat(locale, {
                  maximumFractionDigits: 1
                }).format(num);
              }
              return formatted;
            }
          },
          grid: { color: '#444' },
          title: {
            display: !!unit,
            text: unit,
            color: '#ccc'
          }
        },
        x: {
          ticks: { color: '#ccc' },
          grid: { color: '#444' },
          title: {
            display: true,
            text: this.translation.t('common.geoStatistic.axis.years'),
            color: '#ccc'
          }
        }
      }
    };

    // Speichere description separat für Info-Icon-Tooltip
    this.currentIndicatorDescription = description;
  }

  firstValidValue(series: { year: string; value: number | null }[] | undefined): number | null {
    if (!series || !Array.isArray(series)) return null;
    const validEntry = series.find(e => e.value !== null && e.value !== undefined);
    return validEntry ? validEntry.value : null;
  }

  get activeIndicators() {
    return this.indicatorMap[this.selectedCategory] || [];
  }

  getIndicatorDescription(key: string): string {
    const translationKey = `common.geoStatistic.indicators.${key}.description`;
    return this.translateOrFallback(translationKey, 'common.geoStatistic.fallback.description');
  }

  getWrappedTextByWidth(text: string, canvasWidth: number, fontSize = 12): string[] {
    const approxCharPerLine = Math.floor(canvasWidth / (fontSize * 0.6));
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach(word => {
      if ((currentLine + ' ' + word).trim().length <= approxCharPerLine) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });

    if (currentLine) lines.push(currentLine);

    return lines;
  }

  getTooltipText(key: string): string {
    const translationKey = `common.geoStatistic.indicators.${key}.tooltip`;
    return this.translateOrFallback(translationKey, 'common.geoStatistic.fallback.tooltip');
  }

  getIndicatorLabel(key: string): string {
    const translationKey = `common.geoStatistic.indicators.${key}.label`;
    return this.translateOrFallback(translationKey, 'common.geoStatistic.fallback.label');
  }

  private translateOrFallback(key: string, fallbackKey: string): string {
    const value = this.translation.t(key);
    return value === key ? this.translation.t(fallbackKey) : value;
  }

  private updateChartLabel(indicatorKey: string): void {
    this.chartData = {
      ...this.chartData,
      datasets: (this.chartData.datasets ?? []).map(dataset => ({
        ...dataset,
        label: this.getIndicatorLabel(indicatorKey)
      }))
    };
  }

  onCategoryChange(newCategory: string) {
    this.selectedCategory = newCategory as IndicatorCategory;
    this.selectedIndicator = null;
    this.chartData = { labels: [], datasets: [] };  // Chart leeren
  }

  onIndicatorSelect(indicator: { key: string }) {
    this.selectedIndicator = indicator;
    this.setChartOptionsForIndicator(indicator.key);

    if (indicator.key === 'temperatureTrend' || indicator.key === 'precipitationTrend') {
      const trendData = indicator.key === 'temperatureTrend'
        ? this.geoStatistic.weatherHistory.temperatureTrend
        : this.geoStatistic.weatherHistory.precipitationTrend;

      if (!trendData || trendData.length === 0) {
        return;
      }

      const labels = trendData.map(e => e.year);
      const data = trendData.map(e => e.value);
      this.chartData = {
        labels,
        datasets: [{
          data,
          label: this.getIndicatorLabel(indicator.key),
          borderColor: indicator.key === 'temperatureTrend' ? '#FF5722' : '#2196F3',
          backgroundColor: indicator.key === 'temperatureTrend' ? 'rgba(255, 87, 34, 0.3)' : 'rgba(33, 150, 243, 0.3)',
          pointBackgroundColor: indicator.key === 'temperatureTrend' ? '#FF5722' : '#2196F3',
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      };
    } else {
      const series = this.geoStatistic.worldBank[indicator.key as WorldBankKey];
      const values = [...series].reverse();
      const labels = values.map(v => v.year);
      const data = values.map(v => v.value ?? 0);
      const colors = this.categoryColors[this.selectedCategory];

      this.chartData = {
        labels,
        datasets: [{
          data,
          label: this.getIndicatorLabel(indicator.key),
          borderColor: colors.border,
          backgroundColor: colors.background,
          pointBackgroundColor: colors.point,
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      };
    }
    this.chart?.update();
  }
}
