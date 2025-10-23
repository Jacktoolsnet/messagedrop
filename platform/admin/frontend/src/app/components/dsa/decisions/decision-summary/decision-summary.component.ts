import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DsaDecision } from '../../../../interfaces/dsa-decision.interface';
import { DsaService } from '../../../../services/dsa/dsa/dsa.service';

@Component({
  selector: 'app-decision-summary',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatProgressBarModule],
  templateUrl: './decision-summary.component.html',
  styleUrls: ['./decision-summary.component.css']
})
export class DecisionSummaryComponent implements OnChanges {
  @Input() noticeId: string | null = null;

  private dsa = inject(DsaService);
  private snack = inject(MatSnackBar);

  loading = signal(false);
  decision = signal<DsaDecision | null>(null);

  outcomeLabel = '';
  outcomeColor = '';

  ngOnChanges(changes: SimpleChanges): void {
    if ('noticeId' in changes) {
      this.fetchDecision();
    }
  }

  private fetchDecision(): void {
    this.decision.set(null);
    if (!this.noticeId) return;
    this.loading.set(true);
    this.dsa.getDecisionForNotice(this.noticeId).subscribe({
      next: (d) => {
        this.decision.set(d || null);
        this.outcomeLabel = this.mapOutcome(d?.outcome);
        this.outcomeColor = this.mapColor(d?.outcome);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.decision.set(null);
        this.snack.open('Could not load decision.', 'OK', { duration: 3000 });
      }
    });
  }

  refresh(): void {
    this.fetchDecision();
  }

  private mapOutcome(o?: string): string {
    switch (o) {
      case 'REMOVE_CONTENT': return 'Remove content';
      case 'RESTRICT': return 'Restrict / mask';
      case 'NO_ACTION': return 'No action';
      case 'FORWARD_TO_AUTHORITY': return 'Forward to authority';
      default: return o || '—';
    }
  }

  private mapColor(o?: string): string {
    switch (o) {
      case 'REMOVE_CONTENT': return 'outcome-remove';
      case 'RESTRICT': return 'outcome-restrict';
      case 'NO_ACTION': return 'outcome-ok';
      case 'FORWARD_TO_AUTHORITY': return 'outcome-forward';
      default: return 'outcome-default';
    }
  }
}
