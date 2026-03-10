// src/app/components/dsa/audit/audit-dashboard/audit-dashboard.component.ts
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { DsaAuditEntry } from '../../../interfaces/dsa-audit-entry.interface';
import { DsaService } from '../../../services/dsa/dsa/dsa.service';
import { NoticeDetailComponent } from '../notice/notice-detail/notice-detail.component';

const AUDIT_ENTITY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'notice', label: 'Notice' },
  { value: 'signal', label: 'Signal' },
  { value: 'decision', label: 'Decision' },
  { value: 'public_message', label: 'Public message' },
  { value: 'platform_user', label: 'Platform user' },
  { value: 'user', label: 'User' },
  { value: 'other', label: 'Other' }
] as const;

const AUDIT_ACTION_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'create', label: 'Create' },
  { value: 'status_change', label: 'Status change' },
  { value: 'evidence_add', label: 'Evidence add' },
  { value: 'notify', label: 'Notify' },
  { value: 'delete', label: 'Delete' },
  { value: 'platform_user_posting_block', label: 'Posting block' },
  { value: 'platform_user_posting_unblock', label: 'Posting unblock' },
  { value: 'platform_user_account_block', label: 'Account block' },
  { value: 'platform_user_account_unblock', label: 'Account unblock' },
  { value: 'platform_user_appeal_create', label: 'Appeal created' },
  { value: 'platform_user_appeal_accept', label: 'Appeal accepted' },
  { value: 'platform_user_appeal_reject', label: 'Appeal rejected' },
  { value: 'platform_user_appeal_auto_accept', label: 'Appeal auto-accepted' }
] as const;

