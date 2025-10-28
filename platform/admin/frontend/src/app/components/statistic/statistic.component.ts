import { Component, signal } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-statistic',
  standalone: true,
  imports: [
    RouterLink,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatButtonToggleModule
  ],
  templateUrl: './statistic.component.html',
  styleUrls: ['./statistic.component.css']
})
export class StatisticComponent {
  readonly ranges = [
    { value: '12m', label: 'Last year' },
    { value: '6m', label: 'Last six months' },
    { value: '3m', label: 'Last quarter' },
    { value: '1m', label: 'Last month' },
    { value: '1w', label: 'Week' },
    { value: '1d', label: 'Today' },
  ] as const;

  readonly selectedRange = signal<'12m' | '6m' | '3m' | '1m' | '1w' | '1d'>('1m');

  onRangeChange(v: string | null): void {
    if (!v) return;
    if (this.selectedRange() === v) return;
    this.selectedRange.set(v as any);
    // TODO: trigger data reload using selectedRange
  }
}
