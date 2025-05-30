import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltip } from '@angular/material/tooltip';
import {
  CategoryScale, Chart, ChartConfiguration, ChartDataset, ChartType, Filler, LinearScale, LineController, LineElement,
  PointElement,
  ScriptableContext,
  Title, Tooltip
} from 'chart.js';
import annotationPlugin, { AnnotationOptions } from 'chartjs-plugin-annotation';
import { BaseChartDirective } from 'ng2-charts';
import { catchError, debounceTime, fromEvent, map, Observable, of, Subscription } from 'rxjs';
import { GetNominatimAddressResponse } from '../../interfaces/get-nominatim-address-response copy';
import { Weather } from '../../interfaces/weather';
import { MapService } from '../../services/map.service';
import { NominatimService } from '../../services/nominatim.service';

@Component({
  selector: 'app-weather',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIcon,
    MatTooltip,
    BaseChartDirective,
    MatSliderModule,
    FormsModule
  ],
  templateUrl: './weather.component.html',
  styleUrls: ['./weather.component.css']
})
export class WeatherComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  @ViewChild('dialogContent', { static: true }) dialogContentRef!: ElementRef;

  private resizeObserver?: ResizeObserver;
  private windowResizeSub?: Subscription;

  selectedDayIndex = 0;
  selectedHour: number = new Date().getHours();
  weather: Weather | null = null;

  selectedChart: 'temperature' | 'precipitation' | 'uvIndex' | 'wind' | 'pressure' = 'temperature';
  chartModes: Array<'temperature' | 'precipitation' | 'uvIndex' | 'wind' | 'pressure'> = ['temperature', 'precipitation', 'uvIndex', 'wind', 'pressure'];
  lineChartType: ChartType = 'line';
  chartOptions: ChartConfiguration['options'] = {};
  tempChartData: ChartConfiguration['data'] = { labels: [], datasets: [] };

  locationName$: Observable<string> | undefined;

  constructor(
    private mapService: MapService,
    private nomatinService: NominatimService,
    private dialogRef: MatDialogRef<WeatherComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { weather: Weather }
  ) {
    this.weather = this.data.weather;
    console.log('Weather data:', this.weather);
    Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Filler, annotationPlugin);

    this.dialogRef.afterOpened().subscribe(() => {
      setTimeout(() => {
        this.updateChart();
        this.chart?.chart?.resize();
        this.chart?.chart?.update();
      }, 0);
    });
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
      this.updateChartSize();
    });
    this.resizeObserver.observe(this.dialogContentRef.nativeElement);

    this.windowResizeSub = fromEvent(window, 'resize')
      .pipe(debounceTime(200))
      .subscribe(() => {
        this.updateChartSize();
      });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.windowResizeSub?.unsubscribe();
  }

  private updateChartSize() {
    this.chart?.chart?.resize();
    this.chart?.chart?.update();
  }

  onDayChange(index: number): void {
    this.selectedDayIndex = index;
    if (index === 0) {
      this.selectedHour = new Date().getHours();
    } else {
      const selectedDate = this.weather?.daily[index].date ?? '';
      const dayHourly = this.weather?.hourly.filter(h => h.time.startsWith(selectedDate));
      if (dayHourly && dayHourly.length > 0) {
        const firstHour = +dayHourly[0].time.split('T')[1].split(':')[0];
        this.selectedHour = firstHour;
      } else {
        this.selectedHour = 0;
      }
    }
    this.updateChart();
  }

  onHourChange(): void {
    this.moveSelectedHourAnnotation();
  }

  onChartToggle(type: 'temperature' | 'precipitation' | 'uvIndex' | 'wind' | 'pressure'): void {
    this.selectedChart = type;
    this.updateChart();
  }

  private updateChart(): void {
    let dataset: ChartDataset<'line', number[]> = {
      data: [],
      label: '',
      borderColor: '',
      backgroundColor: ''
    };

    if (!this.weather) return;

    const selectedDate = this.weather.daily[this.selectedDayIndex].date;
    const dayHourly = this.weather.hourly.filter(h => h.time.startsWith(selectedDate));
    const labels = dayHourly.map(h => h.time.split('T')[1].slice(0, 5));

    // Dynamische Farbe je nach Modus (klarer switch)
    let color: string;
    switch (this.selectedChart) {
      case 'temperature':
        color = '#EF5350'; // Rot
        break;
      case 'precipitation':
        color = '#42A5F5'; // Blau
        break;
      case 'uvIndex':
        color = '#AB47BC'; // Lila
        break;
      case 'wind':
        color = '#9E9E9E'; // Grau
        break;
      case 'pressure':
        color = '#BA68C8'; // Flieder
        break;
      default:
        color = '#FF4081'; // Fallback pink (falls was Unerwartetes passiert)
        break;
    }

    const annotations: Record<string, Partial<AnnotationOptions>> = {
      sunrise: {
        type: 'line',
        xMin: this.getHourIndex(this.weather.daily[this.selectedDayIndex].sunrise),
        xMax: this.getHourIndex(this.weather.daily[this.selectedDayIndex].sunrise),
        borderColor: '#FFD700',
        borderWidth: 1,
        label: {
          backgroundColor: '#FFD700',
          content: 'Sunrise',
          display: true,
          color: '#333333',
          position: 'end'
        }
      },
      sunset: {
        type: 'line',
        xMin: this.getHourIndex(this.weather.daily[this.selectedDayIndex].sunset),
        xMax: this.getHourIndex(this.weather.daily[this.selectedDayIndex].sunset),
        borderColor: '#FF4500',
        borderWidth: 1,
        label: {
          backgroundColor: '#FF4500',
          content: 'Sunset',
          display: true,
          color: '#ffffff',
          position: 'start'
        }
      }
    };

    const selectedHourStr = this.selectedHour.toString().padStart(2, '0');
    const selectedIndex = dayHourly.findIndex(h => h.time.includes(`T${selectedHourStr}:`));

    if (selectedIndex !== -1) {
      const valueForHour = this.getSelectedChartValue(dayHourly[selectedIndex]);
      const labelTime = labels[selectedIndex];
      annotations['selectedHour'] = {
        type: 'line',
        xMin: labelTime,
        xMax: labelTime,
        yMin: valueForHour,
        yMax: valueForHour + 0.01,
        borderColor: color,
        borderWidth: 3,
        label: {
          display: true,
          content: `${labelTime}: ${valueForHour}${this.getSelectedChartUnit()}`,
          backgroundColor: color,
          color: '#000000',
          position: 'start'
        }
      };
    }

    // ---- Dataset Setup ----
    if (this.selectedChart === 'temperature') {
      dataset = {
        data: dayHourly.map(h => h.temperature),
        label: 'Temperature (°C)',
        borderColor: '#EF5350',
        backgroundColor: 'rgba(239, 83, 80, 0.2)',
        tension: 0.3,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#EF5350'
      };
    } else if (this.selectedChart === 'precipitation') {
      dataset = {
        data: dayHourly.map(h => h.precipitationProbability),
        label: 'Precipitation Probability (%)',
        borderColor: '#42A5F5',
        backgroundColor: 'rgba(66, 165, 245, 0.2)',
        tension: 0.3,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#42A5F5'
      };
    } else if (this.selectedChart === 'uvIndex') {
      const uvValues = dayHourly.map(h => h.uvIndex);
      dataset = {
        data: uvValues,
        label: 'UV Index',
        borderColor: '#AB47BC',
        backgroundColor: (ctx: ScriptableContext<'line'>) => {
          const chart = ctx.chart;
          const { ctx: canvasCtx, chartArea } = chart;
          const gradient = canvasCtx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
          gradient.addColorStop(0, 'rgba(0,0,0,0)');
          gradient.addColorStop(0.2, '#FFEB3B');
          gradient.addColorStop(0.5, '#FF9800');
          gradient.addColorStop(1.0, '#AB47BC');
          return gradient;
        },
        tension: 0.4,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: uvValues.map(v => this.getUvColor(v))
      };
    } else if (this.selectedChart === 'wind') {
      dataset = {
        data: dayHourly.map(h => h.wind),
        label: 'Wind (km/h)',
        borderColor: '#9E9E9E',
        backgroundColor: 'rgba(158, 158, 158, 0.2)',
        tension: 0.3,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#9E9E9E'
      };
    } else if (this.selectedChart === 'pressure') {
      dataset = {
        data: dayHourly.map(h => h.pressure),
        label: 'Pressure (hPa)',
        borderColor: '#BA68C8',
        backgroundColor: 'rgba(186, 104, 200, 0.2)',
        tension: 0.3,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: '#BA68C8'
      };
    }

    this.chartOptions!.plugins = { ...(this.chartOptions!.plugins ?? {}), annotation: { annotations } };
    this.chartOptions!.scales = {
      x: { ticks: { color: '#ccc' }, grid: { color: '#444' } },
      y: {
        ticks: { color: '#ccc' },
        grid: { color: '#444' },
        min:
          this.selectedChart === 'uvIndex'
            ? 0
            : this.selectedChart === 'precipitation'
              ? 0
              : this.selectedChart === 'wind'
                ? 0
                : undefined,
        max:
          this.selectedChart === 'uvIndex'
            ? 11
            : this.selectedChart === 'precipitation'
              ? 100
              : undefined
      }
    };

    this.tempChartData = { labels, datasets: [dataset] };
  }

  private getHourIndex(time: string): number {
    const hour = +time.split('T')[1].split(':')[0];
    return this.weather?.hourly.findIndex(h =>
      h.time.includes(`T${hour.toString().padStart(2, '0')}:`)
    ) ?? -1;
  }

  private getSelectedChartValue(hourData: any): number {
    switch (this.selectedChart) {
      case 'temperature': return hourData.temperature;
      case 'precipitation': return hourData.precipitationProbability;
      case 'uvIndex': return hourData.uvIndex;
      case 'wind': return hourData.wind;
      case 'pressure': return hourData.pressure;
      default: return 0;
    }
  }

  private getSelectedChartUnit(): string {
    switch (this.selectedChart) {
      case 'temperature': return '°C';
      case 'precipitation': return '%';
      case 'uvIndex': return '';
      case 'wind': return ' km/h';
      case 'pressure': return ' hPa';
      default: return '';
    }
  }

  getDayLabel(index: number): string {
    const date = new Date(this.weather!.daily[index].date);
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: '2-digit' };
    return date.toLocaleDateString(undefined, options);
  }

  getChartLabel(mode: 'temperature' | 'precipitation' | 'uvIndex' | 'wind' | 'pressure'): string {
    switch (mode) {
      case 'temperature': return 'Temperature';
      case 'precipitation': return 'Precipitation Probability';
      case 'uvIndex': return 'UV Index';
      case 'wind': return 'Wind Speed';
      case 'pressure': return 'Pressure';
    }
  }

  getChartIcon(mode: 'temperature' | 'precipitation' | 'uvIndex' | 'wind' | 'pressure'): string {
    switch (mode) {
      case 'temperature': return 'thermostat';
      case 'precipitation': return 'water_drop';
      case 'uvIndex': return 'light_mode';
      case 'wind': return 'air';
      case 'pressure': return 'compress';
    }
  }

  getUvColor(uv: number): string {
    if (uv <= 2) return '#4CAF50';
    if (uv <= 5) return '#FFEB3B';
    if (uv <= 7) return '#FF9800';
    if (uv <= 10) return '#F44336';
    return '#9C27B0';
  }

  getWeatherIconClass(code: number): string {
    switch (code) {
      case 0: return 'wi-day-sunny';
      case 1: return 'wi-day-sunny-overcast';
      case 2: return 'wi-day-cloudy';
      case 3: return 'wi-cloudy';
      case 45: return 'wi-fog';
      case 51: return 'wi-sprinkle';
      case 61: return 'wi-rain';
      case 71: return 'wi-snow';
      default: return 'wi-na';
    }
  }

  getLocationName(): void {
    this.locationName$ = this.nomatinService
      .getAddress(this.mapService.getMapLocation().latitude, this.mapService.getMapLocation().longitude)
      .pipe(
        map((res: GetNominatimAddressResponse) => {
          const addr = res.address;
          const place = addr?.city || addr?.town || addr?.village || addr?.hamlet || 'Unknown place';
          const country = addr?.country || '';
          return `Weather for ${place}${country ? ', ' + country : ''}`;
        }),
        catchError(() => of('Weather'))
      );
  }

  moveSelectedHourAnnotation(): void {
    const chartInstance = this.chart?.chart;
    if (!chartInstance) return;

    const pluginOptions = chartInstance.options.plugins?.annotation;
    if (!pluginOptions) {
      console.warn('Annotation plugin is not configured.');
      return;
    }

    if (!pluginOptions.annotations) {
      pluginOptions.annotations = {};
    }

    const annotations = pluginOptions.annotations as Record<string, Partial<AnnotationOptions>>;
    const selectedDate = this.weather!.daily[this.selectedDayIndex].date;
    const dayHourly = this.weather!.hourly.filter(h => h.time.startsWith(selectedDate));
    const labels = dayHourly.map(h => h.time.split('T')[1].slice(0, 5));
    const selectedHourStr = this.selectedHour.toString().padStart(2, '0');
    const selectedIndex = dayHourly.findIndex(h => h.time.includes(`T${selectedHourStr}:`));

    if (selectedIndex !== -1) {
      const valueForHour = this.getSelectedChartValue(dayHourly[selectedIndex]);
      const labelTime = labels[selectedIndex];

      // Dynamische Farbe je nach Chart-Modus
      let color = '#FF4081'; // Default pink/rot
      switch (this.selectedChart) {
        case 'temperature':
          color = '#EF5350'; // Rot
          break;
        case 'precipitation':
          color = '#42A5F5'; // Blau
          break;
        case 'uvIndex':
          color = '#AB47BC'; // Lila
          break;
        case 'wind':
          color = '#9E9E9E'; // Grau
          break;
        case 'pressure':
          color = '#BA68C8'; // Flieder
          break;
      }

      annotations['selectedHour'] = {
        type: 'line',
        xMin: labelTime,
        xMax: labelTime,
        yMin: valueForHour,
        yMax: valueForHour + 0.01,
        borderColor: color,
        borderWidth: 3,
        label: {
          display: true,
          content: `${labelTime}: ${valueForHour}${this.getSelectedChartUnit()}`,
          backgroundColor: color,
          color: '#000000',
          position: 'start'
        }
      };

      chartInstance.update('none'); // update without animation
    }
  }
}