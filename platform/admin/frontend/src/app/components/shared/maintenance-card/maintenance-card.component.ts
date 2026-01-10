import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MaintenanceInfo } from '../../../interfaces/maintenance.interface';
import { MaintenanceService } from '../../../services/maintenance.service';

@Component({
  selector: 'app-maintenance-card',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule
  ],
  templateUrl: './maintenance-card.component.html',
  styleUrl: './maintenance-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MaintenanceCardComponent {
  private readonly maintenanceService = inject(MaintenanceService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly maintenance = signal<MaintenanceInfo | null>(null);

  readonly form = new FormGroup({
    enabled: new FormControl(false, { nonNullable: true }),
    startsAt: new FormControl('', { nonNullable: true }),
    endsAt: new FormControl('', { nonNullable: true }),
    reason: new FormControl('', { nonNullable: true })
  });

  readonly isActive = computed(() => this.maintenance()?.enabled ?? false);
  readonly hasSchedule = computed(() => {
    const data = this.maintenance();
    return !!(data?.startsAt || data?.endsAt);
  });
  readonly statusLabel = computed(() => {
    if (this.loading()) return 'Loading...';
    if (this.isActive()) return 'Active';
    if (this.hasSchedule()) return 'Scheduled';
    return 'Inactive';
  });

  constructor() {
    this.form.controls.enabled.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => {
        this.syncReasonValidator(enabled);
      });

    this.syncReasonValidator(this.form.controls.enabled.value);
    this.load();
  }

  refresh(): void {
    this.load();
  }

  canSubmit(): boolean {
    return !this.loading() && !this.saving() && this.form.valid;
  }

  submit(): void {
    if (!this.form.valid || this.loading() || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    const startsAt = this.parseDateTimeInput(this.form.controls.startsAt.value);
    const endsAt = this.parseDateTimeInput(this.form.controls.endsAt.value);

    if (startsAt && endsAt && endsAt < startsAt) {
      this.snackBar.open('End date must be after the start date.', 'OK', {
        duration: 3000,
        panelClass: ['snack-error'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    const payload = {
      enabled: this.form.controls.enabled.value,
      startsAt,
      endsAt,
      reason: this.normalizeText(this.form.controls.reason.value)
    };

    this.saving.set(true);
    this.maintenanceService.update(payload).subscribe({
      next: (response) => {
        this.applyMaintenance(response?.maintenance ?? null);
        this.saving.set(false);
        this.snackBar.open('Maintenance settings updated.', 'OK', {
          duration: 2000,
          panelClass: ['snack-success'],
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
      },
      error: () => {
        this.saving.set(false);
        this.snackBar.open('Failed to update maintenance settings.', 'OK', {
          duration: 3000,
          panelClass: ['snack-error'],
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
      }
    });
  }

  private load(): void {
    this.loading.set(true);
    this.maintenanceService.getStatus().subscribe({
      next: (response) => {
        this.applyMaintenance(response?.maintenance ?? null);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Failed to load maintenance status.', 'OK', {
          duration: 3000,
          panelClass: ['snack-error'],
          horizontalPosition: 'center',
          verticalPosition: 'top'
        });
      }
    });
  }

  private applyMaintenance(data: MaintenanceInfo | null): void {
    const maintenance = data ?? {
      enabled: false,
      startsAt: null,
      endsAt: null,
      reason: null
    };
    this.maintenance.set(maintenance);
    this.form.setValue(
      {
        enabled: !!maintenance.enabled,
        startsAt: this.formatDateTimeInput(maintenance.startsAt),
        endsAt: this.formatDateTimeInput(maintenance.endsAt),
        reason: maintenance.reason ?? ''
      },
      { emitEvent: false }
    );
    this.syncReasonValidator(!!maintenance.enabled);
    this.form.markAsPristine();
  }

  private syncReasonValidator(enabled: boolean): void {
    if (enabled) {
      this.form.controls.reason.addValidators(Validators.required);
    } else {
      this.form.controls.reason.clearValidators();
    }
    this.form.controls.reason.updateValueAndValidity({ emitEvent: false });
  }

  private formatDateTimeInput(seconds: number | null): string {
    if (!seconds) return '';
    const date = new Date(seconds * 1000);
    const pad = (value: number) => String(value).padStart(2, '0');
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate())
    ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private parseDateTimeInput(value: string): number | null {
    if (!value) return null;
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) return null;
    return Math.floor(ms / 1000);
  }

  private normalizeText(value: string): string | null {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
}
