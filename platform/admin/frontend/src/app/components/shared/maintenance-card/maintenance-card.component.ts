import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { MaintenanceInfo } from '../../../interfaces/maintenance.interface';
import { MaintenanceService } from '../../../services/maintenance.service';

@Component({
  selector: 'app-maintenance-card',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatTimepickerModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule
  ],
  templateUrl: './maintenance-card.component.html',
  styleUrl: './maintenance-card.component.css',
  providers: [provideNativeDateAdapter(), { provide: MAT_DATE_LOCALE, useValue: 'de-DE' }],
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
    startDate: new FormControl<Date | null>(null),
    startTime: new FormControl<Date | null>(null),
    endDate: new FormControl<Date | null>(null),
    endTime: new FormControl<Date | null>(null),
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

    if (!this.form.controls.startDate.value && this.form.controls.startTime.value) {
      this.snackBar.open('Start date is required when a start time is set.', 'OK', {
        duration: 3000,
        panelClass: ['snack-error'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    if (!this.form.controls.endDate.value && this.form.controls.endTime.value) {
      this.snackBar.open('End date is required when an end time is set.', 'OK', {
        duration: 3000,
        panelClass: ['snack-error'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    const startsAt = this.mergeDateAndTime(
      this.form.controls.startDate.value,
      this.form.controls.startTime.value
    );
    const endsAt = this.mergeDateAndTime(
      this.form.controls.endDate.value,
      this.form.controls.endTime.value
    );

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
    const start = this.splitDateTime(maintenance.startsAt);
    const end = this.splitDateTime(maintenance.endsAt);
    this.maintenance.set(maintenance);
    this.form.setValue(
      {
        enabled: !!maintenance.enabled,
        startDate: start.date,
        startTime: start.time,
        endDate: end.date,
        endTime: end.time,
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

  private splitDateTime(seconds: number | null): { date: Date | null; time: Date | null } {
    if (!seconds) return { date: null, time: null };
    const local = new Date(seconds * 1000);
    const date = new Date(local.getFullYear(), local.getMonth(), local.getDate());
    const time = new Date();
    time.setHours(local.getHours(), local.getMinutes(), 0, 0);
    return { date, time };
  }

  private mergeDateAndTime(date: Date | null, time: Date | null): number | null {
    if (!date) return null;
    const merged = new Date(date);
    if (time) {
      merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
    } else {
      merged.setHours(0, 0, 0, 0);
    }
    return Math.floor(merged.getTime() / 1000);
  }

  private normalizeText(value: string): string | null {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
}
