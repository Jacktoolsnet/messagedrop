
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCardModule } from '@angular/material/card';
import { StatisticSettingsService } from '../../../services/statistic/statistic-settings.service';
import { StatisticService } from '../../../services/statistic/statistic.service';
import { StatisticKeySetting } from '../../../interfaces/statistic-key-setting.interface';

interface Row {
  metricKey: string;
  displayName: string;
  iconName: string;
  color: string;
  sortOrder: number;
}

@Component({
  selector: 'app-statistic-settings',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatCardModule,
    DragDropModule
],
  templateUrl: './statistic-settings.component.html',
  styleUrls: ['./statistic-settings.component.css']
})
export class StatisticSettingsComponent implements OnInit {
  private readonly settingsApi = inject(StatisticSettingsService);
  private readonly statsApi = inject(StatisticService);
  private readonly ref = inject(MatDialogRef<StatisticSettingsComponent>);

  readonly rows = signal<Row[]>([]);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.loading.set(true);
    // load keys and current settings
    this.statsApi.getKeys().subscribe({
      next: (keysRes) => {
        const keys = keysRes?.keys ?? [];
        this.settingsApi.list().subscribe({
          next: (sRes) => {
            const map = new Map((sRes?.settings ?? []).map(s => [s.metricKey, s] as const));
            const rows: Row[] = keys.map((k, i) => {
              const cur = map.get(k);
              return {
                metricKey: k,
                displayName: cur?.displayName ?? '',
                iconName: cur?.iconName ?? '',
                color: cur?.color ?? '#2563eb',
                sortOrder: cur?.sortOrder ?? i
              };
            }).sort((a, b) => a.sortOrder - b.sortOrder);
            this.rows.set(rows);
            this.loading.set(false);
          },
          error: () => { this.loading.set(false); }
        });
      },
      error: () => { this.loading.set(false); }
    });
  }

  drop(ev: CdkDragDrop<Row[]>): void {
    const arr = [...this.rows()];
    moveItemInArray(arr, ev.previousIndex, ev.currentIndex);
    // reindex
    arr.forEach((r, idx) => r.sortOrder = idx);
    this.rows.set(arr);
  }

  save(): void {
    const payload: StatisticKeySetting[] = this.rows().map(r => ({
      metricKey: r.metricKey,
      displayName: r.displayName?.trim() || null,
      iconName: r.iconName?.trim() || null,
      color: r.color || null,
      sortOrder: r.sortOrder
    }));
    this.settingsApi.save(payload).subscribe({
      next: () => this.ref.close(true),
      error: () => this.ref.close(false)
    });
  }

  cancel(): void { this.ref.close(false); }

  randomizeColors(): void {
    const rand = () => '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    const arr = [...this.rows()];
    arr.forEach(r => r.color = rand());
    this.rows.set(arr);
  }
}
