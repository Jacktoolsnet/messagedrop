import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DsaAuditEntry } from '../../../../interfaces/dsa-audit-entry.interface';
import { DsaNoticeStatus, isDsaNoticeStatus } from '../../../../interfaces/dsa-notice-status.type';
import { DsaService } from '../../../../services/dsa/dsa/dsa.service';

type KnownAction =
  | 'status_change'
  | 'create'
  | 'evidence_add'
  | 'notify'
  | 'delete'
  | 'promote_to_notice'
  | string;

interface DetailsRow {
  k: string;
  v: string;
}

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatProgressBarModule, MatChipsModule],
  templateUrl: './audit-log.component.html',
  styleUrls: ['./audit-log.component.css']
})
export class AuditLogComponent implements OnChanges {
  @Input() noticeId: string | null = null;

  private dsa = inject(DsaService);
  private snack = inject(MatSnackBar);

  loading = signal(false);
  items = signal<DsaAuditEntry[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if ('noticeId' in changes) this.fetch();
  }

  private fetch(): void {
    this.items.set([]);
    if (!this.noticeId) return;
    this.loading.set(true);
    this.dsa.getAuditForNotice(this.noticeId).subscribe({
      next: rows => {
        const sorted = (rows || []).slice().sort((a, b) => b.createdAt - a.createdAt);
        this.items.set(sorted);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snack.open('Could not load audit log.', 'OK', { duration: 3000 });
      }
    });
  }

  // ---------- UI Helpers ----------
  actionIcon(a: string): string {
    switch ((a || '').toLowerCase()) {
      case 'decision_create': return 'gavel';
      case 'decision_change': return 'autorenew';
      case 'create': return 'add_circle';
      case 'status_change': return 'sync_alt';
      case 'evidence_add': return 'attach_file';
      case 'notify': return 'notifications_active';
      case 'delete': return 'delete';
      case 'promote_to_notice': return 'upgrade';
      default: return 'history';
    }
  }

  actionChipClass(a: string): string {
    switch ((a || '').toLowerCase()) {
      case 'decision_create': return 'chip-primary';
      case 'decision_change': return 'chip-change';
      case 'create': return 'chip-ok';
      case 'status_change': return 'chip-change';
      case 'evidence_add': return 'chip-info';
      case 'notify': return 'chip-notify';
      case 'delete': return 'chip-warn';
      case 'promote_to_notice': return 'chip-primary';
      default: return 'chip-default';
    }
  }

  actionLabel(a: string): string {
    switch ((a || '').toLowerCase()) {
      case 'decision_create': return 'Decision created';
      case 'decision_change': return 'Decision revised';
      case 'create': return 'Created';
      case 'status_change': return 'Status changed';
      case 'evidence_add': return 'Evidence added';
      case 'notify': return 'Notification sent';
      case 'delete': return 'Deleted';
      case 'promote_to_notice': return 'Promoted to notice';
      default: return (a || 'event').replace(/_/g, ' ');
    }
  }

  /** Für Statuswechsel: neuen Status aus details ziehen */
  getStatusChange(entry: DsaAuditEntry): DsaNoticeStatus | null {
    if ((entry.action || '').toLowerCase() !== 'status_change') return null;
    const details = this.asDetails(entry);
    const status = this.detailValue(details, 'status') ?? this.detailValue(details, 'newStatus');
    return status && isDsaNoticeStatus(status) ? status : null;
  }

  // nachher:
  statusPillClass(s: DsaNoticeStatus | string | null): string {
    const map: Record<DsaNoticeStatus, string> = {
      RECEIVED: 'pill-received',
      UNDER_REVIEW: 'pill-under-review',
      DECIDED: 'pill-decided'
    };

    const key = typeof s === 'string' ? (s as DsaNoticeStatus) : (s ?? undefined);
    return key && map[key] ? map[key] : 'pill-default';
  }

  /** Bekannte Details als Key/Value; sonst null (→ Fallback JSON) */
  detailsRows(e: DsaAuditEntry): DetailsRow[] | null {
    const details = this.asDetails(e);
    const lower = (e.action || '').toLowerCase() as KnownAction;

    switch (lower) {
      case 'status_change': {
        const status = this.detailValue(details, 'status') ?? this.detailValue(details, 'newStatus');
        return status ? [{ k: 'Changed to', v: status }] : null;
      }
      case 'create': {
        return this.rowsFrom(details, [
          ['outcome', 'Outcome'],
          ['noticeId', 'Notice ID']
        ]);
      }
      case 'decision_create':
      case 'decision_change': {
        return this.rowsFrom(details, [
          ['outcome', 'Outcome'],
          ['previousOutcome', 'Previous'],
          ['decisionId', 'Decision ID']
        ]);
      }
      case 'evidence_add': {
        return this.rowsFrom(details, [
          ['type', 'Type'],
          ['evidenceId', 'Evidence ID']
        ]);
      }
      case 'notify': {
        return this.rowsFrom(details, [
          ['stakeholder', 'Stakeholder'],
          ['channel', 'Channel']
        ]);
      }
      case 'promote_to_notice': {
        const notice = this.detailValue(details, 'noticeId');
        return notice ? [{ k: 'Notice ID', v: notice }] : null;
      }
      case 'delete': {
        const reason = this.detailValue(details, 'reason');
        return reason ? [{ k: 'Reason', v: reason }] : null;
      }
      default:
        return null;
    }
  }

  /** Fallback: Details als schön formatiertes JSON */
  prettyJson(e: DsaAuditEntry): string | null {
    if (!e.details) return null;
    try { return JSON.stringify(e.details, null, 2); }
    catch { return String(e.details); }
  }

  trackById(_i: number, e: DsaAuditEntry) { return e.id; }

  private asDetails(entry: DsaAuditEntry): Record<string, unknown> {
    return entry.details ?? {};
  }

  private detailValue(details: Record<string, unknown>, key: string): string | null {
    const value = details[key];
    if (value === undefined || value === null) return null;
    return typeof value === 'string' ? value : String(value);
  }

  private rowsFrom(details: Record<string, unknown>, mapping: [string, string][]): DetailsRow[] | null {
    const rows: DetailsRow[] = [];
    for (const [key, label] of mapping) {
      const value = this.detailValue(details, key);
      if (value) rows.push({ k: label, v: value });
    }
    return rows.length ? rows : null;
  }
}
