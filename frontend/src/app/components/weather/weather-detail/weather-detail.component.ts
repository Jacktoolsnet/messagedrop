import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, Inject, Input, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatSliderModule } from '@angular/material/slider';
import { CategoryScale, Chart, ChartConfiguration, ChartDataset, ChartType, Filler, LinearScale, LineController, LineElement, PointElement, ScriptableContext, Title, Tooltip } from 'chart.js';
import annotationPlugin, { AnnotationOptions } from 'chartjs-plugin-annotation';
import { BaseChartDirective } from 'ng2-charts';
import { Weather } from '../../../interfaces/weather';

@Component({
  selector: 'app-weather-detail',
  imports: [
    CommonModule,
    MatDialogModule,
    BaseChartDirective,
    MatSliderModule,
    FormsModule
  ],
  templateUrl: './weather-detail.component.html',
  styleUrl: './weather-detail.component.css'
})
export class WeatherDetailComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() tile!: any;
  @Input() weather: Weather | null = null;
  @Input() selectedDayIndex = 0;
  @Input() selectedHour = 0;
  @ViewChild(BaseChartDirective) chartCanvas?: BaseChartDirective;

  lineChartType: ChartType = 'line';
  chartOptions: ChartConfiguration['options'] = {};
  tempChartData: ChartConfiguration['data'] = { labels: [], datasets: [] };

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: { weather: Weather }
  ) {
    this.weather = this.data.weather;
    Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Title, Tooltip, Filler, annotationPlugin);
  }

  ngOnInit(): void { }

  ngAfterViewInit(): void { }

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

  private updateChart(): void {
    if (!this.weather) return;

    const selectedDate = this.weather.daily[this.selectedDayIndex].date;
    const dayHourly = this.weather.hourly.filter(h => h.time.startsWith(selectedDate));
    const labels = dayHourly.map(h => h.time.split('T')[1].slice(0, 5));
    const selectedHourStr = this.selectedHour.toString().padStart(2, '12');
    const selectedIndex = dayHourly.findIndex(h => h.time.includes(`T${selectedHourStr}:`));

    let dataset: ChartDataset<'line', number[]> = {
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

    // === Datensätze vorbereiten ===
    switch (this.tile.type) {
      case 'temperature': {
        const temps = dayHourly.map(h => h.temperature);
        const minTemp = Math.min(...temps);
        const maxTemp = Math.max(...temps);
        dataset = {
          ...dataset,
          data: temps,
          label: 'Temperature (°C)',
          pointBackgroundColor: temps.map(t => this.getTemperatureColor(t)),
          segment: {
            borderColor: ctx => this.mixColors(
              this.getTemperatureColor(ctx.p0.parsed.y),
              this.getTemperatureColor(ctx.p1.parsed.y)
            )
          },
          backgroundColor: (ctx: ScriptableContext<'line'>) => {
            const chart = ctx.chart;
            const { ctx: canvasCtx, chartArea } = chart;
            const gradient = canvasCtx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
            gradient.addColorStop(0, this.getTemperatureColor(minTemp));
            gradient.addColorStop(1, this.getTemperatureColor(maxTemp));
            return gradient;
          }
        };
        break;
      }
      case 'uvIndex': {
        const uvs = dayHourly.map(h => h.uvIndex);
        const minUv = Math.min(...uvs);
        const maxUv = Math.max(...uvs);
        dataset = {
          ...dataset,
          data: uvs,
          label: 'UV Index',
          pointBackgroundColor: uvs.map(v => this.getUvColor(v)),
          segment: {
            borderColor: ctx => this.mixColors(
              this.getUvColor(ctx.p0.parsed.y),
              this.getUvColor(ctx.p1.parsed.y)
            )
          },
          backgroundColor: (ctx: ScriptableContext<'line'>) => {
            const chart = ctx.chart;
            const { ctx: canvasCtx, chartArea } = chart;
            const gradient = canvasCtx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
            gradient.addColorStop(0, this.getUvColor(minUv));
            gradient.addColorStop(1, this.getUvColor(maxUv));
            return gradient;
          }
        };
        minY = 0;
        maxY = 11;
        break;
      }
      case 'precipitationprobability': {
        const precipitationProbability = dayHourly.map(h => h.precipitationProbability);
        dataset = {
          ...dataset,
          data: precipitationProbability,
          label: 'Rain chance (%)',
          borderColor: '#42A5F5',
          backgroundColor: 'rgba(66, 165, 245, 0.2)',
          pointBackgroundColor: '#42A5F5'
        };
        minY = 0;
        maxY = 100;
        break;
      }
      case 'precipitation': {
        const precipitation = dayHourly.map(h => h.precipitation);
        dataset = {
          ...dataset,
          data: precipitation,
          label: 'Rainfall (mm/h)',
          borderColor: '#42A5F5',
          backgroundColor: 'rgba(66, 165, 245, 0.2)',
          pointBackgroundColor: '#42A5F5'
        };
        break;
      }
      case 'wind': {
        const winds = dayHourly.map(h => h.wind);
        dataset = {
          ...dataset,
          data: winds,
          label: 'Wind (km/h)',
          borderColor: '#9E9E9E',
          backgroundColor: 'rgba(158, 158, 158, 0.2)',
          pointBackgroundColor: '#9E9E9E'
        };
        minY = 0;
        break;
      }
      case 'pressure': {
        const pressures = dayHourly.map(h => h.pressure);
        dataset = {
          ...dataset,
          data: pressures,
          label: 'Pressure (hPa)',
          borderColor: '#BA68C8',
          backgroundColor: 'rgba(186, 104, 200, 0.2)',
          pointBackgroundColor: '#BA68C8'
        };
        break;
      }
    }

    // === Annotationen ===
    const annotations: Record<string, Partial<AnnotationOptions>> = {
      /*sunrise: {
        type: 'line',
        xMin: this.getHourIndex(this.weather.daily[this.selectedDayIndex].sunrise),
        xMax: this.getHourIndex(this.weather.daily[this.selectedDayIndex].sunrise),
        borderColor: '#FFD700',
        borderWidth: 1,
        /*label: {
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
        /*label: {
          backgroundColor: '#FF4500',
          content: 'Sunset',
          display: true,
          color: '#ffffff',
          position: 'start'
        }
      }*/
    };

    if (selectedIndex !== -1) {
      const value = this.getSelectedChartValue(dayHourly[selectedIndex]);
      const label = labels[selectedIndex];
      let color = this.getAnnotationColorForChart();
      if (this.tile.type === 'temperature') {
        color = this.getTemperatureColor(value);
      } else if (this.tile.type === 'uvIndex') {
        color = this.getUvColor(value);
      }

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

    // === Chart Optionen und Daten setzen ===
    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        annotation: { annotations },
        title: {
          display: true,
          text: this.tile.label,
          color: '#fff',
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
            color: '#ccc',
            maxRotation: 45,
            minRotation: 45
          },
          grid: { color: '#444' },
          title: {
            display: true,
            text: 'Time',
            color: '#fff',
            font: { size: 14, weight: 'bold' }
          }
        },
        y: {
          ticks: { color: '#ccc' },
          grid: { color: '#444' },
          min: minY,
          max: maxY,
          title: {
            display: true,
            text: this.getSelectedChartUnit(),
            color: '#fff',
            font: { size: 14, weight: 'bold' }
          }
        }
      }
    };

    this.tempChartData = { labels, datasets: [dataset] };
    this.chartCanvas?.update();
  }

  /*private getHourIndex(time: string): number {
    const hour = +time.split('T')[1].split(':')[0];
    return this.weather?.hourly.findIndex(h =>
      h.time.includes(`T${hour.toString().padStart(2, '0')}:`)
    ) ?? -1;
  }*/

  private getSelectedChartValue(hourData: any): number {
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
    console.log(this.tile.type)
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

  getAnnotationColorForChart(): string {
    switch (this.tile.type) {
      case 'temperature': return '#EF5350';
      case 'precipitationprobability': return '#42A5F5';
      case 'precipitation': return '#42A5F5';
      case 'uvIndex': return '#AB47BC';
      case 'wind': return '#9E9E9E';
      case 'pressure': return '#BA68C8';
      default: return '#FF4081'; // fallback pink
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
        .map(x => {
          const hex = x.toString(16);
          return hex.length === 1 ? '0' + hex : hex;
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
    if (temp <= 0) return '#1565C0'; // dunkles Blau für Frost
    if (temp <= 10) return '#42A5F5'; // helles Blau für kühl
    if (temp <= 20) return '#66BB6A'; // grün für mild
    if (temp <= 30) return '#FFA726'; // orange für warm
    return '#EF5350'; // rot für heiß
  }

  getUvColor(uv: number): string {
    if (uv <= 2) return '#4CAF50'; // grün
    if (uv <= 5) return '#FFEB3B'; // gelb
    if (uv <= 7) return '#FF9800'; // orange
    if (uv <= 10) return '#F44336'; // rot
    return '#9C27B0'; // violett
  }

  moveSelectedHourAnnotation(): void {
    const chart = this.chartCanvas?.chart;
    if (!chart) return;

    const selectedDate = this.weather!.daily[this.selectedDayIndex].date;
    const dayHourly = this.weather!.hourly.filter(h => h.time.startsWith(selectedDate));
    const labels = dayHourly.map(h => h.time.split('T')[1].slice(0, 5));
    const selectedHourStr = this.selectedHour.toString().padStart(2, '0');
    const selectedIndex = dayHourly.findIndex(h => h.time.includes(`T${selectedHourStr}:`));
    if (selectedIndex === -1) return;

    const labelTime = labels[selectedIndex];
    const value = this.getSelectedChartValue(dayHourly[selectedIndex]);
    let color = this.getAnnotationColorForChart();
    if (this.tile.type === 'temperature') {
      color = this.getTemperatureColor(value);
    } else if (this.tile.type === 'uvIndex') {
      color = this.getUvColor(value);
    }

    const annotations = (chart.options.plugins?.annotation?.annotations ?? {}) as any;

    if (!annotations.selectedHour) {
      annotations.selectedHour = {
        type: 'line',
        xMin: labelTime,
        xMax: labelTime,
        yMin: value,
        yMax: value + 0.01,
        borderColor: color,
        borderWidth: 3,
        label: {
          display: true,
          content: `${labelTime}: ${value}${this.getSelectedChartUnit()}`,
          backgroundColor: color,
          color: '#000000',
          position: 'start'
        }
      };
    } else {
      annotations.selectedHour.xMin = labelTime;
      annotations.selectedHour.xMax = labelTime;
      annotations.selectedHour.yMin = value;
      annotations.selectedHour.yMax = value + 0.01;
      annotations.selectedHour.label.content = `${labelTime}: ${value}${this.getSelectedChartUnit()}`;
      annotations.selectedHour.label.backgroundColor = color;
    }

    chart.update('none');
  }
}
