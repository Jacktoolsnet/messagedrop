import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { debounceTime, distinctUntilChanged, map, Subscription } from 'rxjs';

import { DsaNoticeFilters, DsaNoticeRange } from '../../../../interfaces/dsa-notice-filters.interface';
import { DSA_NOTICE_STATUSES, DsaNoticeStatus } from '../../../../interfaces/dsa-notice-status.type';
import { DsaNotice } from '../../../../interfaces/dsa-notice.interface';

// Optional: Detail-Dialog erst später implementieren – Hook ist schon da
import { MatDialog } from '@angular/material/dialog';
import { RouterLink } from '@angular/router';
import { DsaService } from '../../../../services/dsa/dsa/dsa.service';
import { DecisionDialogComponent } from '../../decisions/decision-dialog/decision-dialog.component';
import { NoticeDetailComponent } from '../notice-detail/notice-detail.component';
import { NotifyDialogComponent } from '../notify-dialog/notify-dialog.component';

@Component({
  selector: 'app-notices',
  standalone: true,
  imports: [
    RouterLink,
    CommonModule,
    ReactiveFormsModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatProgressBarModule,
    MatBadgeModule,
    MatChipsModule,
  ],
  templateUrl: './notices.component.html',
  styleUrls: ['./notices.component.css']
})
export class NoticesComponent implements OnInit, OnDestroy {

  private dsa = inject(DsaService);
  private snack = inject(MatSnackBar);
  private fb = inject(FormBuilder);
  private dialog = inject(MatDialog);

  protected loading = signal(false);
  protected notices = signal<DsaNotice[]>([]);
  protected statuses = DSA_NOTICE_STATUSES;

  // „Offene“ Stati = Arbeitsvorrat
  /** Filter-Form – Status (multi), Type, Category, Q, Range */
  protected filterForm = this.fb.nonNullable.group({
    status: this.fb.nonNullable.control<DsaNoticeStatus>('RECEIVED'),
    reportedContentType: [''],
    category: [''],
    q: [''],
    range: ['all' as DsaNoticeRange]
  });

  private subs: Subscription[] = [];

  ngOnInit(): void {
    // Initial laden
    this.load();

    // Filter-Änderungen beobachten
    const sub = this.filterForm.valueChanges
      .pipe(
        debounceTime(250),
        map(v => JSON.stringify(v)),
        distinctUntilChanged()
      )
      .subscribe(() => this.load());
    this.subs.push(sub);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  /** Baut das Filterobjekt fürs Backend aus dem Formular */
  private toFilters(): DsaNoticeFilters {
    const v = this.filterForm.getRawValue();
    return {
      status: v.status ? [v.status] : undefined,
      reportedContentType: v.reportedContentType || undefined,
      category: v.category || undefined,
      q: v.q || undefined,
      range: v.range || '24h',
      limit: 100,
      offset: 0
    };
  }

  /** Lädt die Liste */
  load(): void {
    this.loading.set(true);
    this.dsa.listNotices(this.toFilters()).subscribe({
      next: rows => this.notices.set(rows || []),
      error: () => this.snack.open('Could not load notices.', 'OK', { duration: 3000 }),
      complete: () => this.loading.set(false)
    });
  }

  reload(): void {
    this.load();
  }

  statusFilter(): DsaNoticeStatus {
    return this.filterForm.controls.status.value;
  }

  setStatus(status: DsaNoticeStatus | null): void {
    if (!status) return;
    const control = this.filterForm.controls.status;
    if (control.value === status) return;
    control.setValue(status);
  }

  /** Detail öffnen (Dialog – Placeholder; Komponente liefern wir im nächsten Schritt) */
  detail(n: DsaNotice) {
    const ref = this.dialog.open(NoticeDetailComponent, {
      data: n,                             // ganzen Datensatz reinreichen
      width: 'auto',
      maxWidth: '96vw',
      maxHeight: '90vh',
      panelClass: 'md-dialog-rounded'      // optional
    });

    // Wenn der Dialog „true“ zurückgibt, Liste refreshen (z. B. nach Statuswechsel)
    ref.afterClosed().subscribe(updated => {
      if (updated) {
        this.reload?.();                   // falls du eine reload()-Methode hast
      }
    });
  }

  /** Helper: reportedContent kurz aufbereiten */
  getMessagePreview(n: DsaNotice): string {
    const rc = this.safeParse(n.reportedContent);
    // mögliche Felder aus deinem PublicMessage-Modell
    const msg: string | undefined = rc?.message;
    const title: string | undefined = rc?.multimedia?.title;
    const desc: string | undefined = rc?.multimedia?.description;
    return (msg || title || desc || '').toString().trim();
  }

  /** Helper: JSON sicher parsen */
  private safeParse(json: string | undefined | null): any {
    if (!json) return null;
    try { return JSON.parse(json); } catch { return null; }
  }

  /** trackBy */
  trackById(_i: number, n: DsaNotice): string { return n.id; }

  private readonly STATUS_META: Record<DsaNoticeStatus, {
    label: string; icon: string; class: string;
  }> = {
      RECEIVED: { label: 'Received', icon: 'mark_email_unread', class: 'status-received' },
      UNDER_REVIEW: { label: 'Under review', icon: 'manage_search', class: 'status-under-review' },
      DECIDED: { label: 'Decided', icon: 'gavel', class: 'status-decided' },
    };

  statusLabel(s: string) { const k = s as DsaNoticeStatus; return this.STATUS_META[k]?.label ?? s; }
  statusIcon(s: string) { const k = s as DsaNoticeStatus; return this.STATUS_META[k]?.icon ?? 'help'; }
  statusClass(s: string) { const k = s as DsaNoticeStatus; return this.STATUS_META[k]?.class ?? 'status-default'; }

  /** Entscheidung erfassen (ändert Status → DECIDED) */
  decide(n: DsaNotice): void {
    const ref = this.dialog.open(DecisionDialogComponent, {
      data: { noticeId: n.id },
      width: 'min(700px, 96vw)',
      maxHeight: '90vh',
      panelClass: 'md-dialog-rounded'
    });

    ref.afterClosed().subscribe((saved) => {
      if (saved) {
        // Nach dem Speichern Liste aktualisieren (oder gezielt nur dieses Item)
        this.reload();
      }
    });
  }

  /** Benachrichtigung senden (öffnet NotifyDialog) */
  notify(n: DsaNotice): void {
    const ref = this.dialog.open(NotifyDialogComponent, {
      data: { noticeId: n.id },
      width: 'min(600px, 96vw)',
      maxHeight: '90vh',
      panelClass: 'md-dialog-rounded'
    });

    ref.afterClosed().subscribe(sent => {
      if (sent) {
        this.snack.open('Notification sent.', 'OK', { duration: 2500 });
        this.reload(); // optional – falls z. B. Audit neu geladen werden soll
      }
    });
  }
}
