import { ClipboardModule } from '@angular/cdk/clipboard';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { ErrorLogEntry } from '../../../interfaces/error-log-entry';
import { LogService } from '../../../services/log.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

@Component({
  selector: 'app-info-logs',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ClipboardModule,
    MatButtonToggleModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatProgressBarModule,
    MatMenuModule,
    MatDividerModule
  ],
  templateUrl: './info-logs.component.html',
  styleUrls: ['./info-logs.component.css']
})
export class InfoLogsComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly logService = inject(LogService);
  private readonly snack = inject(MatSnackBar);

  readonly loading = signal(false);
  readonly rightLoading = signal(false);
  readonly logs = signal<ErrorLogEntry[]>([]);
  readonly selected = signal<ErrorLogEntry | null>(null);
  readonly sources = signal<string[]>(['all']);
  readonly filterSource = signal<string>('all');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.logService.listInfoLogs(200, 0).subscribe({
      next: (res) => {
        this.logs.set(res.rows ?? []);
        if (this.logs().length && !this.selected()) {
          this.selected.set(this.logs()[0]);
        }
        const uniq = Array.from(new Set((res.rows ?? []).map(l => l.source).filter(Boolean)));
        this.sources.set(['all', ...uniq]);
      },
      error: () => {
        this.snack.open('Could not load info logs.', 'OK', { duration: 3000 });
      },
      complete: () => this.loading.set(false)
    });
  }

  select(entry: ErrorLogEntry) {
    this.selected.set(entry);
  }

  isSelected(entry: ErrorLogEntry): boolean {
    return this.selected()?.id === entry.id;
  }

  trackById(_index: number, item: ErrorLogEntry) {
    return item.id;
  }

  formatLocal(ts: number): string {
    try {
      return new Date(ts).toLocaleString(navigator.language || undefined);
    } catch {
      return new Date(ts).toISOString();
    }
  }

  copySelected() {
    const sel = this.selected();
    if (!sel) return;
    const text = [
      `Source: ${sel.source}`,
      `File: ${sel.file}`,
      `Timestamp: ${this.formatLocal(sel.createdAt)} (${sel.createdAt})`,
      `Message: ${sel.message}`
    ].join('\n');
    try {
      navigator.clipboard.writeText(text);
      this.snack.open('Copied to clipboard.', undefined, { duration: 2000 });
    } catch {
      this.snack.open('Could not copy.', 'OK', { duration: 3000 });
    }
  }

  deleteSelected() {
    const current = this.selected();
    if (!current) return;
    this.rightLoading.set(true);
    this.logService.deleteInfoLog(current.id).subscribe({
      next: (res) => {
        if (res.deleted) {
          this.logs.set(this.logs().filter(l => l.id !== current.id));
          this.selected.set(this.logs()[0] ?? null);
          this.snack.open('Entry deleted.', undefined, { duration: 2000 });
        } else {
          this.snack.open('Delete failed.', 'OK', { duration: 3000 });
        }
      },
      error: () => {
        this.snack.open('Delete failed.', 'OK', { duration: 3000 });
      },
      complete: () => this.rightLoading.set(false)
    });
  }

  deleteAll() {
    if (!this.logs().length) {
      this.snack.open('No entries to delete.', undefined, { duration: 2000 });
      return;
    }
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete all info logs?',
        message: 'Do you really want to delete all info log entries? This cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        warn: true
      }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.loading.set(true);
      this.logService.deleteAllInfoLogs().subscribe({
        next: (res) => {
          if (res.deleted) {
            this.logs.set([]);
            this.selected.set(null);
            this.sources.set(['all']);
            this.filterSource.set('all');
            const count = res.count ?? 0;
            const suffix = count ? ` (${count})` : '';
            this.snack.open(`All entries deleted${suffix}.`, undefined, { duration: 2000 });
          } else {
            this.snack.open('Delete failed.', 'OK', { duration: 3000 });
          }
        },
        error: () => {
          this.snack.open('Delete failed.', 'OK', { duration: 3000 });
        },
        complete: () => this.loading.set(false)
      });
    });
  }

  setFilter(value: string) {
    this.filterSource.set(value || 'all');
    const list = this.visibleLogs();
    if (list.length) {
      this.selected.set(list[0]);
    } else {
      this.selected.set(null);
    }
  }

  visibleLogs(): ErrorLogEntry[] {
    const f = this.filterSource();
    const list = this.logs();
    if (f === 'all') return list;
    return list.filter(l => l.source === f);
  }

  iconForSource(src: string): string {
    const key = (src || '').toLowerCase();
    if (key.includes('socket')) return 'hub';
    if (key.includes('openmeteo')) return 'cloud';
    if (key.includes('nominatim')) return 'location_on';
    if (key.includes('admin')) return 'admin_panel_settings';
    if (key.includes('public') || key.includes('backend')) return 'dns';
    return 'info';
  }
}
