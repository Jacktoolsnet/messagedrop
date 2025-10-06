import { DatePipe } from '@angular/common';
import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
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
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog.component';


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
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatChipsModule,
    MatMenuModule,
    MatProgressBarModule,
    MatBadgeModule
  ],
  templateUrl: './signals.component.html',
  styleUrls: ['./signals.component.css']
})
export class SignalsComponent {
  private router = inject(Router);
  private auth = inject(AuthService);
  private dsa = inject(DsaService);
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  get username() { return this.auth.username; }
  get role() { return this.auth.role; }

  // Filter-Form (type/category/search + Zeitraum)
  readonly filterForm = this.fb.nonNullable.group({
    type: [''],
    category: [''],
    q: [''],
    range: ['7d'] as ('24h' | '7d' | '30d' | 'all')[]
  });

  // Data
  readonly loading = signal(false);
  readonly signals = signal<DsaSignal[]>([]);
  readonly selected: DsaSignal | null = null;

  constructor() {
    // Initial laden
    this.reload();

    // Reaktiv nach Filter-Änderung (kleines Debounce via setTimeout)
    let t: any;
    effect(() => {
      const f = this.filterForm.value;
      clearTimeout(t);
      t = setTimeout(() => this.reload(), 250);
    });
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

  reload() {
    const f = this.filterForm.value;
    this.loading.set(true);
    this.dsa.listSignals({
      type: f.type || undefined,
      category: f.category || undefined,
      q: f.q || undefined,
      since: this.sinceFromRange(f.range || '7d'),
      limit: 50,
      offset: 0
    }).subscribe(items => {
      this.signals.set(items);
      this.loading.set(false);
    });
  }

  isNew(s: DsaSignal) {
    return (Date.now() - s.createdAt) <= 24 * 60 * 60 * 1000;
  }

  openDetail(s: DsaSignal) {
    // Hier simpel in-place (kannst auch Dialog nehmen)
    // Für Demo: kurzer Snack mit Info + optional Router-Link
    this.snack.open(`Signal ${s.id} — ${s.reportedContentType}`, 'View JSON', { duration: 4000 })
      .onAction().subscribe(() => {
        // navigate to a detail route if you create one later:
        // this.router.navigate(['/dashboard/dsa/signals', s.id]);
        // oder einfach neuen Tab mit contentUrl:
        if (s.contentUrl) window.open(s.contentUrl, '_blank');
      });
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