@Component({
  selector: 'app-audits',
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule,
    MatToolbarModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatProgressBarModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './audits.component.html',
  styleUrls: ['./audits.component.css']
})
export class AuditsComponent implements OnInit {
  private dsa = inject(DsaService);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);

  loading = signal(false);
  items = signal<DsaAuditEntry[]>([]);
  readonly entityOptions = AUDIT_ENTITY_OPTIONS;
  readonly actionOptions = AUDIT_ACTION_OPTIONS;

  filterForm = this.fb.nonNullable.group({
    entityType: [''],
    action: [''],
    range: ['7d'], // 24h | 7d | 30d | all
    q: ['']
  });

  ngOnInit(): void {
    // ensure we start at top when opening the view
    queueMicrotask(() => {
      try {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      } catch (error) {
        console.warn('Unable to reset scroll position', error);
      }
    });
    this.load();
    this.filterForm.valueChanges.pipe(debounceTime(250)).subscribe(() => this.load());
  }

  private sinceFromRange(): number | undefined {
    const r = this.filterForm.getRawValue().range;
    const now = Date.now();
    switch (r) {
      case '24h': return now - 24 * 60 * 60 * 1000;
      case '7d': return now - 7 * 24 * 60 * 60 * 1000;
      case '30d': return now - 30 * 24 * 60 * 60 * 1000;
      default: return undefined;
    }
  }

  load(): void {
    const v = this.filterForm.getRawValue();
    this.loading.set(true);
    this.dsa.listAudit({
      entityType: this.isKnownEntityType(v.entityType) ? v.entityType : undefined,
      action: this.isKnownAction(v.action) ? v.action : undefined,
      q: v.q || undefined,
      since: this.sinceFromRange(),
      limit: 100,
      offset: 0
    }).subscribe({
      next: rows => { this.items.set(rows || []); this.loading.set(false); },
      error: () => { this.loading.set(false); }
    });
  }

  // Darstellungshilfen
  iconForAction(a: string): string {
    switch ((a || '').toLowerCase()) {
      case 'create': return 'add_circle';
      case 'status_change': return 'swap_horiz';
      case 'evidence_add': return 'attach_file';
      case 'notify': return 'notifications_active';
      case 'delete': return 'delete';
      case 'platform_user_posting_block': return 'edit_off';
      case 'platform_user_posting_unblock': return 'check_circle';
      case 'platform_user_account_block': return 'person_off';
      case 'platform_user_account_unblock': return 'person';
      case 'platform_user_appeal_create': return 'gavel';
      case 'platform_user_appeal_accept': return 'task_alt';
      case 'platform_user_appeal_reject': return 'cancel';
      case 'platform_user_appeal_auto_accept': return 'rule';
      default: return 'history';
    }
  }
  labelForAction(a: string): string {
    switch ((a || '').toLowerCase()) {
      case 'create': return 'Created';
      case 'status_change': return 'Status changed';
      case 'evidence_add': return 'Evidence added';
      case 'notify': return 'Notification sent';
      case 'delete': return 'Deleted';
      case 'platform_user_posting_block': return 'Posting blocked';
      case 'platform_user_posting_unblock': return 'Posting unblocked';
      case 'platform_user_account_block': return 'Account blocked';
      case 'platform_user_account_unblock': return 'Account unblocked';
      case 'platform_user_appeal_create': return 'Appeal created';
      case 'platform_user_appeal_accept': return 'Appeal accepted';
      case 'platform_user_appeal_reject': return 'Appeal rejected';
      case 'platform_user_appeal_auto_accept': return 'Appeal auto-accepted';
      default: return a || 'Event';
    }
  }

  labelForEntityType(entityType: string): string {
    switch ((entityType || '').toLowerCase()) {
      case 'platform_user':
        return 'Platform user';
      case 'public_message':
        return 'Public message';
      case 'notice':
        return 'Notice';
      case 'signal':
        return 'Signal';
      case 'decision':
        return 'Decision';
      case 'user':
        return 'User';
      case 'other':
        return 'Other';
      default:
        return entityType || 'Unknown';
    }
  }

  detailRows(e: DsaAuditEntry): { k: string; v: string }[] {
    const rows: { k: string; v: string }[] = [
      { k: 'Actor', v: e.actor },
      { k: 'Entity', v: `${this.labelForEntityType(e.entityType)} • ${e.entityId}` },
      { k: 'ID', v: e.id }
    ];
    const details = this.asDetails(e);
    const changed = this.detailValue(details, 'status') ?? this.detailValue(details, 'newStatus');
    if (changed) rows.push({ k: 'Changed to', v: changed });
    const target = this.detailValue(details, 'target');
    if (target) rows.push({ k: 'Target', v: this.labelForTarget(target) });
    const reason = this.detailValue(details, 'reason');
    if (reason) rows.push({ k: 'Reason', v: reason });
    const blockedUntil = this.detailTimestamp(details, 'blockedUntil');
    if (blockedUntil) rows.push({ k: 'Blocked until', v: blockedUntil });
    const evidenceId = this.detailValue(details, 'evidenceId');
    if (evidenceId) rows.push({ k: 'Evidence ID', v: evidenceId });
    const type = this.detailValue(details, 'type');
    if (type) rows.push({ k: 'Type', v: type });
    const signalId = this.detailValue(details, 'signalId');
    if (signalId) rows.push({ k: 'Signal ID', v: signalId });
    const noticeId = this.detailValue(details, 'noticeId');
    if (noticeId) rows.push({ k: 'Notice ID', v: noticeId });
    const outcome = this.detailValue(details, 'outcome');
    if (outcome) rows.push({ k: 'Outcome', v: outcome });
    const appealId = this.detailValue(details, 'appealId');
    if (appealId) rows.push({ k: 'Appeal ID', v: appealId });
    const trigger = this.detailValue(details, 'trigger');
    if (trigger) rows.push({ k: 'Trigger', v: this.labelForTrigger(trigger) });
    const reviewer = this.detailValue(details, 'reviewer');
    if (reviewer) rows.push({ k: 'Reviewer', v: reviewer });
    const resolutionMessage = this.detailValue(details, 'resolutionMessage');
    if (resolutionMessage) rows.push({ k: 'Resolution', v: resolutionMessage });
    const message = this.detailValue(details, 'message');
    if (message) rows.push({ k: 'Appeal message', v: message });
    return rows;
  }

  private asDetails(entry: DsaAuditEntry): Record<string, unknown> {
    return entry.details ?? {};
  }

  private detailValue(details: Record<string, unknown>, key: string): string | null {
    const value = details[key];
    if (value === undefined || value === null) return null;
    return typeof value === 'string' ? value : String(value);
  }

  private detailTimestamp(details: Record<string, unknown>, key: string): string | null {
    const value = details[key];
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(parsed));
  }

  private labelForTarget(target: string): string {
    switch ((target || '').toLowerCase()) {
      case 'posting':
        return 'Posting';
      case 'account':
        return 'Account';
      default:
        return target;
    }
  }

  private labelForTrigger(trigger: string): string {
    switch ((trigger || '').toLowerCase()) {
      case 'moderator_unblock':
        return 'Moderator unblock';
      default:
        return trigger;
    }
  }

  canOpenEntity(entry: DsaAuditEntry): boolean {
    return entry.entityType === 'notice';
  }

  // Drill-down: Notice öffnen, wenn möglich
  openEntity(e: DsaAuditEntry): void {
    if (!this.canOpenEntity(e)) {
      return;
    }
    this.dialog.open(NoticeDetailComponent, {
      data: { noticeId: e.entityId },
      width: 'min(900px, 96vw)',
      maxHeight: '90vh',
      panelClass: 'md-dialog-rounded'
    });
  }

  trackById(_i: number, e: DsaAuditEntry) { return e.id; }

  private isKnownEntityType(value: string): value is NonNullable<DsaAuditEntry['entityType']> {
    return this.entityOptions.some((option) => option.value === value && option.value !== '');
  }

  private isKnownAction(value: string): boolean {
    return this.actionOptions.some((option) => option.value === value && option.value !== '');
  }
}
