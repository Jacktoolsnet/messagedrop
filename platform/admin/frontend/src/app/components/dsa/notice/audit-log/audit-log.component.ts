import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DsaAuditEntry } from '../../../../interfaces/dsa-audit-entry.interface';
import { DsaNoticeStatus } from '../../../../interfaces/dsa-notice-status.type';
import { DsaService } from '../../../../services/dsa/dsa/dsa.service';

type KnownAction =
  | 'status_change'
  | 'create'
  | 'evidence_add'
  | 'notify'
  | 'delete'
  | 'promote_to_notice'
  | string;

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
        console.log(rows)
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
    const d = entry.details || {};
    const s = (d as any).status ?? (d as any).newStatus;
    return s ? String(s) as DsaNoticeStatus : null;
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
  detailsRows(e: DsaAuditEntry): Array<{ k: string; v: string }> | null {
    const d = e.details || {};
    const lower = (e.action || '').toLowerCase() as KnownAction;

    switch (lower) {
      case 'status_change': {
        const s = (d as any).status ?? (d as any).newStatus;
        return s ? [{ k: 'Changed to', v: String(s) }] : null;
      }
      case 'create': {
        // z.B. Decision: { noticeId, outcome }
        const rows: Array<{ k: string; v: string }> = [];
        if ((d as any).outcome) rows.push({ k: 'Outcome', v: String((d as any).outcome) });
        if ((d as any).noticeId) rows.push({ k: 'Notice ID', v: String((d as any).noticeId) });
        return rows.length ? rows : null;
      }
      case 'evidence_add': {
        const rows: Array<{ k: string; v: string }> = [];
        if ((d as any).type) rows.push({ k: 'Type', v: String((d as any).type) });
        if ((d as any).evidenceId) rows.push({ k: 'Evidence ID', v: String((d as any).evidenceId) });
        return rows.length ? rows : null;
      }
      case 'notify': {
        const rows: Array<{ k: string; v: string }> = [];
        if ((d as any).stakeholder) rows.push({ k: 'Stakeholder', v: String((d as any).stakeholder) });
        if ((d as any).channel) rows.push({ k: 'Channel', v: String((d as any).channel) });
        return rows.length ? rows : null;
      }
      case 'promote_to_notice': {
        if ((d as any).noticeId) return [{ k: 'Notice ID', v: String((d as any).noticeId) }];
        return null;
      }
      case 'delete': {
        if ((d as any).reason) return [{ k: 'Reason', v: String((d as any).reason) }];
        return null;
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
}