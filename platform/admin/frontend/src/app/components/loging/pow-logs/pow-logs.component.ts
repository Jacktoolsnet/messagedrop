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
import { PowLogEntry } from '../../../interfaces/pow-log-entry';
import { LogService } from '../../../services/log.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';

@Component({
  selector: 'app-pow-logs',
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
  templateUrl: './pow-logs.component.html',
  styleUrls: ['./pow-logs.component.css']
})
export class PowLogsComponent implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly logService = inject(LogService);
  private readonly snack = inject(MatSnackBar);

  readonly loading = signal(false);
  readonly rightLoading = signal(false);
  readonly logs = signal<PowLogEntry[]>([]);
  readonly selected = signal<PowLogEntry | null>(null);
  readonly scopes = signal<string[]>(['all']);
  readonly filterScope = signal<string>('all');

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.logService.listPowLogs(200, 0).subscribe({
      next: (res) => {
        this.logs.set(res.rows ?? []);
        if (this.logs().length && !this.selected()) {
          this.selected.set(this.logs()[0]);
        }
        const uniq = Array.from(new Set((res.rows ?? []).map(l => l.scope).filter(Boolean)));
        this.scopes.set(['all', ...uniq]);
      },
      error: () => {
        this.snack.open('Could not load PoW logs.', 'OK', { duration: 3000 });
      },
      complete: () => this.loading.set(false)
    });
  }

  select(entry: PowLogEntry) {
    this.selected.set(entry);
  }

  isSelected(entry: PowLogEntry): boolean {
    return this.selected()?.id === entry.id;
  }

  trackById(_index: number, item: PowLogEntry) {
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
      `Scope: ${sel.scope}`,
      `Source: ${sel.source}`,
      `Path: ${sel.path}`,
      `Method: ${sel.method}`,
      `IP: ${sel.ip ?? ''}`,
      `UA: ${sel.userAgent ?? ''}`,
      `Reason: ${sel.reason ?? ''}`,
      `Difficulty: ${sel.difficulty ?? ''}`,
      `RequiredUntil: ${sel.requiredUntil ?? ''}`,
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
    this.filterScope.set(value || 'all');
    const list = this.visibleLogs();
    if (list.length) {
      this.selected.set(list[0]);
    } else {
      this.selected.set(null);
    }
  }

  visibleLogs(): PowLogEntry[] {
    const f = this.filterScope();
    const list = this.logs();
    if (f === 'all') return list;
    return list.filter(l => l.scope === f);
  }

  iconForScope(scope: string): string {
    const key = (scope || '').toLowerCase();
    if (key.includes('appeal')) return 'gavel';
    if (key.includes('evidence')) return 'upload_file';
    return 'shield';
  }

  deleteSelected() {
    const current = this.selected();
    if (!current) return;
    this.rightLoading.set(true);
    this.logService.deletePowLog(current.id).subscribe({
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
        title: 'Delete all PoW logs?',
        message: 'Do you really want to delete all PoW log entries? This cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        warn: true
      }
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.loading.set(true);
      this.logService.deleteAllPowLogs().subscribe({
        next: (res) => {
          if (res.deleted) {
            this.logs.set([]);
            this.selected.set(null);
            this.scopes.set(['all']);
            this.filterScope.set('all');
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
}
