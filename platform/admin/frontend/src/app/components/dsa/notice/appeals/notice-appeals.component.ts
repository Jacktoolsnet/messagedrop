import { CommonModule, DatePipe } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';

import { DsaAppeal } from '../../../../interfaces/dsa-appeal.interface';
import { DsaService } from '../../../../services/dsa/dsa/dsa.service';

@Component({
  selector: 'app-notice-appeals',
  standalone: true,
  imports: [CommonModule, DatePipe, MatIconModule, MatProgressBarModule, MatChipsModule],
  templateUrl: './notice-appeals.component.html',
  styleUrls: ['./notice-appeals.component.css']
})
export class NoticeAppealsComponent implements OnChanges {
  @Input({ required: true }) noticeId!: string;

  private readonly dsa = inject(DsaService);
  private readonly snack = inject(MatSnackBar);

  readonly loading = signal(false);
  readonly appeals = signal<DsaAppeal[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (!('noticeId' in changes)) return;

    const id = this.noticeId;
    if (!id) {
      this.appeals.set([]);
      return;
    }

    this.fetch(id);
  }

  private fetch(id: string): void {
    this.loading.set(true);
    this.dsa.listAppeals({ noticeId: id, status: 'all' }).subscribe({
      next: rows => {
        const sorted = (rows ?? []).slice().sort((a, b) => (b?.filedAt ?? 0) - (a?.filedAt ?? 0));
        this.appeals.set(sorted);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snack.open('Could not load appeals.', 'OK', { duration: 3000 });
      }
    });
  }

  outcomeLabel(appeal: DsaAppeal): string {
    if (!appeal.outcome) return 'Pending';
    return appeal.outcome.replace(/_/g, ' ').toLowerCase();
  }

  outcomeClass(appeal: DsaAppeal): string {
    const outcome = (appeal.outcome || '').toUpperCase();
    switch (outcome) {
      case 'UPHELD': return 'chip-upheld';
      case 'OVERTURNED': return 'chip-overturned';
      case 'PARTIALLY_UPHELD': return 'chip-partial';
      default: return appeal.outcome ? 'chip-default' : 'chip-pending';
    }
  }

  formatOutcome(value: string | null | undefined): string {
    if (!value) return '—';
    return value.replace(/_/g, ' ').toLowerCase();
  }

  isResolved(appeal: DsaAppeal): boolean {
    return !!appeal.resolvedAt;
  }

  trackById(_index: number, appeal: DsaAppeal): string {
    return appeal.id;
  }
}
