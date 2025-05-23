import { CommonModule } from '@angular/common';
import { Component, OnInit, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import {
  CategoryScale, Chart, ChartConfiguration,
  ChartType,
  Filler, LinearScale, LineController, LineElement, PointElement,
  Title, Tooltip
} from 'chart.js';
import annotationPlugin, { AnnotationOptions } from 'chartjs-plugin-annotation';
import { BaseChartDirective } from 'ng2-charts';
import { Weather } from '../../interfaces/weather';
import { MapService } from '../../services/map.service';
import { UserService } from '../../services/user.service';
import { WeatherService } from '../../services/weather.service';

@Component({
  selector: 'app-weather',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    BaseChartDirective
  ],
  templateUrl: './weather.component.html',
  styleUrls: ['./weather.component.css']
})
export class WeatherComponent implements OnInit {

  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;
  selectedDayIndex = 0;
  weather: Weather | null = null;
  selectedChart: 'temperature' | 'precipitation' = 'temperature';
  chartModes: Array<'temperature' | 'precipitation'> = ['temperature', 'precipitation'];

  loading = true;

  lineChartType: ChartType = 'line';
  chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        enabled: true,
        backgroundColor: '#333',
        titleColor: '#fff',
        bodyColor: '#eee'
      }
    },
    scales: {
      x: {
        ticks: { color: '#ccc' },
        grid: { color: '#444' }
      },
      y: {
        ticks: { color: '#ccc' },
        grid: { color: '#444' }
      }
    }
  };

  tempChartData: ChartConfiguration['data'] = {
    labels: [],
    datasets: []
  };

  constructor(
    private userService: UserService,
    private weatherService: WeatherService,
    private mapService: MapService,
    private dialogRef: MatDialogRef<WeatherComponent>
  ) {
    Chart.register(
      LineController,
      LineElement,
      PointElement,
      LinearScale,
      CategoryScale,
      Title,
      Tooltip,
      Filler,
      annotationPlugin
    );
  }

  ngOnInit(): void {
    const location = this.mapService.getMapLocation();
    this.weatherService
      .getWeather(
        this.userService.getUser().language?.slice(0, 2) || 'de',
        location.latitude,
        location.longitude,
        3
      )
      .subscribe({
        next: (res) => {
          this.weather = res;
          this.loading = false;
          this.updateChart();
        },
        error: () => {
          this.loading = false;
        }
      });
  }

  getDayLabel(index: number): string {
    const date = new Date(this.weather!.daily[index].date);
    const options: Intl.DateTimeFormatOptions = { weekday: 'short', day: '2-digit', month: '2-digit' };
    return date.toLocaleDateString(undefined, options);
  }

  getChartLabel(mode: 'temperature' | 'precipitation'): string {
    return mode === 'temperature' ? 'Temperature' : 'Precipitation Probability';
  }

  onDayChange(index: number): void {
    this.selectedDayIndex = index;
    this.updateChart();
  }

  onChartToggle(type: 'temperature' | 'precipitation') {
    this.selectedChart = type; this.updateChart();
  }

  private updateChart(): void {
    const chartWidth = this.chart?.chart?.width ?? window.innerWidth;
    const showLabels = chartWidth >= 450;

    if (!this.weather) return;

    const selectedDate = this.weather.daily[this.selectedDayIndex].date;
    const dayHourly = this.weather.hourly.filter(h => h.time.startsWith(selectedDate));
    const labels = dayHourly.map(h => h.time.split('T')[1].slice(0, 5));

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
          display: showLabels,
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
          display: showLabels,
          color: '#ffffff',
          position: 'start'
        }
      }
    };

    let dataset;

    if (this.selectedChart === 'temperature') {
      const temps = dayHourly.map(h => h.temperature);
      const minHour = dayHourly.reduce((a, b) => a.temperature < b.temperature ? a : b);
      const maxHour = dayHourly.reduce((a, b) => a.temperature > b.temperature ? a : b);

      dataset = {
        data: temps,
        label: 'Temperature (°C)',
        borderColor: '#EF5350',
        backgroundColor: 'rgba(239, 83, 80, 0.2)',
        tension: 0.3,
        fill: true
      };

      annotations['minPoint'] = {
        type: 'line',
        xMin: minHour.time.split('T')[1].slice(0, 5),
        xMax: minHour.time.split('T')[1].slice(0, 5),
        yMin: minHour.temperature,
        yMax: minHour.temperature + 0.01,
        borderColor: 'rgba(54, 162, 235, 0.8)',
        borderWidth: 3,
        label: {
          display: showLabels,
          content: `${minHour.temperature} °C`,
          backgroundColor: 'rgba(54, 162, 235, 0.8)',
          color: '#ffffff'
        }
      };

      annotations['maxPoint'] = {
        type: 'line',
        xMin: maxHour.time.split('T')[1].slice(0, 5),
        xMax: maxHour.time.split('T')[1].slice(0, 5),
        yMin: maxHour.temperature,
        yMax: maxHour.temperature + 0.01,
        borderColor: 'rgba(255, 99, 132, 0.8)',
        borderWidth: 3,
        label: {
          display: showLabels,
          content: `${maxHour.temperature} °C`,
          backgroundColor: 'rgba(255, 99, 132, 0.8)',
          color: '#ffffff'
        }
      };

      if (this.selectedDayIndex === 0) {
        const now = new Date();
        const hour = now.getHours().toString().padStart(2, '0');
        const nowIndex = dayHourly.findIndex(h => h.time.includes(`T${hour}:`));
        if (nowIndex !== -1) {
          const tempNow = dayHourly[nowIndex].temperature;
          const labelTime = labels[nowIndex];
          annotations['now'] = {
            type: 'line',
            xMin: labelTime,
            xMax: labelTime,
            yMin: tempNow,
            yMax: tempNow + 0.01,
            borderColor: '#00BCD4',
            borderWidth: 3,
            label: {
              display: showLabels,
              content: `Now: ${tempNow} °C`,
              backgroundColor: '#00BCD4',
              color: '#000000',
              position: 'start'
            }
          };
        }
      }

    } else {
      dataset = {
        data: dayHourly.map(h => h.precipitationProbability),
        label: 'Precipitation (%)',
        borderColor: '#42A5F5',
        backgroundColor: 'rgba(66, 165, 245, 0.2)',
        tension: 0.3,
        fill: true
      };
    }

    this.chartOptions!.plugins = {
      ...(this.chartOptions!.plugins ?? {}),
      annotation: { annotations }
    };

    // Standard-Y-Achse zurücksetzen
    this.chartOptions!.scales = {
      x: {
        ticks: { color: '#ccc' },
        grid: { color: '#444' }
      },
      y: {
        ticks: { color: '#ccc' },
        grid: { color: '#444' },
        suggestedMin: this.selectedChart === 'precipitation' ? 0 : undefined,
        suggestedMax: this.selectedChart === 'precipitation' ? 100 : undefined
      }
    };

    this.tempChartData = {
      labels,
      datasets: [dataset]
    };
  }

  private getHourIndex(time: string): number {
    const hour = +time.split('T')[1].split(':')[0];
    return this.weather?.hourly.findIndex(h =>
      h.time.includes(`T${hour.toString().padStart(2, '0')}:`)
    ) ?? -1;
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

  getTodayAverageCloudcover(): number | null {
    if (!this.weather || !this.weather.hourly?.length || !this.weather.daily?.length) return null;
    const today = this.weather.daily[0].date;
    const todayHourly = this.weather.hourly.filter(h => h.time.startsWith(today));
    if (!todayHourly.length) return null;
    const sum = todayHourly.reduce((acc, h) => acc + h.cloudcover, 0);
    return Math.round(sum / todayHourly.length);
  }
}