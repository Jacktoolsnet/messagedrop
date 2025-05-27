import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Category } from '../../interfaces/category';
import { GeoStatistic } from '../../interfaces/geo-statistic';
import { Indicator } from '../../interfaces/indicator';

@Component({
  selector: 'app-geo-statistic',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSelectModule
  ],
  templateUrl: './geo-statistic.component.html',
  styleUrl: './geo-statistic.component.css'
})
export class GeoStatisticComponent {
  public geoStatistic: GeoStatistic | undefined = undefined;

  categories: Category[] = [
    { value: 'economy', label: 'Economy' },
    { value: 'social', label: 'Social' },
    { value: 'climate', label: 'Environment' }
  ];

  indicatorMap: { [key: string]: Indicator[] } = {
    economy: [
      { key: 'gdp', label: 'GDP' },
      { key: 'gdpPerCapita', label: 'GDP per Capita' }
    ],
    social: [
      { key: 'lifeExpectancy', label: 'Life Expectancy' },
      { key: 'povertyRate', label: 'Poverty Rate' }
    ],
    climate: [
      { key: 'temperatureTrend', label: 'Temperature Trend' },
      { key: 'precipitationTrend', label: 'Precipitation Trend' }
    ]
  };

  selectedCategory = 'economy';

  constructor(
    public dialogRef: MatDialogRef<GeoStatisticComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { geoStatistic: GeoStatistic }
  ) {
    this.geoStatistic = data.geoStatistic;
  }

  get activeIndicators(): Indicator[] {
    return this.indicatorMap[this.selectedCategory] || [];
  }

  getTooltipText(key: string): string {
    const tooltips: { [key: string]: string } = {
      gdp: 'Gross Domestic Product: total value of goods and services produced.',
      gdpPerCapita: 'GDP divided by population: average income per person.',
      lifeExpectancy: 'Average expected lifespan at birth.',
      povertyRate: 'Percentage of population below the poverty line.',
      temperatureTrend: 'Average yearly temperature over the past decade.',
      precipitationTrend: 'Total yearly precipitation over the past decade.'
    };
    return tooltips[key] || 'Click to view details';
  }

  onIndicatorSelect(indicator: Indicator) {
    console.log('Selected indicator:', indicator.key);
    // TODO: Trigger chart or data update here
  }
}