import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map, Subscription } from 'rxjs';

import { MatDialog } from '@angular/material/dialog';
import { DsaNoticeFilters, DsaNoticeRange } from '../../../../interfaces/dsa-notice-filters.interface';
import { DsaNotice } from '../../../../interfaces/dsa-notice.interface';
import { DsaService } from '../../../../services/dsa/dsa/dsa.service';
import { NoticeDetailComponent } from '../../notice/notice-detail/notice-detail.component';

@Component({
  selector: 'app-decisions',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatToolbarModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCardModule, MatProgressBarModule, MatChipsModule
  ],
  templateUrl: './decisions.component.html',
  styleUrls: ['./decisions.component.css']
})
export class DecisionsComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private dsa = inject(DsaService);
  private snack = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  loading = signal(false);
  items = signal<DsaNotice[]>([]);

  // Filter: wir fixieren status=DECIDED, alles andere ist wählbar
  filtersForm = this.fb.nonNullable.group({
    reportedContentType: [''],
    category: [''],
    q: [''],
    range: ['30d' as DsaNoticeRange] // für Entscheidungen meist längerer Blick
  });

  private subs: Subscription[] = [];

  ngOnInit(): void {
    this.load();

    const sub = this.filtersForm.valueChanges
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

  private toFilters(): DsaNoticeFilters {
    const v = this.filtersForm.getRawValue();
    return {
      status: ['DECIDED'],
      reportedContentType: v.reportedContentType || undefined,
      category: v.category || undefined,
      q: v.q || undefined,
      range: v.range || '30d',
      limit: 100,
      offset: 0
    };
  }

  load(): void {
    this.loading.set(true);
    this.dsa.listNotices(this.toFilters()).subscribe({
      next: rows => this.items.set(rows || []),
      error: () => this.snack.open('Could not load decisions.', 'OK', { duration: 3000 }),
      complete: () => this.loading.set(false)
    });
  }

  reload(): void { this.load(); }

  openSummary(n: DsaNotice): void {
    const ref = this.dialog.open(NoticeDetailComponent, {
      data: n,
      width: '96vw',
      minWidth: '96vw',
      maxHeight: '90vh',
      panelClass: 'md-dialog-rounded'
    });
    ref.afterClosed().subscribe(updated => { if (updated) this.reload(); });
  }

  // kleine Helfer für Preview
  preview(n: DsaNotice): string {
    try {
      const rc = n.reportedContent ? JSON.parse(n.reportedContent) : null;
      return (rc?.message || rc?.multimedia?.title || rc?.multimedia?.description || '').toString().trim();
    } catch { return ''; }
  }

  trackById(_i: number, n: DsaNotice) { return n.id; }
}