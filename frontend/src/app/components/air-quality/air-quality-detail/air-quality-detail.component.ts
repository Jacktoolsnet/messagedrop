import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CategoryScale, Chart, ChartConfiguration, ChartType, Filler, LinearScale, LineController, LineElement, PointElement, ScriptableContext, Title, Tooltip } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';

@Component({
  selector: 'app-air-quality-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSliderModule,
    FormsModule,
    FormsModule,
    BaseChartDirective
  ],
  templateUrl: './air-quality-detail.component.html',
  styleUrl: './air-quality-detail.component.css'
})

export class AirQualityDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() tile!: any;
  @Output() close = new EventEmitter<void>();

  selectedDayIndex = 0;
  selectedHour = 0;
  lineChartType: ChartType = 'line';
  chartOptions: ChartConfiguration['options'] = {};
  chartData: ChartConfiguration['data'] = { labels: [], datasets: [] };

  constructor() {
    Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Title, Tooltip, LineController);
  }

  ngOnInit(): void {
    this.selectedHour = this.getDefaultHour();
    this.updateChart();
  }

  ngAfterViewInit(): void { }

  ngOnDestroy(): void { }

  getDefaultHour(): number {
    return this.selectedDayIndex === 0 ? new Date().getHours() : 12;
  }

  updateChart(): void {
    if (!this.tile?.values || !this.tile?.time) return;
    const start = this.selectedDayIndex * 24;
    const end = start + 24;
    const dayValues = this.tile.values.slice(start, end);
    const dayLabels = this.tile.time.slice(start, end).map((t: string) => t.slice(11));

    this.chartData = {
      labels: dayLabels,
      datasets: [{
        label: this.tile.label,
        data: dayValues,
        borderColor: this.tile.color,
        backgroundColor: (ctx: ScriptableContext<'line'>) => {
          const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, ctx.chart.height);
          gradient.addColorStop(0, this.tile.color);
          gradient.addColorStop(1, 'rgba(255,255,255,0.1)');
          return gradient;
        },
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: dayValues.map((v: number) => this.getColorForValue(v)),
        tension: 0.3
      }]
    };

    this.chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.formattedValue} ${this.tile.unit}`,
            title: ctx => this.getTimeLabel(ctx[0].dataIndex)
          }
        },
        legend: { display: false }
      },
      scales: {
        x: {
          ticks: { color: '#888', maxRotation: 0, autoSkip: true }
        },
        y: {
          beginAtZero: true,
          ticks: { color: this.tile.color },
          title: {
            display: true,
            text: this.tile.unit,
            color: this.tile.color,
            font: { size: 14, weight: 'bold' }
          }
        }
      }
    };
  }

  onDayChange(index: number): void {
    this.selectedDayIndex = index;
    this.selectedHour = this.getDefaultHour();
    this.updateChart();
  }

  onHourChange(): void { }

  getTimeLabel(hour: number): string {
    const label = this.tile.time?.[this.selectedDayIndex * 24 + hour];
    return label?.slice(11) ?? `${hour}:00`;
  }

  getValueLabel(hour: number): string {
    const value = this.tile.values?.[this.selectedDayIndex * 24 + hour];
    return value != null ? `${value} ${this.tile.unit}` : '–';
  }

  getColorForValue(value: number): string {
    if (value == null) return '#ccc';
    if (value < 20) return '#4caf50';
    if (value < 50) return '#ffeb3b';
    if (value < 100) return '#ff9800';
    return '#f44336';
  }

  get highlightColor(): string {
    const value = this.tile.values?.[this.selectedDayIndex * 24 + this.selectedHour];
    return this.getColorForValue(typeof value === 'number' ? value : 0);
  }

  getDayLabels(): string[] {
    return ['to', 'do', 'later']
  }
}