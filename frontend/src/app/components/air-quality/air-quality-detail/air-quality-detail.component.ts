import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
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

export class AirQualityDetailComponent implements OnInit, AfterViewInit {
  @Input() tile!: any;
  @Output() close = new EventEmitter<void>();

  selectedDayIndex = 0;
  lineChartType: ChartType = 'line';
  chartOptions: ChartConfiguration['options'] = {};
  chartData: ChartConfiguration['data'] = { labels: [], datasets: [] };

  constructor() {
    Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Title, Tooltip, LineController);
  }

  ngOnInit(): void {
    this.updateChart();
  }

  ngAfterViewInit(): void { }

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
        pointBackgroundColor: this.tile.color,
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
        legend: { display: false },
        title: {
          display: true,
          text: this.tile.label,
          color: '#fff', // Titel in weiß
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
          ticks: { color: '#fff', maxRotation: 0, autoSkip: true },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)' // ✅ zart weißes Gitternetz
          }
        },
        y: {
          beginAtZero: true,
          ticks: { color: '#fff' },
          title: {
            display: true,
            text: this.tile.unit,
            color: '#fff',
            font: { size: 14, weight: 'bold' }
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      }
    };
  }

  onDayChange(index: number): void {
    this.selectedDayIndex = index;
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
}