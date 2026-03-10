import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { filter, fromEvent, merge } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import {
  findModerationReasonLabel,
  USER_ACCOUNT_BLOCK_REASONS,
  USER_POSTING_BLOCK_REASONS
} from '../../../constants/user-moderation-reasons';
import {
  PlatformUserModeration,
  PlatformUserModerationAppeal,
  PlatformUserModerationAppealStatus,
  PlatformUserSummary
} from '../../../interfaces/platform-user-moderation.interface';
import { DsaService } from '../../../services/dsa/dsa/dsa.service';

@Component({
  selector: 'app-user-moderation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
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
    MatSelectModule,
    MatSnackBarModule
  ],
  templateUrl: './user-moderation.component.html',
  styleUrls: ['./user-moderation.component.css'],
  providers: [provideNativeDateAdapter(), { provide: MAT_DATE_LOCALE, useValue: 'de-DE' }]
})
export class UserModerationComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dsa = inject(DsaService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly postingReasonOptions = USER_POSTING_BLOCK_REASONS;
  readonly accountReasonOptions = USER_ACCOUNT_BLOCK_REASONS;

  readonly form = this.fb.group({
    userId: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    postingReason: this.fb.nonNullable.control(USER_POSTING_BLOCK_REASONS[0]?.code ?? '', { validators: [Validators.required] }),
    accountReason: this.fb.nonNullable.control(USER_ACCOUNT_BLOCK_REASONS[0]?.code ?? '', { validators: [Validators.required] }),
    postingBlockedUntilDate: this.fb.control<Date | null>(null),
    postingBlockedUntilTime: this.fb.control<Date | null>(null),
    accountBlockedUntilDate: this.fb.control<Date | null>(null),
    accountBlockedUntilTime: this.fb.control<Date | null>(null)
  });

  readonly loading = signal(false);
  readonly moderation = signal<PlatformUserModeration | null>(null);
  readonly summary = signal<PlatformUserSummary | null>(null);
  readonly appeals = signal<PlatformUserModerationAppeal[]>([]);
  readonly openAppeals = this.dsa.openUserModerationAppeals;
  readonly openAppealsCount = this.dsa.openUserModerationAppealsCount;
  readonly hasActiveBlock = computed(() => {
    const moderation = this.moderation();
    return Boolean(moderation?.posting?.blocked || moderation?.account?.blocked);
  });

  ngOnInit(): void {
    this.refreshOpenAppeals();
    merge(
      fromEvent(window, 'focus'),
      fromEvent(document, 'visibilitychange').pipe(
        filter(() => document.visibilityState === 'visible')
      )
    ).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.refreshOpenAppeals());
  }

  lookup(): void {
    const userId = this.form.controls.userId.value.trim();
    if (!userId) return;
    this.loading.set(true);
    this.dsa.getPlatformUserModeration(userId).subscribe({
      next: (res) => {
        this.applyResponse(res);
        this.refreshOpenAppeals();
      },
      error: () => this.loading.set(false),
      complete: () => this.loading.set(false)
    });
  }

  blockPosting(): void {
    this.update('posting', true, this.form.controls.postingReason.value);
  }

  unblockPosting(): void {
    this.update('posting', false, null);
  }

  blockAccount(): void {
    this.update('account', true, this.form.controls.accountReason.value);
  }

  unblockAccount(): void {
    this.update('account', false, null);
  }

  resolveAppeal(appeal: PlatformUserModerationAppeal, status: 'accepted' | 'rejected'): void {
    if (appeal.status !== 'open') {
      return;
    }

    this.loading.set(true);
    this.dsa.resolvePlatformUserAppeal(appeal.id, { status }).subscribe({
      next: (res) => {
        this.applyResponse(res);
        this.refreshOpenAppeals();
      },
      error: () => this.loading.set(false),
      complete: () => this.loading.set(false)
    });
  }

  async unblockAll(): Promise<void> {
    const moderation = this.moderation();
    const userId = this.form.controls.userId.value.trim();
    if (!moderation || !userId) {
      return;
    }

    if (!this.hasActiveBlock()) {
      this.snackBar.open('There are no active blocks to remove.', 'OK', {
        duration: 2500,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    this.loading.set(true);
    try {
      if (moderation.posting.blocked) {
        await firstValueFrom(this.dsa.updatePlatformUserModeration(userId, {
          target: 'posting',
          blocked: false,
          reason: null,
          blockedUntil: null
        }));
      }

      if (moderation.account.blocked) {
        await firstValueFrom(this.dsa.updatePlatformUserModeration(userId, {
          target: 'account',
          blocked: false,
          reason: null,
          blockedUntil: null
        }));
      }

      const refreshed = await firstValueFrom(this.dsa.getPlatformUserModeration(userId));
      this.applyResponse(refreshed);
      this.refreshOpenAppeals();
      this.snackBar.open('All active blocks have been removed.', 'OK', {
        duration: 2500,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
    } catch {
      this.loading.set(false);
      return;
    }

    this.loading.set(false);
  }

  loadUserFromAppeal(appeal: PlatformUserModerationAppeal): void {
    const userId = String(appeal.userId || '').trim();
    if (!userId) {
      return;
    }
    this.form.controls.userId.setValue(userId);
    this.lookup();
  }

  formatTimestamp(value?: number | null): string {
    if (!Number.isFinite(value)) return '—';
    const ts = Number(value);
    if (ts <= 0) return '—';
    return new Date(ts).toLocaleString();
  }

  formatReason(reason: string | null | undefined, target: 'posting' | 'account'): string {
    return findModerationReasonLabel(reason, target === 'posting' ? this.postingReasonOptions : this.accountReasonOptions);
  }

  appealStatusLabel(status: PlatformUserModerationAppealStatus): string {
    switch (status) {
      case 'accepted':
        return 'Accepted';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Open';
    }
  }

  private applyResponse(res?: {
    moderation?: PlatformUserModeration | null;
    summary?: PlatformUserSummary | null;
    appeals?: PlatformUserModerationAppeal[] | null;
  } | null): void {
    this.moderation.set(res?.moderation ?? null);
    this.summary.set(res?.summary ?? null);
    this.appeals.set(res?.appeals ?? []);
    this.setBlockedUntil('posting', res?.moderation?.posting?.blockedUntil ?? null);
    this.setBlockedUntil('account', res?.moderation?.account?.blockedUntil ?? null);
    this.syncReasonSelection('posting', res?.moderation?.posting?.reason ?? null);
    this.syncReasonSelection('account', res?.moderation?.account?.reason ?? null);
  }

  private update(target: 'posting' | 'account', blocked: boolean, reason: string | null): void {
    const userId = this.form.controls.userId.value.trim();
    if (!userId) return;
    if (blocked && !this.hasValidBlockedUntilSelection(target)) return;
    if (blocked && !reason) return;

    this.loading.set(true);
    this.dsa.updatePlatformUserModeration(userId, {
      target,
      blocked,
      reason,
      blockedUntil: blocked ? this.parseBlockedUntil(target) : null
    }).subscribe({
      next: (res) => {
        this.applyResponse(res);
        this.refreshOpenAppeals();
      },
      error: () => this.loading.set(false),
      complete: () => this.loading.set(false)
    });
  }

  private refreshOpenAppeals(): void {
    this.dsa.loadOpenPlatformUserAppeals(50);
  }

  private syncReasonSelection(target: 'posting' | 'account', reason: string | null): void {
    const options = target === 'posting' ? this.postingReasonOptions : this.accountReasonOptions;
    const fallback = options[0]?.code ?? '';
    const matching = options.some((option) => option.code === reason) ? (reason || fallback) : fallback;
    if (target === 'posting') {
      this.form.controls.postingReason.setValue(matching, { emitEvent: false });
      return;
    }
    this.form.controls.accountReason.setValue(matching, { emitEvent: false });
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

  minimumBlockDate(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  minimumBlockTime(target: 'posting' | 'account'): Date | null {
    const dateControl = target === 'posting'
      ? this.form.controls.postingBlockedUntilDate
      : this.form.controls.accountBlockedUntilDate;
    const date = dateControl.value;
    if (!date) {
      return null;
    }

    const today = this.minimumBlockDate();
    const selectedDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if (selectedDay.getTime() !== today.getTime()) {
      return null;
    }

    return this.nextAllowedBlockUntilDate();
  }

  private setBlockedUntil(target: 'posting' | 'account', value?: number | null): void {
    const { date, time } = this.splitDateTime(value);
    if (target === 'posting') {
      this.form.patchValue({
        postingBlockedUntilDate: date,
        postingBlockedUntilTime: time
      }, { emitEvent: false });
      return;
    }

    this.form.patchValue({
      accountBlockedUntilDate: date,
      accountBlockedUntilTime: time
    }, { emitEvent: false });
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
      const blockedUntil = this.parseBlockedUntil(target);
      if (blockedUntil === null || blockedUntil >= this.nextAllowedBlockUntilDate().getTime()) {
        return true;
      }

      this.snackBar.open(`Bitte keinen Zeitpunkt in der Vergangenheit für ${label} auswählen.`, 'OK', {
        duration: 3000,
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return false;
    }

    this.snackBar.open(`Bitte zuerst ein Datum für ${label} auswählen, wenn eine Uhrzeit gesetzt ist.`, 'OK', {
      duration: 3000,
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
    return false;
  }

  private nextAllowedBlockUntilDate(): Date {
    const min = new Date();
    min.setSeconds(0, 0);
    min.setMinutes(min.getMinutes() + 1);
    return min;
  }
}
