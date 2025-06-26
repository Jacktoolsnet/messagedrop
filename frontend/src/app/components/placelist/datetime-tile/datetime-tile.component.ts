import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { PlaceService } from '../../../services/place.service';

@Component({
  selector: 'app-datetime-tile',
  imports: [MatIcon],
  templateUrl: './datetime-tile.component.html',
  styleUrl: './datetime-tile.component.css'
})
export class DateTimeTileComponent implements OnInit, OnDestroy {
  @Input() timezone!: string;
  time = '';
  date = '';
  week = '';
  private timer: any;
  private locale = navigator.language || 'en';

  constructor(private placeService: PlaceService) { }

  ngOnInit(): void {
    this.updateTime();
    this.timer = setInterval(() => this.updateTime(), 1000);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  private updateTime() {
    this.time = this.placeService.getFormattedTime(this.timezone, this.locale);
    this.date = this.placeService.getFormattedDate(this.timezone, this.locale);
    this.week = this.placeService.getWeekNumber(this.timezone, this.locale);
  }
}
