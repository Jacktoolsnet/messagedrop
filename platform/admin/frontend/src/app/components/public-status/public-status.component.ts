import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute } from '@angular/router';
import { PublicStatusAuditEntry, PublicStatusEvidence, PublicStatusResponse, PublicStatusService } from '../../services/public-status.service';

interface MappedAuditEntry extends PublicStatusAuditEntry {
  detailsObj: Record<string, unknown> | null;
}

@Component({
  selector: 'app-public-status',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    MatChipsModule,
    MatListModule,
    MatDividerModule,
    MatTooltipModule,
    MatSnackBarModule
  ],
  templateUrl: './public-status.component.html',
  styleUrl: './public-status.component.css'
})
export class PublicStatusComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(PublicStatusService);
  private readonly snack = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly status = signal<PublicStatusResponse | null>(null);
  readonly auditEntries = signal<MappedAuditEntry[]>([]);

  private currentToken: string | null = null;

  ngOnInit(): void {
    this.route.paramMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        const token = params.get('token');
        if (!token) {
          this.error.set('Missing status token.');
          this.loading.set(false);
          return;
        }
        this.currentToken = token;
        this.fetchStatus(token);
      });
  }

  get isNotice(): boolean {
    return this.status()?.entityType === 'notice';
  }

  get notice() {
    return this.status()?.notice ?? null;
  }

  get signal() {
    return this.status()?.signal ?? null;
  }

  get decision() {
    return this.status()?.decision ?? null;
  }

  get evidence(): PublicStatusEvidence[] {
    return this.status()?.evidence ?? [];
  }

  fetchStatus(token: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getStatus(token).subscribe({
      next: (data) => {
        this.status.set(data);
        this.auditEntries.set((data.audit || []).map(entry => ({
          ...entry,
          detailsObj: this.parseDetails(entry.details)
        })));
        this.loading.set(false);
      },
      error: (err) => {
        const msg = err?.error?.error === 'not_found'
          ? 'No case was found for this token.'
          : 'Could not load the status. Please try again later.';
        this.error.set(msg);
        this.loading.set(false);
      }
    });
  }

  parseDetails(details: unknown): Record<string, unknown> | null {
    if (!details) return null;
    if (typeof details === 'object' && !Array.isArray(details)) return details as Record<string, unknown>;
    return null;
  }

  formatStatus(status: string | undefined | null): string {
    if (!status) return '—';
    switch (status.toUpperCase()) {
      case 'RECEIVED': return 'Received';
      case 'UNDER_REVIEW': return 'Under review';
      case 'DECIDED': return 'Decided';
      default: return status;
    }
  }

  formatOutcome(outcome: string | undefined | null): string {
    if (!outcome) return '—';
    const key = outcome.toUpperCase();
    switch (key) {
      case 'REMOVE_CONTENT':
      case 'REMOVE':
        return 'Removed';
      case 'RESTRICT':
        return 'Restricted';
      case 'NO_ACTION':
        return 'No action';
      case 'FORWARD_TO_AUTHORITY':
        return 'Escalated';
      default:
        return outcome;
    }
  }

  print(): void {
    window.print();
  }

  copyLink(): void {
    if (!this.currentToken) return;
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      this.snack.open('Link copied to clipboard.', 'OK', { duration: 2500 });
    }).catch(() => {
      this.snack.open('Could not copy the link automatically.', 'OK', { duration: 3000 });
    });
  }

  downloadEvidence(ev: PublicStatusEvidence): void {
    if (!this.currentToken) return;
    this.service.downloadEvidence(this.currentToken, ev.id).subscribe({
      next: (response) => {
        const blob = response.body;
        if (!blob) {
          this.snack.open('Empty file received.', 'OK', { duration: 2500 });
          return;
        }
        const filename = this.resolveFilename(response.headers.get('Content-Disposition'), ev.fileName || 'evidence');
        const link = document.createElement('a');
        const url = window.URL.createObjectURL(blob);
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.snack.open('Could not download the file.', 'OK', { duration: 3000 });
      }
    });
  }

  private resolveFilename(disposition: string | null, fallback: string): string {
    if (!disposition) return fallback;
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(disposition);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1].replace(/"/g, ''));
      } catch {
        return match[1].replace(/"/g, '');
      }
    }
    return fallback;
  }
}
