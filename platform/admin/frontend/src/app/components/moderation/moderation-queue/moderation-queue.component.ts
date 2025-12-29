import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { ModerationRequest } from '../../../interfaces/moderation-request.interface';
import { ModerationService } from '../../../services/moderation.service';
import { TranslateService } from '../../../services/translate-service/translate-service.service';

@Component({
  selector: 'app-moderation-queue',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatDividerModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatSelectModule
  ],
  templateUrl: './moderation-queue.component.html',
  styleUrls: ['./moderation-queue.component.css']
})
export class ModerationQueueComponent implements OnInit {
  private readonly moderationService = inject(ModerationService);
  private readonly snack = inject(MatSnackBar);
  private readonly translator = inject(TranslateService);

  readonly loading = signal(false);
  readonly actionLoading = signal(false);
  readonly translateLoading = signal(false);
  readonly requests = signal<ModerationRequest[]>([]);
  readonly selected = signal<ModerationRequest | null>(null);
  readonly translatedText = signal<string>('');

  rejectionReason = '';

  readonly reasons = [
    'Hate speech or harassment',
    'Violence or threats',
    'Sexual content',
    'Illegal activity',
    'Spam or scams',
    'Privacy or personal data',
    'Copyright infringement',
    'Other Terms of Use violation'
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.moderationService.listRequests('pending', 200, 0).subscribe({
      next: (res) => {
        this.requests.set(res.rows ?? []);
        if (this.requests().length && !this.selected()) {
          this.select(this.requests()[0]);
        }
      },
      error: () => {
        this.snack.open('Could not load moderation requests.', 'OK', { duration: 3000 });
      },
      complete: () => this.loading.set(false)
    });
  }

  select(entry: ModerationRequest): void {
    this.selected.set(entry);
    this.rejectionReason = this.suggestReason(entry);
    this.translatedText.set('');
  }

  isSelected(entry: ModerationRequest): boolean {
    return this.selected()?.id === entry.id;
  }

  trackById(_index: number, item: ModerationRequest): string {
    return item.id;
  }

  formatLocal(ts?: number | null): string {
    if (!ts) return '-';
    try {
      return new Date(ts).toLocaleString(navigator.language || undefined);
    } catch {
      return new Date(ts).toISOString();
    }
  }

  formatScore(score?: number | null): string {
    if (score === undefined || score === null) return '-';
    return Number(score).toFixed(3);
  }

  boolLabel(value?: number | boolean | null): string {
    if (value === undefined || value === null) return '-';
    return value === true || value === 1 ? 'Yes' : 'No';
  }

  formattedAiResponse(value?: string | null): string {
    if (!value) return '-';
    try {
      return JSON.stringify(JSON.parse(value), null, 2);
    } catch {
      return value;
    }
  }

  translateSelected(): void {
    const current = this.selected();
    const text = current?.messageText?.trim() ?? '';
    if (!text) {
      this.snack.open('No text to translate.', 'OK', { duration: 2000 });
      return;
    }
    this.translateLoading.set(true);
    this.translator.translateToGerman(text).subscribe({
      next: (result) => {
        this.translatedText.set(result || 'Translation failed.');
      },
      error: () => {
        this.snack.open('Translation failed.', 'OK', { duration: 3000 });
      },
      complete: () => this.translateLoading.set(false)
    });
  }

  private suggestReason(entry: ModerationRequest): string {
    if (entry.patternMatch === true || entry.patternMatch === 1) {
      return 'Privacy or personal data';
    }
    const category = this.extractTopCategory(entry.aiResponse);
    if (!category) return '';
    const key = category.toLowerCase();
    if (key.includes('hate') || key.includes('harassment')) return 'Hate speech or harassment';
    if (key.includes('violence')) return 'Violence or threats';
    if (key.includes('sexual')) return 'Sexual content';
    if (key.includes('illicit')) return 'Illegal activity';
    if (key.includes('spam') || key.includes('scam')) return 'Spam or scams';
    if (key.includes('privacy') || key.includes('personal')) return 'Privacy or personal data';
    if (key.includes('copyright') || key.includes('intellectual')) return 'Copyright infringement';
    if (key.includes('self-harm')) return 'Other Terms of Use violation';
    return 'Other Terms of Use violation';
  }

  private extractTopCategory(aiResponse?: string | null): string | null {
    if (!aiResponse) return null;
    try {
      const parsed = JSON.parse(aiResponse);
      const result = parsed?.results?.[0];
      const scores = result?.category_scores;
      if (scores && typeof scores === 'object') {
        let topKey = null;
        let topScore = -1;
        for (const [key, value] of Object.entries(scores)) {
          const numeric = Number(value);
          if (Number.isFinite(numeric) && numeric > topScore) {
            topScore = numeric;
            topKey = key;
          }
        }
        if (topKey) return topKey;
      }
      const categories = result?.categories;
      if (categories && typeof categories === 'object') {
        const flagged = Object.entries(categories).find(([, value]) => value === true);
        return flagged ? flagged[0] : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  approveSelected(): void {
    const current = this.selected();
    if (!current) return;
    this.actionLoading.set(true);
    this.moderationService.approveRequest(current.id).subscribe({
      next: (res) => {
        if (res.approved) {
          this.removeFromList(current.id);
          this.snack.open('Message approved.', undefined, { duration: 2000 });
        } else {
          this.snack.open('Approval failed.', 'OK', { duration: 3000 });
        }
      },
      error: () => this.snack.open('Approval failed.', 'OK', { duration: 3000 }),
      complete: () => this.actionLoading.set(false)
    });
  }

  rejectSelected(): void {
    const current = this.selected();
    if (!current) return;
    if (!this.rejectionReason) {
      this.snack.open('Please select a rejection reason.', 'OK', { duration: 3000 });
      return;
    }
    this.actionLoading.set(true);
    this.moderationService.rejectRequest(current.id, this.rejectionReason).subscribe({
      next: (res) => {
        if (res.rejected) {
          this.removeFromList(current.id);
          this.snack.open('Message rejected.', undefined, { duration: 2000 });
        } else {
          this.snack.open('Rejection failed.', 'OK', { duration: 3000 });
        }
      },
      error: () => this.snack.open('Rejection failed.', 'OK', { duration: 3000 }),
      complete: () => this.actionLoading.set(false)
    });
  }

  private removeFromList(id: string): void {
    const updated = this.requests().filter(item => item.id !== id);
    this.requests.set(updated);
    this.selected.set(updated[0] ?? null);
    this.rejectionReason = '';
  }
}
