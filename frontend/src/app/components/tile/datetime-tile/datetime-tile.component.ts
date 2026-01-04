import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { PlaceService } from '../../../services/place.service';

@Component({
  selector: 'app-datetime-tile',
  imports: [MatIcon, TranslocoPipe],
  templateUrl: './datetime-tile.component.html',
  styleUrl: './datetime-tile.component.css'
})
export class DateTimeTileComponent implements OnInit, OnDestroy {
  @Input() timezone!: string;
  time = '';
  date = '';
  week = '';
  private timer: ReturnType<typeof setInterval> | null = null;
  private locale = navigator.language || 'en';

  private readonly placeService = inject(PlaceService);

  ngOnInit(): void {
    this.updateTime();
    this.timer = setInterval(() => this.updateTime(), 1000);
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private updateTime() {
    this.time = this.placeService.getFormattedTime(this.timezone, this.locale);
    this.date = this.placeService.getFormattedDate(this.timezone, this.locale);
    this.week = this.placeService.getWeekNumber(this.timezone, this.locale);
  }
}
