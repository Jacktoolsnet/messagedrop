// src/app/components/dsa/audit/audit-dashboard/audit-dashboard.component.ts
import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { DsaAuditEntry } from '../../../interfaces/dsa-audit-entry.interface';
import { DsaService } from '../../../services/dsa/dsa/dsa.service';
import { NoticeDetailComponent } from '../notice/notice-detail/notice-detail.component';

@Component({
  selector: 'app-audits',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule,
    MatToolbarModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatProgressBarModule
  ],
  templateUrl: './audits.component.html',
  styleUrls: ['./audits.component.css']
})
export class AuditsComponent implements OnInit {
  private dsa = inject(DsaService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);

  loading = signal(false);
  items = signal<DsaAuditEntry[]>([]);

  filterForm = this.fb.nonNullable.group({
    entityType: [''],
    action: [''],
    range: ['7d'], // 24h | 7d | 30d | all
    q: ['']
  });

  ngOnInit(): void {
    // ensure we start at top when opening the view
    queueMicrotask(() => {
      try { window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); } catch {}
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
      entityType: (['notice', 'signal', 'decision', 'public_message', 'user', 'other'].includes(v.entityType) ? v.entityType as 'notice' | 'signal' | 'decision' | 'public_message' | 'user' | 'other' : undefined),
      action: (['create', 'status_change', 'evidence_add', 'notify', 'delete'].includes(v.action) ? v.action as 'create' | 'status_change' | 'evidence_add' | 'notify' | 'delete' : undefined),
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
      default: return a || 'Event';
    }
  }

  detailRows(e: DsaAuditEntry): Array<{ k: string; v: string }> {
    const rows: Array<{ k: string; v: string }> = [
      { k: 'Actor', v: e.actor },
      { k: 'Entity', v: `${e.entityType} • ${e.entityId}` },
      { k: 'ID', v: e.id }
    ];
    const d = e.details as any;
    if (d && typeof d === 'object') {
      // bekannte Felder hübsch benennen
      if (typeof d.status === 'string') rows.push({ k: 'Changed to', v: d.status });
      if (typeof d.newStatus === 'string') rows.push({ k: 'Changed to', v: d.newStatus });
      if (typeof d.evidenceId === 'string') rows.push({ k: 'Evidence ID', v: d.evidenceId });
      if (typeof d.type === 'string') rows.push({ k: 'Type', v: d.type });
      if (typeof d.signalId === 'string') rows.push({ k: 'Signal ID', v: d.signalId });
      if (typeof d.noticeId === 'string') rows.push({ k: 'Notice ID', v: d.noticeId });
      if (typeof d.outcome === 'string') rows.push({ k: 'Outcome', v: d.outcome });
    }
    return rows;
  }

  // Drill-down: Notice öffnen, wenn möglich
  openEntity(e: DsaAuditEntry): void {
    if (e.entityType === 'notice') {
      this.dialog.open(NoticeDetailComponent, {
        data: { noticeId: e.entityId },
        width: 'min(900px, 96vw)',
        maxHeight: '90vh',
        panelClass: 'md-dialog-rounded'
      });
    } else {
      this.snack.open(`No detail view for ${e.entityType}.`, 'OK', { duration: 2000 });
    }
  }

  trackById(_i: number, e: DsaAuditEntry) { return e.id; }
}
