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

  readonly loading = signal(false);
  readonly actionLoading = signal(false);
  readonly requests = signal<ModerationRequest[]>([]);
  readonly selected = signal<ModerationRequest | null>(null);

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
          this.selected.set(this.requests()[0]);
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
    this.rejectionReason = '';
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
