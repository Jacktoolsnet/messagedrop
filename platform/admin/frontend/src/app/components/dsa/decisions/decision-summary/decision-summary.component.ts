import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { DsaDecision } from '../../../../interfaces/dsa-decision.interface';
import { DsaService } from '../../../../services/dsa/dsa/dsa.service';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { DisplayMessageService } from '../../../../services/display-message.service';

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
  private snack = inject(DisplayMessageService);
  readonly i18n = inject(TranslationHelperService);

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
        this.snack.open(this.i18n.t('Could not load decision.'), this.i18n.t('OK'), { duration: 3000 });
      }
    });
  }

  refresh(): void {
    this.fetchDecision();
  }

  private mapOutcome(o?: string): string {
    switch (o) {
      case 'REMOVE_CONTENT': return this.i18n.t('Remove content');
      case 'RESTRICT': return this.i18n.t('Restrict / mask');
      case 'NO_ACTION': return this.i18n.t('No action');
      case 'FORWARD_TO_AUTHORITY': return this.i18n.t('Forward to authority');
      default: return o || this.i18n.t('—');
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
