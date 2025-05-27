import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Category } from '../../interfaces/category';
import { GeoStatistic } from '../../interfaces/geo-statistic';
import { Indicator } from '../../interfaces/indicator';

@Component({
  selector: 'app-geo-statistic',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSelectModule,
    MatExpansionModule
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
      { key: 'gdpPerCapita', label: 'GDP per Capita' },
      { key: 'gniPerCapita', label: 'GNI per Capita' },
      { key: 'militaryExpenditure', label: 'Military Expenditure (% of GDP)' },
      { key: 'governmentSpending', label: 'Government Spending (% of GDP)' },
      { key: 'inflation', label: 'Inflation (Consumer Prices)' },
      { key: 'unemployment', label: 'Unemployment Rate' },
      { key: 'investment', label: 'Investment (% of GDP)' }
    ],
    social: [
      { key: 'lifeExpectancy', label: 'Life Expectancy' },
      { key: 'povertyRate', label: 'Poverty Rate' },
      { key: 'literacyRate', label: 'Literacy Rate' },
      { key: 'primaryEnrollment', label: 'School Enrollment (Primary)' },
      { key: 'secondaryEnrollment', label: 'School Enrollment (Secondary)' },
      { key: 'giniIndex', label: 'Income Inequality (Gini Index)' },
      { key: 'healthExpenditure', label: 'Health Expenditure per Capita' },
      { key: 'urbanPopulation', label: 'Urban Population Share' }
    ],
    climate: [
      { key: 'co2Emissions', label: 'CO₂ Emissions per Capita' },
      { key: 'renewableEnergy', label: 'Renewable Energy (% of total)' },
      { key: 'forestArea', label: 'Forest Area (% of land)' },
      { key: 'airPollution', label: 'Air Pollution (PM2.5)' },
      { key: 'energyUse', label: 'Energy Use per Capita' },
      { key: 'wasteGeneration', label: 'Waste Generation per Capita' },
      { key: 'waterWithdrawal', label: 'Water Withdrawal per Capita' },
      { key: 'temperatureTrend', label: 'Temperature Trend (10 years)' },
      { key: 'precipitationTrend', label: 'Precipitation Trend (10 years)' }
    ]
  };

  selectedCategory = 'economy';
  selectedIndicator: Indicator | null = null;

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
      gniPerCapita: 'Gross National Income per person.',
      militaryExpenditure: 'Percentage of GDP spent on military.',
      governmentSpending: 'Government expenditure as % of GDP.',
      inflation: 'Annual percentage change in consumer prices.',
      unemployment: 'Percentage of labor force without work.',
      investment: 'Gross capital formation as % of GDP.',
      lifeExpectancy: 'Average expected lifespan at birth.',
      povertyRate: 'Percentage of population below the poverty line.',
      literacyRate: 'Percentage of population over 15 that can read and write.',
      primaryEnrollment: 'Primary school enrollment rate.',
      secondaryEnrollment: 'Secondary school enrollment rate.',
      giniIndex: 'Income inequality index (0 = perfect equality, 100 = perfect inequality).',
      healthExpenditure: 'Health spending per capita (in USD).',
      urbanPopulation: 'Percentage of population living in urban areas.',
      co2Emissions: 'CO₂ emissions per capita (metric tons).',
      renewableEnergy: 'Renewable energy as % of total energy consumption.',
      forestArea: 'Percentage of land area covered by forest.',
      airPollution: 'Average exposure to PM2.5 particles.',
      energyUse: 'Energy use per capita (kg oil equivalent).',
      wasteGeneration: 'Municipal waste generated per capita.',
      waterWithdrawal: 'Annual water withdrawal per capita.',
      temperatureTrend: 'Average yearly temperature over past decade.',
      precipitationTrend: 'Total yearly precipitation over past decade.'
    };
    return tooltips[key] || 'Click to view details';
  }

  onIndicatorSelect(indicator: Indicator) {
    this.selectedIndicator = indicator;
    console.log('Selected indicator:', indicator.key);
    // TODO: Trigger chart or data update here
  }
}