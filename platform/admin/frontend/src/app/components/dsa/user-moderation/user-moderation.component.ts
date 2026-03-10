import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTimepickerModule } from '@angular/material/timepicker';
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
    MatProgressBarModule,
    MatDatepickerModule,
    MatTimepickerModule,
    MatSnackBarModule
  ],
  templateUrl: './user-moderation.component.html',
  styleUrls: ['./user-moderation.component.css'],
  providers: [provideNativeDateAdapter(), { provide: MAT_DATE_LOCALE, useValue: 'de-DE' }]
})
export class UserModerationComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dsa = inject(DsaService);
  private readonly snackBar = inject(MatSnackBar);

  readonly form = this.fb.group({
    userId: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    postingBlockedUntilDate: this.fb.control<Date | null>(null),
    postingBlockedUntilTime: this.fb.control<Date | null>(null),
    accountBlockedUntilDate: this.fb.control<Date | null>(null),
    accountBlockedUntilTime: this.fb.control<Date | null>(null)
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
        this.setBlockedUntil('posting', res?.moderation?.posting?.blockedUntil ?? null);
        this.setBlockedUntil('account', res?.moderation?.account?.blockedUntil ?? null);
      },
      error: () => this.loading.set(false),
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
    if (blocked && !this.hasValidBlockedUntilSelection(target)) return;

    this.loading.set(true);
    this.dsa.updatePlatformUserModeration(userId, {
      target,
      blocked,
      reason,
      blockedUntil: blocked ? this.parseBlockedUntil(target) : null
    }).subscribe({
      next: (res) => {
        this.moderation.set(res?.moderation ?? null);
        this.summary.set(res?.summary ?? null);
        if (target === 'posting') {
          this.setBlockedUntil('posting', res?.moderation?.posting?.blockedUntil ?? null);
        } else {
          this.setBlockedUntil('account', res?.moderation?.account?.blockedUntil ?? null);
        }
      },
      error: () => this.loading.set(false),
      complete: () => this.loading.set(false)
    });
  }

  formatTimestamp(value?: number | null): string {
    if (!Number.isFinite(value)) return '—';
    const ts = Number(value);
    if (ts <= 0) return '—';
    return new Date(ts).toLocaleString();
  }

  private parseBlockedUntil(target: 'posting' | 'account'): number | null {
    const dateControl = target === 'posting'
      ? this.form.controls.postingBlockedUntilDate
      : this.form.controls.accountBlockedUntilDate;
    const timeControl = target === 'posting'
      ? this.form.controls.postingBlockedUntilTime
      : this.form.controls.accountBlockedUntilTime;

    const date = dateControl.value;
    const time = timeControl.value;
    if (!date) return null;

    const merged = new Date(date);
    if (time) {
      merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
    } else {
      merged.setHours(0, 0, 0, 0);
    }

    const ts = merged.getTime();
    return Number.isFinite(ts) && ts > 0 ? ts : null;
  }

  private setBlockedUntil(target: 'posting' | 'account', value?: number | null): void {
    const { date, time } = this.splitDateTime(value);
    if (target === 'posting') {
      this.form.patchValue({
        postingBlockedUntilDate: date,
        postingBlockedUntilTime: time
      });
      return;
    }

    this.form.patchValue({
      accountBlockedUntilDate: date,
      accountBlockedUntilTime: time
    });
  }

  private splitDateTime(value?: number | null): { date: Date | null; time: Date | null } {
    if (!Number.isFinite(value)) return { date: null, time: null };
    const ts = Number(value);
    if (ts <= 0) return { date: null, time: null };

    const d = new Date(ts);
    const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const time = new Date();
    time.setHours(d.getHours(), d.getMinutes(), 0, 0);
    return { date, time };
  }

  private hasValidBlockedUntilSelection(target: 'posting' | 'account'): boolean {
    const label = target === 'posting' ? 'Posting' : 'Account';
    const dateControl = target === 'posting'
      ? this.form.controls.postingBlockedUntilDate
      : this.form.controls.accountBlockedUntilDate;
    const timeControl = target === 'posting'
      ? this.form.controls.postingBlockedUntilTime
      : this.form.controls.accountBlockedUntilTime;

    if (!timeControl.value || dateControl.value) {
      return true;
    }

    this.snackBar.open(`Bitte zuerst ein Datum für ${label} auswählen, wenn eine Uhrzeit gesetzt ist.`, 'OK', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
    return false;
  }
}
