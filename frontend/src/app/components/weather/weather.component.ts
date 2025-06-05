import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Weather } from '../../interfaces/weather';

@Component({
  selector: 'app-weather',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    FormsModule
  ],
  templateUrl: './weather.component.html',
  styleUrls: ['./weather.component.css']
})
export class WeatherComponent implements OnInit {
  @Input() weather!: Weather;
  @Input() selectedDayIndex = 0;
  @Input() selectedHour = 12;
  @Output() tileSelected = new EventEmitter<{
    type: 'temperature' | 'precipitation' | 'uvIndex' | 'wind' | 'pressure'
  }>();

  tileModes: Array<'temperature' | 'precipitation' | 'uvIndex' | 'wind' | 'pressure'> = [
    'temperature',
    'precipitation',
    'uvIndex',
    'wind',
    'pressure'
  ];

  ngOnInit(): void {
    if (this.selectedDayIndex === 0) {
      this.selectedHour = new Date().getHours();
    } else {
      this.selectedHour = 12;
    }
  }

  onTileClick(type: 'temperature' | 'precipitation' | 'uvIndex' | 'wind' | 'pressure'): void {
    this.tileSelected.emit({ type });
  }

  getTileLabel(type: string): string {
    switch (type) {
      case 'temperature': return 'Temperature';
      case 'precipitation': return 'Precipitation';
      case 'uvIndex': return 'UV Index';
      case 'wind': return 'Wind';
      case 'pressure': return 'Pressure';
      default: return type;
    }
  }

  getTileIcon(type: string): string {
    switch (type) {
      case 'temperature': return 'thermostat';
      case 'precipitation': return 'water_drop';
      case 'uvIndex': return 'light_mode';
      case 'wind': return 'air';
      case 'pressure': return 'compress';
      default: return 'device_thermostat';
    }
  }

  getTileValue(type: string): string {
    const hourly = this.weather.hourly;
    const date = this.weather.daily[this.selectedDayIndex]?.date;
    const hourData = hourly.find(h => h.time.startsWith(date) && h.time.includes(`${this.selectedHour.toString().padStart(2, '0')}:`));
    if (!hourData) return '–';
    switch (type) {
      case 'temperature': return `${hourData.temperature} °C`;
      case 'precipitation': return `${hourData.precipitationProbability} %`;
      case 'uvIndex': return `${hourData.uvIndex}`;
      case 'wind': return `${hourData.wind} km/h`;
      case 'pressure': return `${hourData.pressure} hPa`;
      default: return '–';
    }
  }
}