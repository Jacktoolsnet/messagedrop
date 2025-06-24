import { Component, Input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { PlaceService } from '../../../services/place.service';

@Component({
  selector: 'app-date-time',
  imports: [MatIcon],
  templateUrl: './date-time.component.html',
  styleUrl: './date-time.component.css'
})
export class DateTimeComponent {
  @Input() timezone!: string;
  time = '';
  date = '';
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
  }
}
