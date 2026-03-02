import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { PlatformUserModeration, PlatformUserSummary } from '../../../interfaces/platform-user-moderation.interface';
import { DsaService } from '../../../services/dsa/dsa/dsa.service';

@Component({
  selector: 'app-user-moderation',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatInputModule,
    MatFormFieldModule,
    MatProgressBarModule
  ],
  templateUrl: './user-moderation.component.html',
  styleUrls: ['./user-moderation.component.css']
})
export class UserModerationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dsa = inject(DsaService);

  readonly form = this.fb.nonNullable.group({
    userId: ['', [Validators.required]],
    blockedUntilLocal: ['']
  });

  readonly loading = signal(false);
  readonly moderation = signal<PlatformUserModeration | null>(null);
  readonly summary = signal<PlatformUserSummary | null>(null);

  lookup(): void {
    const userId = this.form.controls.userId.value.trim();
    if (!userId) return;
    this.loading.set(true);
    this.dsa.getPlatformUserModeration(userId).subscribe({
      next: (res) => {
        this.moderation.set(res?.moderation ?? null);
        this.summary.set(res?.summary ?? null);
        const postingUntil = this.toLocalDateTimeValue(res?.moderation?.posting?.blockedUntil ?? null);
        const accountUntil = this.toLocalDateTimeValue(res?.moderation?.account?.blockedUntil ?? null);
        this.form.controls.blockedUntilLocal.setValue(postingUntil || accountUntil || '');
      },
      complete: () => this.loading.set(false)
    });
  }

  blockPosting(): void {
    this.update('posting', true, 'manual_block_from_admin');
  }

  unblockPosting(): void {
    this.update('posting', false, 'manual_unblock_from_admin');
  }

  blockAccount(): void {
    this.update('account', true, 'manual_block_from_admin');
  }

  unblockAccount(): void {
    this.update('account', false, 'manual_unblock_from_admin');
  }

  private update(target: 'posting' | 'account', blocked: boolean, reason: string): void {
    const userId = this.form.controls.userId.value.trim();
    if (!userId) return;
    this.loading.set(true);
    this.dsa.updatePlatformUserModeration(userId, {
      target,
      blocked,
      reason,
      blockedUntil: blocked ? this.parseBlockedUntil() : null
    }).subscribe({
      next: (res) => {
        this.moderation.set(res?.moderation ?? null);
        this.summary.set(res?.summary ?? null);
        if (target === 'posting') {
          this.form.controls.blockedUntilLocal.setValue(this.toLocalDateTimeValue(res?.moderation?.posting?.blockedUntil ?? null));
        } else {
          this.form.controls.blockedUntilLocal.setValue(this.toLocalDateTimeValue(res?.moderation?.account?.blockedUntil ?? null));
        }
      },
      complete: () => this.loading.set(false)
    });
  }

  clearBlockedUntil(): void {
    this.form.controls.blockedUntilLocal.setValue('');
  }

  formatTimestamp(value?: number | null): string {
    if (!Number.isFinite(value)) return '—';
    const ts = Number(value);
    if (ts <= 0) return '—';
    return new Date(ts).toLocaleString();
  }

  private parseBlockedUntil(): number | null {
    const raw = this.form.controls.blockedUntilLocal.value?.trim();
    if (!raw) return null;
    const ts = new Date(raw).getTime();
    return Number.isFinite(ts) && ts > 0 ? ts : null;
  }

  private toLocalDateTimeValue(value?: number | null): string {
    if (!Number.isFinite(value)) return '';
    const ts = Number(value);
    if (ts <= 0) return '';
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${day}T${hh}:${mm}`;
  }
}
