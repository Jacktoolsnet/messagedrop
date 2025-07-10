import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CategoryScale, Chart, ChartConfiguration, ChartType,
  Filler,
  LinearScale, LineController, LineElement, PointElement, SubTitle, Title, Tooltip
} from 'chart.js';
import { debounceTime, fromEvent, Subscription } from 'rxjs';
import { GeoStatistic } from '../../interfaces/geo-statistic';
type WorldBankKey = keyof GeoStatistic['worldBank'];

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
    MatTooltipModule
  ],
  templateUrl: './geo-statistic.component.html',
  styleUrl: './geo-statistic.component.css'
})
export class GeoStatisticComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('chartCanvas', { static: true }) chartCanvas!: ElementRef<HTMLCanvasElement>;
  private chart!: Chart;
  @ViewChild('dialogContent', { static: true }) dialogContentRef!: ElementRef;
  private resizeObserver?: ResizeObserver;
  private windowResizeSub?: Subscription;

  public geoStatistic: GeoStatistic | undefined;
  selectedCategory = 'economy';
  selectedIndicator: { key: string; label: string } | null = null;
  currentIndicatorDescription: string = '';
  public isSmallScreen = false;

  categories = [
    { value: 'economy', label: 'Economy' },
    { value: 'social', label: 'Social' },
    { value: 'climate', label: 'Environment' }
  ];

  // Original complete map
  fullIndicatorMap: { [key: string]: { key: string; label: string }[] } = {
    economy: [
      { key: 'gdp', label: 'GDP (USD)' },
      { key: 'gdpPerCapita', label: 'GDP per Capita (USD)' },
      { key: 'militaryExpenditure', label: 'Military Expenditure (USD)' },
      { key: 'governmentSpending', label: 'Government Spending (USD)' },
      { key: 'inflation', label: 'Inflation (%)' },
      { key: 'unemployment', label: 'Unemployment (%)' },
      { key: 'investment', label: 'Investment (USD)' }
    ],
    social: [
      { key: 'lifeExpectancy', label: 'Life Expectancy (years)' },
      { key: 'povertyRate', label: 'Poverty (absolute number)' },
      { key: 'literacyRate', label: 'Literacy Rate (%)' },
      { key: 'primaryEnrollment', label: 'Primary Enrollment (%)' },
      { key: 'secondaryEnrollment', label: 'Secondary Enrollment (%)' },
      { key: 'giniIndex', label: 'Gini Index' }
    ],
    climate: [
      { key: 'co2Emissions', label: 'CO₂ Emissions (kilotons)' },
      { key: 'renewableEnergy', label: 'Renewable Energy (absolute)' },
      { key: 'forestArea', label: 'Forest Area (%)' },
      { key: 'airPollution', label: 'Air Pollution (PM2.5 µg/m³)' },
      { key: 'energyUse', label: 'Energy Use (kg oil equivalent per capita)' },
      { key: 'temperatureTrend', label: 'Temperature Trend (°C)' },
      { key: 'precipitationTrend', label: 'Precipitation Trend (mm)' }
    ]
  };

  categoryColors: { [key: string]: { border: string; background: string; point: string } } = {
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

  indicatorUnits: { [key: string]: string } = {
    gdp: 'USD',
    gdpPerCapita: 'USD per person',
    militaryExpenditure: 'USD',
    governmentSpending: 'USD',
    inflation: '%',
    unemployment: '%',
    investment: 'USD',
    lifeExpectancy: 'years',
    povertyRate: 'people',
    literacyRate: '%',
    primaryEnrollment: '%',
    secondaryEnrollment: '%',
    giniIndex: '',  // kein direktes Einheitssuffix
    co2Emissions: 'kilotons',
    renewableEnergy: 'MWh',
    forestArea: '%',
    airPollution: 'µg/m³',
    energyUse: 'kg oil eq. per capita',
    temperatureTrend: '°C',
    precipitationTrend: 'mm'
  };

  // Filtered map (only those with available data)
  indicatorMap: { [key: string]: { key: string; label: string }[] } = {};

  lineChartType: ChartType = 'line';
  chartData: ChartConfiguration['data'] = { labels: [], datasets: [] };
  chartOptions: ChartConfiguration['options'] = {};
  chartType: ChartType = 'line';

  constructor(
    public dialogRef: MatDialogRef<GeoStatisticComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { geoStatistic: GeoStatistic }
  ) {
    this.geoStatistic = data.geoStatistic;

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

  ngOnInit(): void { }

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
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.windowResizeSub?.unsubscribe();
  }

  private updateChartSize() {
    this.chart?.resize();
    this.chart?.update();
  }

  checkScreenSize() {
    this.isSmallScreen = window.innerWidth < 600;
  }

  buildIndicatorMap() {
    if (!this.geoStatistic) return;

    const weatherKeys = ['temperatureTrend', 'precipitationTrend'] as const;
    const resultMap: { [key: string]: { key: string; label: string }[] } = {};

    Object.keys(this.fullIndicatorMap).forEach(category => {
      resultMap[category] = this.fullIndicatorMap[category].filter(indicator => {
        const isWeatherKey = weatherKeys.includes(indicator.key as typeof weatherKeys[number]);
        const data = isWeatherKey
          ? (this.geoStatistic?.weatherHistory as any)[indicator.key]
          : this.geoStatistic?.worldBank[indicator.key as WorldBankKey];

        return Array.isArray(data) && data.some(item => item?.value !== null && item?.value !== undefined);
      });
    });

    this.indicatorMap = resultMap;
  }

  setChartOptionsForIndicator(indicatorKey: string) {
    const unit = this.indicatorUnits[indicatorKey] || '';
    const locale = navigator.language;
    const allIndicators = Object.values(this.fullIndicatorMap).flat();
    const indicator = allIndicators.find(i => i.key === indicatorKey);
    const label = indicator ? indicator.label : indicatorKey;
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
            callback: function (value) {
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
            text: 'Years',
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
    const descriptions: { [key: string]: string } = {
      gdp: 'Gross Domestic Product (GDP) represents the total value of all goods and services produced within a country.',
      gdpPerCapita: 'GDP per capita is the average economic output per person, calculated by dividing GDP by the total population.',
      militaryExpenditure: 'Total military spending in absolute terms, covering equipment, personnel, and operations.',
      governmentSpending: 'Total government expenditure in absolute values, including healthcare, education, defense, and infrastructure.',
      inflation: 'Annual percentage change in the average consumer price level, reflecting the cost of living.',
      unemployment: 'Percentage of the labor force that is unemployed and actively seeking work.',
      investment: 'Gross capital formation, representing investments in infrastructure, machinery, and other assets.',
      lifeExpectancy: 'The average number of years a person is expected to live at birth.',
      povertyRate: 'Total number of people living below the international poverty line.',
      literacyRate: 'Percentage of adults (15 years and older) who can read and write.',
      primaryEnrollment: 'Percentage of children of official primary school age enrolled in school.',
      secondaryEnrollment: 'Percentage of youth of official secondary school age enrolled in secondary education.',
      giniIndex: 'A measure of income inequality where 0 indicates perfect equality and 100 indicates maximal inequality.',
      co2Emissions: 'Total annual CO₂ emissions measured in kilotons, reflecting the environmental impact.',
      renewableEnergy: 'Absolute amount of renewable energy used, including wind, solar, and hydroelectric sources.',
      forestArea: 'Percentage of total land area covered by forests.',
      airPollution: 'Average concentration of fine particulate matter (PM2.5) in micrograms per cubic meter.',
      energyUse: 'Average energy consumption per person, measured in kilograms of oil equivalent.',
      temperatureTrend: 'Average annual temperature trends over time in degrees Celsius.',
      precipitationTrend: 'Total annual precipitation sums over time, measured in millimeters.'
    };

    return descriptions[key] || 'No description available for this indicator.';
  }

  getWrappedTextByWidth(text: string, canvasWidth: number, fontSize: number = 12): string[] {
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
    const tooltips: { [key: string]: string } = {
      gdp: 'Gross Domestic Product (GDP) in absolute USD over time.',
      gdpPerCapita: 'GDP divided by total population (USD per person).',
      militaryExpenditure: 'Total military spending in USD over time.',
      governmentSpending: 'Total government expenditure in USD over time.',
      inflation: 'Annual consumer price inflation rate (%).',
      unemployment: 'Percentage of the labor force unemployed (%).',
      investment: 'Gross capital formation in USD over time.',
      lifeExpectancy: 'Average expected lifespan at birth (years).',
      povertyRate: 'Number of people living below the poverty line.',
      literacyRate: 'Adult literacy rate (% of population aged 15 and above).',
      primaryEnrollment: 'Primary school enrollment rate (% of eligible children).',
      secondaryEnrollment: 'Secondary school enrollment rate (% of eligible youth).',
      giniIndex: 'Gini Index measuring income inequality (0 = equality, 100 = inequality).',
      co2Emissions: 'Total CO₂ emissions in kilotons per year.',
      renewableEnergy: 'Absolute amount of renewable energy used.',
      forestArea: 'Percentage of land area covered by forests (%).',
      airPollution: 'Average PM2.5 air pollution concentration (µg/m³).',
      energyUse: 'Energy use per capita (kg of oil equivalent).',
      temperatureTrend: 'Historical yearly average temperatures (°C).',
      precipitationTrend: 'Historical yearly total precipitation (mm).'
    };
    return tooltips[key] || 'Click to view details';
  }

  onCategoryChange(newCategory: string) {
    this.selectedCategory = newCategory;
    this.selectedIndicator = null;
    this.chartData = { labels: [], datasets: [] };  // Chart leeren
  }

  onIndicatorSelect(indicator: { key: string; label: string }) {
    this.selectedIndicator = indicator;
    this.setChartOptionsForIndicator(indicator.key);
    if (!this.geoStatistic) return;

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
          label: indicator.label,
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
      const wb = this.geoStatistic.worldBank;
      const series = wb[indicator.key as WorldBankKey];
      const values = Array.isArray(series) ? series : [series];
      const labels = values.map(v => v.year).reverse();
      const data = values.map(v => v.value ?? 0).reverse();
      const colors = this.categoryColors[this.selectedCategory];

      this.chartData = {
        labels,
        datasets: [{
          data,
          label: indicator.label,
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