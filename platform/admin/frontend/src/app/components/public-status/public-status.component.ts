import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute } from '@angular/router';
import { PublicStatusAppeal, PublicStatusAuditEntry, PublicStatusEvidence, PublicStatusResponse, PublicStatusService } from '../../services/public-status.service';

interface MappedAuditEntry extends PublicStatusAuditEntry {
  detailsObj: Record<string, unknown> | null;
  synthetic?: boolean;
}

@Component({
  selector: 'app-public-status',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    MatChipsModule,
    MatListModule,
    MatDividerModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  templateUrl: './public-status.component.html',
  styleUrl: './public-status.component.css'
})
export class PublicStatusComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(PublicStatusService);
  private readonly snack = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly status = signal<PublicStatusResponse | null>(null);
  readonly auditEntries = signal<MappedAuditEntry[]>([]);
  readonly appeals = signal<PublicStatusAppeal[]>([]);

  private currentToken: string | null = null;

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const token = params.get('token');
        if (!token) {
          this.error.set('Missing status token.');
          this.loading.set(false);
          return;
        }
        this.currentToken = token;
        this.fetchStatus(token);
      });
  }

  get isNotice(): boolean {
    return this.status()?.entityType === 'notice';
  }

  get notice() {
    return this.status()?.notice ?? null;
  }

  get signal() {
    return this.status()?.signal ?? null;
  }

  get decision() {
    return this.status()?.decision ?? null;
  }

  get evidence(): PublicStatusEvidence[] {
    return this.status()?.evidence ?? [];
  }

  fetchStatus(token: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getStatus(token).subscribe({
      next: (data) => {
        this.status.set(data);
        this.auditEntries.set(this.buildAuditEntries(data));
        this.appeals.set(data.appeals ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        const msg = err?.error?.error === 'not_found'
          ? 'No case was found for this token.'
          : 'Could not load the status. Please try again later.';
        this.error.set(msg);
        this.loading.set(false);
      }
    });
  }

  parseDetails(details: unknown): Record<string, unknown> | null {
    if (!details) return null;
    if (typeof details === 'string') {
      try {
        return JSON.parse(details) as Record<string, unknown>;
      } catch {
        return { raw: details };
      }
    }
    if (typeof details === 'object' && !Array.isArray(details)) return { ...(details as Record<string, unknown>) };
    return null;
  }

  formatStatus(status: string | undefined | null): string {
    if (!status) return '—';
    switch (status.toUpperCase()) {
      case 'RECEIVED': return 'Received';
      case 'UNDER_REVIEW': return 'Under review';
      case 'DECIDED': return 'Decided';
      default: return status;
    }
  }

  formatAuditAction(entry: MappedAuditEntry): string {
    const rawAction = entry.action || '';
    const action = rawAction.toLowerCase();
    switch (action) {
      case 'status_change': {
        const details = entry.detailsObj;
        const previous = this.extractDetailStatus(details, ['previousStatus', 'oldStatus', 'previous', 'from', 'statusFrom']);
        const next = this.extractDetailStatus(details, ['status', 'newStatus', 'to', 'statusTo']);
        if (previous && next) {
          return `Status changed from ${this.formatStatus(previous)} to ${this.formatStatus(next)}`;
        }
        if (next) {
          return `Status changed to ${this.formatStatus(next)}`;
        }
        return 'Status updated';
      }
      case 'decision_created':
      case 'decision_recorded':
        return 'Decision recorded';
      case 'create': {
        const initial = this.extractDetailStatus(entry.detailsObj, ['status', 'initialStatus']);
        if (initial) {
          return `Notice created (status ${this.formatStatus(initial)})`;
        }
        return 'Notice created';
      }
      default: {
        const readable = rawAction.replace(/_/g, ' ').toLowerCase();
        return readable.replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Event';
      }
    }
  }

  formatOutcome(outcome: string | undefined | null): string {
    if (!outcome) return '—';
    const key = outcome.toUpperCase();
    switch (key) {
      case 'REMOVE_CONTENT':
      case 'REMOVE':
        return 'Removed';
      case 'RESTRICT':
        return 'Restricted';
      case 'NO_ACTION':
        return 'No action';
      case 'FORWARD_TO_AUTHORITY':
        return 'Escalated';
      default:
        return outcome;
    }
  }

  formatAppealOutcome(outcome: string | undefined | null): string {
    if (!outcome) return 'Pending';
    switch (outcome.toUpperCase()) {
      case 'UPHELD':
        return 'Decision upheld';
      case 'REVISED':
        return 'Decision revised';
      case 'PARTIAL':
        return 'Partially revised';
      case 'WITHDRAWN':
        return 'Withdrawn';
      default:
        return outcome;
    }
  }

  print(): void {
    window.print();
  }

  copyLink(): void {
    if (!this.currentToken) return;
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      this.snack.open('Link copied to clipboard.', 'OK', { duration: 2500 });
    }).catch(() => {
      this.snack.open('Could not copy the link automatically.', 'OK', { duration: 3000 });
    });
  }

  downloadEvidence(ev: PublicStatusEvidence): void {
    if (!this.currentToken) return;
    this.service.downloadEvidence(this.currentToken, ev.id).subscribe({
      next: (response) => {
        const blob = response.body;
        if (!blob) {
          this.snack.open('Empty file received.', 'OK', { duration: 2500 });
          return;
        }
        const filename = this.resolveFilename(response.headers.get('Content-Disposition'), ev.fileName || 'evidence');
        const link = document.createElement('a');
        const url = window.URL.createObjectURL(blob);
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.snack.open('Could not download the file.', 'OK', { duration: 3000 });
      }
    });
  }

  private extractDetailStatus(details: Record<string, unknown> | null | undefined, keys: string[]): string | null {
    if (!details) return null;
    for (const key of keys) {
      const value = details[key];
      if (value !== undefined && value !== null && value !== '') {
        return String(value);
      }
    }
    return null;
  }

  private buildAuditEntries(response: PublicStatusResponse): MappedAuditEntry[] {
    const rawEntries = (response.audit || []).filter(entry => (entry.action || '').toLowerCase() !== 'status_view');
    const mapped = rawEntries.map(entry => this.mapAuditEntry(entry));
    const withSynthetic = this.addSyntheticStatusEntries(response, mapped);
    const normalized = this.ensureStatusHistory(response, withSynthetic);
    return normalized.sort((a, b) => b.createdAt - a.createdAt);
  }

  private mapAuditEntry(entry: PublicStatusAuditEntry): MappedAuditEntry {
    return {
      ...entry,
      detailsObj: this.parseDetails(entry.details)
    };
  }

  private addSyntheticStatusEntries(response: PublicStatusResponse, entries: MappedAuditEntry[]): MappedAuditEntry[] {
    if (response.entityType !== 'notice') return entries.slice();
    const noticeEntries = entries.slice();
    const decision = response.decision;
    if (decision && Number.isFinite(decision.decidedAt)) {
      const hasDecidedChange = noticeEntries.some(e => {
        if ((e.action || '').toLowerCase() !== 'status_change') return false;
        const next = this.extractDetailStatus(e.detailsObj, ['status', 'newStatus', 'to', 'statusTo']);
        return next?.toUpperCase() === 'DECIDED';
      });
      if (!hasDecidedChange) {
        const previousStatus = this.resolveStatusBefore(decision.decidedAt, noticeEntries);
        const syntheticDetails = {
          status: 'DECIDED',
          previousStatus
        };
        noticeEntries.push({
          id: `synthetic-status-${decision.id}`,
          action: 'status_change',
          actor: decision.decidedBy || 'system',
          createdAt: decision.decidedAt,
          details: syntheticDetails,
          detailsObj: { ...syntheticDetails },
          synthetic: true
        });
      }
    }
    return noticeEntries;
  }

  private ensureStatusHistory(response: PublicStatusResponse, entries: MappedAuditEntry[]): MappedAuditEntry[] {
    if (response.entityType !== 'notice') return entries.slice();

    const clone = entries.map(entry => ({
      ...entry,
      detailsObj: entry.detailsObj ? { ...entry.detailsObj } : null,
      details: entry.detailsObj ? { ...entry.detailsObj } : entry.details
    }));

    const statusEntries = clone
      .filter(entry => (entry.action || '').toLowerCase() === 'status_change')
      .sort((a, b) => a.createdAt - b.createdAt);

    let currentStatus = this.resolveInitialStatus(clone);

    for (const entry of statusEntries) {
      const details = entry.detailsObj ?? {};
      const nextStatus = this.extractDetailStatus(details, ['status', 'newStatus', 'to', 'statusTo']);
      const previousStatus = this.extractDetailStatus(details, ['previousStatus', 'oldStatus', 'previous', 'from', 'statusFrom']);

      if (!previousStatus && currentStatus) {
        details['previousStatus'] = currentStatus;
      }
      if (!details['status'] && nextStatus) {
        details['status'] = nextStatus;
      }

      entry.detailsObj = { ...details };
      entry.details = { ...details };

      if (nextStatus) {
        currentStatus = nextStatus;
      }
    }

    return clone;
  }

  private resolveInitialStatus(entries: MappedAuditEntry[]): string {
    const creationEntry = entries
      .filter(entry => (entry.action || '').toLowerCase() === 'create')
      .sort((a, b) => a.createdAt - b.createdAt)[0];
    const initial = this.extractDetailStatus(creationEntry?.detailsObj, ['status', 'initialStatus']);
    return initial || 'RECEIVED';
  }

  private resolveStatusBefore(timestamp: number, entries: MappedAuditEntry[]): string {
    const statusEntries = entries
      .filter(entry => (entry.action || '').toLowerCase() === 'status_change')
      .sort((a, b) => a.createdAt - b.createdAt);

    let currentStatus = this.resolveInitialStatus(entries);
    for (const entry of statusEntries) {
      if (entry.createdAt >= timestamp) break;
      const nextStatus = this.extractDetailStatus(entry.detailsObj, ['status', 'newStatus', 'to', 'statusTo']);
      if (nextStatus) currentStatus = nextStatus;
    }
    return currentStatus;
  }

  private resolveFilename(disposition: string | null, fallback: string): string {
    if (!disposition) return fallback;
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(disposition);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1].replace(/"/g, ''));
      } catch {
        return match[1].replace(/"/g, '');
      }
    }
    return fallback;
  }
}
