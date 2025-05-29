import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  CategoryScale, Chart, ChartConfiguration, ChartType,
  Filler,
  LinearScale, LineController, LineElement, PointElement, Title, Tooltip
} from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
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
    BaseChartDirective
  ],
  templateUrl: './geo-statistic.component.html',
  styleUrl: './geo-statistic.component.css'
})
export class GeoStatisticComponent {
  public geoStatistic: GeoStatistic | undefined;
  selectedCategory = 'economy';
  selectedIndicator: { key: string; label: string } | null = null;

  categories = [
    { value: 'economy', label: 'Economy' },
    { value: 'social', label: 'Social' },
    { value: 'climate', label: 'Environment' }
  ];

  // Original complete map
  fullIndicatorMap: { [key: string]: { key: string; label: string }[] } = {
    economy: [
      { key: 'gdp', label: 'GDP' },
      { key: 'gdpPerCapita', label: 'GDP per Capita' },
      { key: 'militaryExpenditure', label: 'Military Expenditure' },
      { key: 'governmentSpending', label: 'Government Spending' },
      { key: 'inflation', label: 'Inflation' },
      { key: 'unemployment', label: 'Unemployment' },
      { key: 'investment', label: 'Investment' }
    ],
    social: [
      { key: 'lifeExpectancy', label: 'Life Expectancy' },
      { key: 'povertyRate', label: 'Poverty Rate' },
      { key: 'literacyRate', label: 'Literacy Rate' },
      { key: 'primaryEnrollment', label: 'Primary Enrollment' },
      { key: 'secondaryEnrollment', label: 'Secondary Enrollment' },
      { key: 'giniIndex', label: 'Gini Index' }
    ],
    climate: [
      { key: 'co2Emissions', label: 'CO₂ Emissions' },
      { key: 'renewableEnergy', label: 'Renewable Energy' },
      { key: 'forestArea', label: 'Forest Area' },
      { key: 'airPollution', label: 'Air Pollution' },
      { key: 'energyUse', label: 'Energy Use' },
      { key: 'temperatureTrend', label: 'Temperature Trend' },
      { key: 'precipitationTrend', label: 'Precipitation Trend' }
    ]
  };

  // Filtered map (only those with available data)
  indicatorMap: { [key: string]: { key: string; label: string }[] } = {};

  chartData: ChartConfiguration['data'] = { labels: [], datasets: [] };
  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: { display: true },
      tooltip: { enabled: true }
    },
    scales: {
      x: { ticks: { color: '#ccc' }, grid: { color: '#444' } },
      y: { ticks: { color: '#ccc' }, grid: { color: '#444' } }
    }
  };
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
      Tooltip
    );

    // Build filtered indicators
    this.buildIndicatorMap();
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

    const firstAvailable = this.indicatorMap[this.selectedCategory]?.[0];
    if (firstAvailable) {
      this.onIndicatorSelect(firstAvailable);
    }
  }

  firstValidValue(series: { year: string; value: number | null }[] | undefined): number | null {
    if (!series || !Array.isArray(series)) return null;
    const validEntry = series.find(e => e.value !== null && e.value !== undefined);
    return validEntry ? validEntry.value : null;
  }

  get activeIndicators() {
    return this.indicatorMap[this.selectedCategory] || [];
  }

  getTooltipText(key: string): string {
    const tooltips: { [key: string]: string } = {
      gdp: 'Gross Domestic Product over time.',
      gdpPerCapita: 'GDP divided by population over time.',
      militaryExpenditure: 'Military spending over time.',
      governmentSpending: 'Government spending as % of GDP.',
      inflation: 'Consumer price inflation rate.',
      unemployment: 'Unemployment rate.',
      investment: 'Gross capital formation.',
      lifeExpectancy: 'Average lifespan.',
      povertyRate: 'Percentage below poverty line.',
      literacyRate: 'Adult literacy rate.',
      primaryEnrollment: 'Primary school enrollment.',
      secondaryEnrollment: 'Secondary school enrollment.',
      giniIndex: 'Income inequality index.',
      co2Emissions: 'Per capita CO₂ emissions.',
      renewableEnergy: 'Share of renewable energy.',
      forestArea: 'Percentage of land area forested.',
      airPollution: 'Average PM2.5 air pollution.',
      energyUse: 'Energy use per capita.',
      temperatureTrend: 'Historical average temperatures.',
      precipitationTrend: 'Historical precipitation sums.'
    };
    return tooltips[key] || 'Click to view details';
  }

  onIndicatorSelect(indicator: { key: string; label: string }) {
    this.selectedIndicator = indicator;
    if (!this.geoStatistic) return;

    if (indicator.key === 'temperatureTrend' || indicator.key === 'precipitationTrend') {
      const trendData = indicator.key === 'temperatureTrend'
        ? this.geoStatistic.weatherHistory.temperatureTrend
        : this.geoStatistic.weatherHistory.precipitationTrend;

      if (!trendData || trendData.length === 0) {
        console.warn('No weather trend data available for', indicator.key);
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
      this.chartData = {
        labels,
        datasets: [{
          data,
          label: indicator.label,
          borderColor: '#4CAF50',
          backgroundColor: 'rgba(76, 175, 80, 0.3)',
          pointBackgroundColor: '#4CAF50',
          tension: 0.3,
          fill: true,
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      };
    }
  }
}