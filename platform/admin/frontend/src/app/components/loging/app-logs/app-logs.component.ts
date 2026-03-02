import { ClipboardModule } from '@angular/cdk/clipboard';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { FrontendErrorLogEntry } from '../../../interfaces/frontend-error-log-entry';
import { LogService } from '../../../services/log.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

@Component({
  selector: 'app-app-logs',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ClipboardModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatDialogModule,
    MatListModule,
    MatDividerModule,
    MatMenuModule,
    MatProgressBarModule
  ],
  templateUrl: './app-logs.component.html',
  styleUrls: ['./app-logs.component.css']
})
export class AppLogsComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly logService = inject(LogService);
  private readonly snack = inject(MatSnackBar);

  readonly loading = signal(false);
  readonly rightLoading = signal(false);
  readonly logs = signal<FrontendErrorLogEntry[]>([]);
  readonly selected = signal<FrontendErrorLogEntry | null>(null);
  readonly events = signal<string[]>(['all']);
  readonly filterEvent = signal<string>('all');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.logService.listFrontendErrorLogs(200, 0).subscribe({
      next: (res) => {
        this.logs.set(res.rows ?? []);
        if (this.logs().length && !this.selected()) {
          this.selected.set(this.logs()[0]);
        }
        const uniq = Array.from(new Set((res.rows ?? []).map(l => l.event).filter(Boolean)));
        this.events.set(['all', ...uniq]);
      },
      error: () => {
        this.snack.open('Could not load app logs.', 'OK', { duration: 3000 });
      },
      complete: () => this.loading.set(false)
    });
  }

  select(entry: FrontendErrorLogEntry) {
    this.selected.set(entry);
  }

  isSelected(entry: FrontendErrorLogEntry): boolean {
    return this.selected()?.id === entry.id;
  }

  trackById(_index: number, item: FrontendErrorLogEntry) {
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
      `Event: ${sel.event}`,
      `Severity: ${sel.severity}`,
      `Path: ${sel.path ?? ''}`,
      `Status: ${sel.status ?? ''}`,
      `Feature: ${sel.feature ?? ''}`,
      `ErrorName: ${sel.errorName ?? ''}`,
      `ErrorMessage: ${sel.errorMessage ?? ''}`,
      `ErrorCode: ${sel.errorCode ?? ''}`,
      `Source: ${sel.source ?? ''}`,
      `Line: ${sel.line ?? ''}`,
      `Column: ${sel.column ?? ''}`,
      `Stack: ${sel.stack ?? ''}`,
      `AppVersion: ${sel.appVersion ?? ''}`,
      `Environment: ${sel.environment ?? ''}`,
      `Timestamp: ${this.formatLocal(sel.createdAt)} (${sel.createdAt})`
    ].join('\n');
    try {
      navigator.clipboard.writeText(text);
      this.snack.open('Copied to clipboard.', undefined, { duration: 2000 });
    } catch {
      this.snack.open('Could not copy.', 'OK', { duration: 3000 });
    }
  }

  setFilter(value: string) {
    this.filterEvent.set(value || 'all');
    const list = this.visibleLogs();
    if (list.length) {
      this.selected.set(list[0]);
    } else {
      this.selected.set(null);
    }
  }

  visibleLogs(): FrontendErrorLogEntry[] {
    const f = this.filterEvent();
    const list = this.logs();
    if (f === 'all') return list;
    return list.filter(l => l.event === f);
  }

  iconForEvent(evt: string): string {
    const key = (evt || '').toLowerCase();
    if (key.includes('http')) return 'http';
    if (key.includes('resource')) return 'image_not_supported';
    if (key.includes('rejection')) return 'report_problem';
    return 'bug_report';
  }

  deleteSelected() {
    const current = this.selected();
    if (!current) return;
    this.rightLoading.set(true);
    this.logService.deleteFrontendErrorLog(current.id).subscribe({
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
        title: 'Delete all app logs?',
        message: 'Do you really want to delete all app log entries? This cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        warn: true
      }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.loading.set(true);
      this.logService.deleteAllFrontendErrorLogs().subscribe({
        next: (res) => {
          if (res.deleted) {
            this.logs.set([]);
            this.selected.set(null);
            this.events.set(['all']);
            this.filterEvent.set('all');
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

  formatDate(ts: number): Date {
    return new Date(ts);
  }
}
