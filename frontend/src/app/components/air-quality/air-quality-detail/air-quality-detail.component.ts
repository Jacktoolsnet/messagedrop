import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, Input, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule } from '@angular/material/dialog';
import { CategoryScale, Chart, ChartConfiguration, ChartType, Filler, LinearScale, LineController, LineElement, PointElement, ScriptableContext, Title, Tooltip } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { BaseChartDirective } from 'ng2-charts';

@Component({
  selector: 'app-air-quality-detail',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    FormsModule,
    FormsModule,
    BaseChartDirective
  ],
  templateUrl: './air-quality-detail.component.html',
  styleUrl: './air-quality-detail.component.css'
})

export class AirQualityDetailComponent implements OnInit, OnChanges, AfterViewInit {
  @Input() tile!: any;
  @Input() selectedDayIndex = 0;
  @Input() selectedHour = 0;
  @ViewChild(BaseChartDirective) chartCanvas!: BaseChartDirective;

  lineChartType: ChartType = 'line';
  chartOptions: ChartConfiguration['options'] = {};
  chartData: ChartConfiguration['data'] = { labels: [], datasets: [] };

  constructor() {
    Chart.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Title, Tooltip, LineController, annotationPlugin);
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

  updateChart(): void {
    if (!this.tile?.values || !this.tile?.time) return;

    const start = this.selectedDayIndex * 24;
    const end = start + 24;
    const dayValues = this.tile.values.slice(start, end);
    const dayLabels = this.tile.time.slice(start, end).map((t: string) => t.slice(11));

    const globalMin = Math.min(...this.tile.values);
    const globalMax = Math.max(...this.tile.values);

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

    const hour = this.selectedHour;
    const hourLabel = dayLabels[hour] ?? `${hour}:00`;
    const value = dayValues[hour] ?? 0;

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
          color: '#fff',
          font: {
            size: 18,
            weight: 'bold'
          },
          padding: {
            top: 10,
            bottom: 20
          }
        },
        annotation: {
          annotations: {
            selectedHour: {
              type: 'line',
              xMin: hourLabel,
              xMax: hourLabel,
              yMin: value,
              yMax: value + 0.01,
              borderColor: this.tile.color,
              borderWidth: 3,
              label: {
                display: true,
                content: `${hourLabel}: ${value}${this.tile.unit}`,
                backgroundColor: this.tile.color,
                color: '#000000',
                position: 'start'
              }
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Time',
            color: '#fff',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            color: '#fff',
            maxRotation: 45,
            minRotation: 45
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        y: {
          beginAtZero: true,
          min: globalMin,
          max: globalMax,
          title: {
            display: true,
            text: this.tile.unit,
            color: '#fff',
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          ticks: {
            color: '#fff'
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      }
    };

    if (this.chartCanvas?.chart) {
      this.chartCanvas.update();
    }
  }

  getTimeLabel(hour: number): string {
    const label = this.tile.time?.[this.selectedDayIndex * 24 + hour];
    return label?.slice(11) ?? `${hour}:00`;
  }

  getValueLabel(hour: number): string {
    const value = this.tile.values?.[this.selectedDayIndex * 24 + hour];
    return value != null ? `${value} ${this.tile.unit}` : '–';
  }

  moveSelectedHourAnnotation(): void {
    const chart = this.chartCanvas?.chart;
    if (!chart) return;

    const hour = this.selectedHour;
    const hourLabel = this.chartData.labels?.[hour] ?? `${hour}:00`;
    const rawValue = this.chartData.datasets?.[0]?.data?.[hour];
    const numericValue = typeof rawValue === 'number' ? rawValue : 0;

    const annotations = (chart.options.plugins?.annotation?.annotations ?? {}) as any;

    if (!annotations.selectedHour) {
      // Falls Annotation noch nicht da ist, einfach neu setzen
      annotations.selectedHour = {
        type: 'line',
        xMin: hourLabel,
        xMax: hourLabel,
        yMin: numericValue,
        yMax: numericValue + 0.01,
        borderColor: this.tile.color,
        borderWidth: 3,
        label: {
          display: true,
          content: `${hourLabel}: ${numericValue}${this.tile.unit}`,
          backgroundColor: this.tile.color,
          color: '#000',
          position: 'start'
        }
      };
    } else {
      // Ansonsten aktualisieren
      annotations.selectedHour.xMin = hourLabel;
      annotations.selectedHour.xMax = hourLabel;
      annotations.selectedHour.yMin = numericValue;
      annotations.selectedHour.yMax = numericValue + 0.01;
      annotations.selectedHour.label.content = `${hourLabel}: ${numericValue}${this.tile.unit}`;
    }

    chart.update('none');
  }
}