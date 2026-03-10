import { HttpResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DATE_LOCALE, provideNativeDateAdapter } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTimepickerModule } from '@angular/material/timepicker';
import {
  LastRestoreInfo,
  MaintenanceBackupInfo,
  MaintenanceBackupListItem,
  MaintenanceBackupValidationResponse,
  MaintenanceInfo,
  MaintenanceRestoreChallenge,
  PendingRestoreInfo
} from '../../../interfaces/maintenance.interface';
import { MaintenanceService } from '../../../services/maintenance.service';

@Component({
  selector: 'app-maintenance-card',
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
  readonly backupRunning = signal(false);
  readonly catalogLoading = signal(true);
  readonly restoreStatusLoading = signal(true);
  readonly validationBusyId = signal<string | null>(null);
  readonly challengeBusyId = signal<string | null>(null);
  readonly restorePreparing = signal(false);
  readonly maintenance = signal<MaintenanceInfo | null>(null);
  readonly backups = signal<MaintenanceBackupListItem[]>([]);
  readonly selectedValidation = signal<MaintenanceBackupValidationResponse | null>(null);
  readonly restoreChallenge = signal<MaintenanceRestoreChallenge | null>(null);
  readonly restoreTargetBackup = signal<MaintenanceBackupInfo | null>(null);
  readonly pendingRestore = signal<PendingRestoreInfo | null>(null);
  readonly lastRestore = signal<LastRestoreInfo | null>(null);

  readonly restoreSteps = [
    'In Plesk alle Node.js-Apps stoppen: public backend, admin backend, OpenMeteo, Nominatim und Viator.',
    'Nur das Admin-Backend einmal wieder starten.',
    'Das Admin-Backend spielt den vorbereiteten Restore beim Start automatisch ein.',
    'Danach die restlichen Node.js-Apps in Plesk wieder starten.',
    'Zum Schluss diese Seite neu laden und den Restore-Status prüfen.'
  ];

  readonly form = new FormGroup({
    enabled: new FormControl(false, { nonNullable: true }),
    startDate: new FormControl<Date | null>(null),
    startTime: new FormControl<Date | null>(null),
    endDate: new FormControl<Date | null>(null),
    endTime: new FormControl<Date | null>(null),
    reason: new FormControl('', { nonNullable: true })
  });

  readonly restoreConfirmForm = new FormGroup({
    confirmationWord: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    confirmationPin: new FormControl('', { nonNullable: true, validators: [Validators.required] })
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
  readonly latestBackup = computed(() => this.backups()[0] ?? null);
  readonly hasBackup = computed(() => this.backups().length > 0);
  readonly canCreateBackup = computed(() => !this.loading() && !this.saving() && !this.backupRunning() && !this.restorePreparing());
  readonly canPrepareRestore = computed(() => {
    return !!this.restoreChallenge()
      && !!this.restoreTargetBackup()
      && this.restoreConfirmForm.valid
      && !this.restorePreparing()
      && !this.backupRunning();
  });

  constructor() {
    this.form.controls.enabled.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((enabled) => {
        this.syncReasonValidator(enabled);
      });

    this.syncReasonValidator(this.form.controls.enabled.value);
    this.refresh();
  }

  refresh(): void {
    this.loadMaintenance();
    this.loadBackupCatalog();
    this.loadRestoreStatus();
  }

  canSubmit(): boolean {
    return !this.loading() && !this.saving() && !this.backupRunning() && !this.restorePreparing() && this.form.valid;
  }

  submit(): void {
    if (!this.form.valid || this.loading() || this.saving() || this.backupRunning() || this.restorePreparing()) {
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
    this.maintenanceService.update(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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

  createBackup(): void {
    if (!this.canCreateBackup()) {
      return;
    }

    this.backupRunning.set(true);
    this.maintenanceService.createBackup()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.backupRunning.set(false);
          this.loadMaintenance();
          this.loadBackupCatalog(true);
          this.loadRestoreStatus(true);
          this.snackBar.open('Backup created successfully.', 'OK', {
            duration: 2500,
            panelClass: ['snack-success'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        error: () => {
          this.backupRunning.set(false);
          this.loadMaintenance();
          this.loadBackupCatalog(true);
          this.snackBar.open('Failed to create backup.', 'OK', {
            duration: 3500,
            panelClass: ['snack-error'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        }
      });
  }

  downloadLatestBackup(): void {
    const backup = this.latestBackup();
    if (!backup) {
      return;
    }
    this.downloadBackupArchive(backup);
  }

  downloadBackupArchive(backup: MaintenanceBackupInfo | MaintenanceBackupListItem): void {
    this.maintenanceService.downloadBackup(backup.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          const blob = response.body;
          if (!blob) {
            this.snackBar.open('Empty backup archive received.', 'OK', {
              duration: 3000,
              panelClass: ['snack-error'],
              horizontalPosition: 'center',
              verticalPosition: 'top'
            });
            return;
          }

          const filename = this.resolveFilename(response, backup.archiveName || `messagedrop-backup-${backup.id}.zip`);
          const url = window.URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = filename;
          document.body.appendChild(anchor);
          anchor.click();
          document.body.removeChild(anchor);
          window.URL.revokeObjectURL(url);
        },
        error: () => {
          this.snackBar.open('Could not download the backup ZIP.', 'OK', {
            duration: 3000,
            panelClass: ['snack-error'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        }
      });
  }

  validateRestoreBackup(backup: MaintenanceBackupListItem): void {
    this.validationBusyId.set(backup.id);
    this.maintenanceService.validateBackup(backup.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.validationBusyId.set(null);
          this.selectedValidation.set(response);
          this.restoreChallenge.set(null);
          this.restoreTargetBackup.set(null);
          this.restoreConfirmForm.reset({ confirmationWord: '', confirmationPin: '' });
          this.snackBar.open(response.valid ? 'Backup validation successful.' : 'Backup has validation issues.', 'OK', {
            duration: 2500,
            panelClass: [response.valid ? 'snack-success' : 'snack-error'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        error: () => {
          this.validationBusyId.set(null);
          this.snackBar.open('Could not validate the selected backup.', 'OK', {
            duration: 3000,
            panelClass: ['snack-error'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        }
      });
  }

  requestRestoreChallenge(backup: MaintenanceBackupListItem): void {
    this.challengeBusyId.set(backup.id);
    this.maintenanceService.createRestoreChallenge(backup.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.challengeBusyId.set(null);
          this.restoreTargetBackup.set(response.backup);
          this.restoreChallenge.set(response.challenge);
          this.selectedValidation.set({
            status: response.status,
            backup: response.backup,
            valid: response.valid,
            issues: response.issues
          });
          this.restoreConfirmForm.reset({ confirmationWord: '', confirmationPin: '' });
          this.snackBar.open('Restore confirmation challenge created.', 'OK', {
            duration: 2500,
            panelClass: ['snack-success'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        error: () => {
          this.challengeBusyId.set(null);
          this.snackBar.open('Could not create the restore challenge.', 'OK', {
            duration: 3000,
            panelClass: ['snack-error'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        }
      });
  }

  cancelRestoreChallenge(): void {
    this.restoreChallenge.set(null);
    this.restoreTargetBackup.set(null);
    this.restoreConfirmForm.reset({ confirmationWord: '', confirmationPin: '' });
  }

  prepareRestore(): void {
    const backup = this.restoreTargetBackup();
    const challenge = this.restoreChallenge();
    if (!backup || !challenge || !this.canPrepareRestore()) {
      this.restoreConfirmForm.markAllAsTouched();
      return;
    }

    this.restorePreparing.set(true);
    this.maintenanceService.prepareRestore({
      backupId: backup.id,
      challengeId: challenge.challengeId,
      confirmationWord: this.restoreConfirmForm.controls.confirmationWord.value.trim(),
      confirmationPin: this.restoreConfirmForm.controls.confirmationPin.value.trim()
    }).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.restorePreparing.set(false);
          this.pendingRestore.set(response.pendingRestore);
          this.lastRestore.set(response.lastRestore);
          this.restoreChallenge.set(null);
          this.restoreTargetBackup.set(null);
          this.restoreConfirmForm.reset({ confirmationWord: '', confirmationPin: '' });
          this.loadRestoreStatus(true);
          this.snackBar.open('Restore prepared. Follow the Plesk steps below.', 'OK', {
            duration: 3000,
            panelClass: ['snack-success'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        error: () => {
          this.restorePreparing.set(false);
          this.snackBar.open('Could not prepare the restore.', 'OK', {
            duration: 3500,
            panelClass: ['snack-error'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        }
      });
  }

  isBackupSelected(backupId: string): boolean {
    return this.selectedValidation()?.backup?.id === backupId;
  }

  isChallengeActiveFor(backupId: string): boolean {
    return this.restoreTargetBackup()?.id === backupId && !!this.restoreChallenge();
  }

  formatDateTime(ts: number | null | undefined): string {
    if (!ts) return '—';
    return new Date(ts).toLocaleString('de-DE');
  }

  formatBytes(bytes: number | null | undefined): string {
    const size = Number(bytes);
    if (!Number.isFinite(size) || size <= 0) return '—';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  formatRestoreState(status: string | null | undefined): string {
    switch ((status || '').toLowerCase()) {
      case 'pending': return 'Prepared';
      case 'running': return 'Running';
      case 'success': return 'Successful';
      case 'failed': return 'Failed';
      default: return status || 'Unknown';
    }
  }

  private loadMaintenance(): void {
    this.loading.set(true);
    this.maintenanceService.getStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
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

  private loadBackupCatalog(silent = false): void {
    this.catalogLoading.set(true);
    this.maintenanceService.listBackups()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.backups.set(response.backups ?? []);
          this.catalogLoading.set(false);
        },
        error: () => {
          this.catalogLoading.set(false);
          this.backups.set([]);
          if (!silent) {
            this.snackBar.open('Failed to load backup catalog.', 'OK', {
              duration: 3000,
              panelClass: ['snack-error'],
              horizontalPosition: 'center',
              verticalPosition: 'top'
            });
          }
        }
      });
  }

  private loadRestoreStatus(silent = false): void {
    this.restoreStatusLoading.set(true);
    this.maintenanceService.getRestoreStatus()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.pendingRestore.set(response.pendingRestore ?? null);
          this.lastRestore.set(response.lastRestore ?? null);
          this.restoreStatusLoading.set(false);
        },
        error: () => {
          this.restoreStatusLoading.set(false);
          this.pendingRestore.set(null);
          this.lastRestore.set(null);
          if (!silent) {
            this.snackBar.open('Failed to load restore status.', 'OK', {
              duration: 3000,
              panelClass: ['snack-error'],
              horizontalPosition: 'center',
              verticalPosition: 'top'
            });
          }
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

  private resolveFilename(response: HttpResponse<Blob>, fallback: string): string {
    const disposition = response.headers.get('Content-Disposition');
    if (!disposition) return fallback;
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(disposition);
    if (!match?.[1]) {
      return fallback;
    }
    try {
      return decodeURIComponent(match[1].replace(/"/g, ''));
    } catch {
      return match[1].replace(/"/g, '');
    }
  }
}
