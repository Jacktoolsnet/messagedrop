import { DatePipe } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { DsaSignal } from '../../../../interfaces/dsa-signal.interface';
import { AuthService } from '../../../../services/auth/auth.service';
import { DsaService } from '../../../../services/dsa/dsa/dsa.service';
import { TranslateService } from '../../../../services/translate-service/translate-service.service';
import { debounceTime, distinctUntilChanged, map, Subscription } from 'rxjs';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog.component';
import { SignalDetailComponent } from '../signal-detail/signal-detail.component';

type SignalStatusFilter = 'open' | 'dismissed';
type SignalRangeFilter = '24h' | '7d' | '30d' | 'all';

@Component({
  selector: 'app-dsa-signals',
  standalone: true,
  imports: [
    RouterLink,
    DatePipe,
    ReactiveFormsModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatMenuModule,
    MatDividerModule,
    MatProgressBarModule,
    MatBadgeModule
  ],
  templateUrl: './signals.component.html',
  styleUrls: ['./signals.component.css']
})
export class SignalsComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private auth = inject(AuthService);
  private dsa = inject(DsaService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private translate = inject(TranslateService);

  // Übersetzungen im Speicher (id -> Text)
  private tMsg = signal<Record<string, string>>({});
  private tReason = signal<Record<string, string>>({});

  translatedMessage(id: string): string | null { return this.tMsg()[id] ?? null; }
  translatedReason(id: string): string | null { return this.tReason()[id] ?? null; }

  /** Extrahiert "message" aus reportedContent (JSON). */
  getMessage(s: DsaSignal): string | null {
    try {
      const obj = JSON.parse(s.reportedContent || '{}');
      return (obj?.message && String(obj.message).trim()) ? String(obj.message) : null;
    } catch {
      return null;
    }
  }

  translateMessage(s: DsaSignal) {
    const msg = this.getMessage(s);
    if (!msg) {
      this.snack.open('No message to translate.', 'OK', { duration: 2000 });
      return;
    }
    this.translate.translateToGerman(msg).subscribe({
      next: text => this.tMsg.update(m => ({ ...m, [s.id]: text })),
      error: () => this.snack.open('Translation failed.', 'OK', { duration: 2500 })
    });
  }

  translateReason(s: DsaSignal) {
    const r = s.reasonText?.trim();
    if (!r) {
      this.snack.open('No reason to translate.', 'OK', { duration: 2000 });
      return;
    }
    this.translate.translateToGerman(r).subscribe({
      next: text => this.tReason.update(m => ({ ...m, [s.id]: text })),
      error: () => this.snack.open('Translation failed.', 'OK', { duration: 2500 })
    });
  }

  get username() { return this.auth.username; }
  get role() { return this.auth.role; }
  readonly signalStatuses: SignalStatusFilter[] = ['open', 'dismissed'];
  readonly ranges: SignalRangeFilter[] = ['24h', '7d', '30d', 'all'];

  // Filter-Form (type/category/search + Zeitraum)
  readonly filterForm = this.fb.nonNullable.group({
    status: ['open' as SignalStatusFilter],
    type: [''],
    category: [''],
    q: [''],
    range: ['all' as SignalRangeFilter]
  });

  // Data
  readonly loading = signal(false);
  readonly signals = signal<DsaSignal[]>([]);
  readonly selected: DsaSignal | null = null;
  private subs: Subscription[] = [];
  private loadRequestId = 0;
  constructor() { }

  ngOnInit(): void {
    // Initial laden
    this.reload();

    const statusSub = this.filterForm.controls.status.valueChanges
      .pipe(distinctUntilChanged())
      .subscribe((status) => this.reload({ status }));
    this.subs.push(statusSub);

    const rangeSub = this.filterForm.controls.range.valueChanges
      .pipe(distinctUntilChanged())
      .subscribe((range) => this.reload({ range }));
    this.subs.push(rangeSub);

    let textSnapshot = JSON.stringify({
      type: this.filterForm.controls.type.value ?? '',
      category: this.filterForm.controls.category.value ?? '',
      q: this.filterForm.controls.q.value ?? ''
    });

    const textSub = this.filterForm.valueChanges
      .pipe(
        debounceTime(250),
        map(v => JSON.stringify({
          type: v.type ?? '',
          category: v.category ?? '',
          q: v.q ?? ''
        })),
        distinctUntilChanged()
      )
      .subscribe((nextSnapshot) => {
        if (nextSnapshot === textSnapshot) return;
        textSnapshot = nextSnapshot;
        this.reload();
      });
    this.subs.push(textSub);
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  private sinceFromRange(range: string | null | undefined): number | undefined {
    const now = Date.now();
    switch (range) {
      case '24h': return now - 24 * 60 * 60 * 1000;
      case '7d': return now - 7 * 24 * 60 * 60 * 1000;
      case '30d': return now - 30 * 24 * 60 * 60 * 1000;
      default: return undefined;
    }
  }

  reload(overrides?: { status?: SignalStatusFilter; range?: SignalRangeFilter }) {
    const f = this.filterForm.value;
    const status = overrides?.status ?? f.status ?? 'open';
    const range = overrides?.range ?? f.range ?? 'all';
    const requestId = ++this.loadRequestId;
    this.loading.set(true);
    this.dsa.listSignals({
      status,
      type: f.type || undefined,
      category: f.category || undefined,
      q: f.q || undefined,
      since: this.sinceFromRange(range),
      limit: 50,
      offset: 0
    }).subscribe({
      next: (items) => {
        if (requestId !== this.loadRequestId) return;
        this.signals.set(items || []);
      },
      complete: () => {
        if (requestId !== this.loadRequestId) return;
        this.loading.set(false);
      }
    });
  }

  statusFilter(): SignalStatusFilter {
    return this.filterForm.controls.status.value;
  }

  setStatus(status: SignalStatusFilter | null): void {
    if (!status) return;
    const control = this.filterForm.controls.status;
    if (control.value === status) return;
    control.setValue(status);
  }

  statusLabel(status: SignalStatusFilter): string {
    if (status === 'dismissed') return 'Dismissed';
    return 'Open';
  }

  rangeFilter(): SignalRangeFilter {
    return this.filterForm.controls.range.value;
  }

  setRange(range: SignalRangeFilter | null): void {
    if (!range) return;
    const control = this.filterForm.controls.range;
    if (control.value === range) return;
    control.setValue(range);
  }

  rangeLabel(range: SignalRangeFilter): string {
    if (range === '24h') return '24h';
    if (range === '7d') return '7d';
    if (range === '30d') return '30d';
    return 'All';
  }

  isNew(s: DsaSignal) {
    return (Date.now() - s.createdAt) <= 24 * 60 * 60 * 1000;
  }

  openDetail(s: DsaSignal) {
    const ref = this.dialog.open(SignalDetailComponent, {
      data: {
        source: 'signal',
        signalId: s.id,
        reportedContent: s.reportedContent, // JSON-String aus DB
        contentUrl: s.contentUrl,
        category: s.category,
        reasonText: s.reasonText,
        createdAt: s.createdAt,
        status: undefined
      },
      panelClass: 'mdp-dialog-xl',
      width: 'min(1500px, 96vw)',
      maxWidth: '96vw',
      maxHeight: '92vh',
      autoFocus: false
    });
    ref.afterClosed().subscribe(() => this.reload());
  }

  promote(s: DsaSignal) {
    this.dsa.promoteSignal(s.id).subscribe({
      next: (res) => {
        this.reload();
        this.snack.open('Signal promoted to Notice.', 'Open Notice', { duration: 4000 })
          .onAction().subscribe(() => {
            this.router.navigate(['/dashboard/dsa/notices', res.noticeId]);
          });
      }
    });
  }

  dismiss(s: DsaSignal) {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Signal?',
        message: `Signal for content "${s.contentId}" will be delted permanently.`,
        confirmText: 'Delete',
        cancelText: 'Cancle',
        warn: true
      }
    });

    ref.afterClosed().subscribe(ok => {
      if (!ok) return;
      this.dsa.deleteSignal(s.id).subscribe({
        next: () => {
          this.snack.open('Signal deleted.', 'OK', { duration: 2500 });
          this.reload();
        }
      });
    });
  }

  goBack() { this.router.navigate(['/dashboard/dsa']); }
  trackById = (_: number, s: DsaSignal) => s.id;
}
