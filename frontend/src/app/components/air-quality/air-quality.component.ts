import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  BarController, BarElement,
  CategoryScale, Chart, ChartConfiguration,
  ChartType, Filler, LinearScale,
  ScriptableContext,
  Title, Tooltip
} from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { BaseChartDirective } from 'ng2-charts';
import { Observable, catchError, map, of } from 'rxjs';
import { AirQualityData } from '../../interfaces/air-quality-data';
import { MapService } from '../../services/map.service';
import { NominatimService } from '../../services/nominatim.service';

@Component({
  selector: 'app-air-quality',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    BaseChartDirective,
    MatSliderModule,
    FormsModule
  ],
  templateUrl: './air-quality.component.html',
  styleUrls: ['./air-quality.component.css']
})
export class AirQualityComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  @ViewChild('dialogContent', { static: true }) dialogContentRef!: ElementRef;
  private resizeObserver?: ResizeObserver;
  selectedDayIndex = 0;
  selectedHour: number = new Date().getHours();
  selectedCategory: 'pollen' | 'particulateMatter' | 'pollutants' = 'pollen';
  chartType: ChartType = 'bar';
  chartOptions: ChartConfiguration['options'] = {};
  chartData: ChartConfiguration['data'] = { labels: [], datasets: [] };
  locationName$: Observable<string> | undefined;

  constructor(
    private mapService: MapService,
    private nominatimService: NominatimService,
    private dialogRef: MatDialogRef<AirQualityComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { airQuality: AirQualityData }
  ) {
    Chart.register(BarController, BarElement, LinearScale, CategoryScale, Title, Tooltip, Filler, annotationPlugin);
    this.dialogRef.afterOpened().subscribe(() => {
      setTimeout(() => {
        this.updateChart();
        this.chart?.chart?.resize();
        this.chart?.chart?.update();
      }, 0);
    });
  }

  get airQuality(): AirQualityData | null {
    return this.data.airQuality;
  }

  ngOnInit(): void {
    if (this.selectedDayIndex === 0) {
      this.selectedHour = new Date().getHours();
    } else {
      this.selectedHour = 0;
    }
    this.getLocationName();
  }

  ngAfterViewInit(): void {
    this.resizeObserver = new ResizeObserver(() => {
      this.chart?.chart?.resize();
      this.chart?.chart?.update();
    });
    this.resizeObserver.observe(this.dialogContentRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  get categoryModes(): Array<'pollen' | 'particulateMatter' | 'pollutants'> {
    return ['pollen', 'particulateMatter', 'pollutants'];
  }

  getCategoryKeys(): string[] {
    switch (this.selectedCategory) {
      case 'pollen':
        return ['alder_pollen', 'birch_pollen', 'grass_pollen', 'mugwort_pollen', 'olive_pollen', 'ragweed_pollen'];
      case 'particulateMatter':
        return ['pm10', 'pm2_5'];
      case 'pollutants':
        return ['carbon_monoxide', 'nitrogen_dioxide', 'sulphur_dioxide', 'ozone'];
    }
  }

  getDayLabels(): string[] {
    const uniqueDates = Array.from(new Set(this.airQuality?.hourly.time.map(t => t.split('T')[0]) || []));
    return uniqueDates.map(dateStr => {
      const date = new Date(dateStr);
      const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: '2-digit' };
      return date.toLocaleDateString(undefined, options);
    });
  }

  getDayTimeIndices(dayIndex: number): number[] {
    const uniqueDates = Array.from(new Set(this.airQuality?.hourly.time.map(t => t.split('T')[0]) || []));
    const targetDate = uniqueDates[dayIndex];
    return this.airQuality!.hourly.time
      .map((t, idx) => ({ t, idx }))
      .filter(entry => entry.t.startsWith(targetDate))
      .map(entry => entry.idx);
  }

  updateChart(): void {
    if (!this.airQuality) return;
    const keys = this.getCategoryKeys();
    const timeIndices = this.getDayTimeIndices(this.selectedDayIndex);
    const values = keys.map(k => {
      const arr = (this.airQuality!.hourly as any)[k] as number[];
      return arr[timeIndices[this.selectedHour]];
    });

    this.chartData = {
      labels: keys.map(k => this.getChartLabel(k)),
      datasets: [{
        label: `${this.getCategoryLabel(this.selectedCategory)} Level`,
        data: values,
        borderWidth: 1,
        backgroundColor: (ctx: ScriptableContext<'bar'>) => {
          const chart = ctx.chart;
          const { ctx: canvasCtx, chartArea } = chart;
          if (!chartArea) return '#BDBDBD'; // fallback

          const index = ctx.dataIndex;
          const value = values[index];

          // Dynamischer Gradient je nach Wert
          const gradient = canvasCtx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);

          if (value === 0) {
            gradient.addColorStop(0, '#BDBDBD');
            gradient.addColorStop(1, '#BDBDBD');
          } else if (value <= 10) {
            gradient.addColorStop(0, '#BDBDBD');
            gradient.addColorStop(1, '#4CAF50');
          } else if (value <= 30) {
            gradient.addColorStop(0, '#BDBDBD');
            gradient.addColorStop(0.5, '#4CAF50');
            gradient.addColorStop(1, '#FFEB3B');
          } else if (value <= 50) {
            gradient.addColorStop(0, '#BDBDBD');
            gradient.addColorStop(0.3, '#4CAF50');
            gradient.addColorStop(0.6, '#FFEB3B');
            gradient.addColorStop(1, '#FF9800');
          } else {
            gradient.addColorStop(0, '#BDBDBD');
            gradient.addColorStop(0.25, '#4CAF50');
            gradient.addColorStop(0.5, '#FFEB3B');
            gradient.addColorStop(0.75, '#FF9800');
            gradient.addColorStop(1, '#F44336');
          }

          return gradient;
        }
      }]
    };

    this.chartOptions = {
      indexAxis: 'y',
      scales: {
        x: { beginAtZero: true, ticks: { color: '#ccc' }, grid: { color: '#444' } },
        y: { ticks: { color: '#ccc' }, grid: { color: '#444' } }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: context => `${context.dataset.label}: ${context.parsed.x}`
          }
        }
      },
      responsive: true,
      maintainAspectRatio: false
    };
  }

  getChartLabel(key: string): string {
    const map: Record<string, string> = {
      alder_pollen: 'Alder Pollen',
      birch_pollen: 'Birch Pollen',
      grass_pollen: 'Grass Pollen',
      mugwort_pollen: 'Mugwort Pollen',
      olive_pollen: 'Olive Pollen',
      ragweed_pollen: 'Ragweed Pollen',
      pm10: 'PM10',
      pm2_5: 'PM2.5',
      carbon_monoxide: 'CO',
      nitrogen_dioxide: 'NO₂',
      sulphur_dioxide: 'SO₂',
      ozone: 'Ozone'
    };
    return map[key] || key;
  }

  getCategoryLabel(category: string): string {
    switch (category) {
      case 'pollen': return 'Pollen';
      case 'particulateMatter': return 'Particulate Matter';
      case 'pollutants': return 'Pollutants';
      default: return category;
    }
  }

  getCategoryIcon(category: string): string {
    switch (category) {
      case 'pollen': return 'grass';
      case 'particulateMatter': return 'blur_on';
      case 'pollutants': return 'science';
      default: return 'bar_chart';
    }
  }

  onDayChange(index: number): void {
    this.selectedDayIndex = index;
    this.updateChart();
  }

  onCategoryToggle(category: 'pollen' | 'particulateMatter' | 'pollutants'): void {
    this.selectedCategory = category;
    this.updateChart();
  }

  getLocationName(): void {
    this.locationName$ = this.nominatimService
      .getAddress(this.mapService.getMapLocation().latitude, this.mapService.getMapLocation().longitude)
      .pipe(
        map(res => {
          const addr = res.address;
          const place = addr?.city || addr?.town || addr?.village || addr?.hamlet || 'Unknown';
          const country = addr?.country || '';
          return `${place}${country ? ', ' + country : ''}`;
        }),
        catchError(() => of('Air Quality'))
      );
  }

}