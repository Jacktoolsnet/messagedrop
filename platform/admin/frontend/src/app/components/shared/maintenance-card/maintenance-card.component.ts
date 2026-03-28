import { HttpResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
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
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { DisplayMessageService } from '../../../services/display-message.service';

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
  ],
  templateUrl: './maintenance-card.component.html',
  styleUrl: './maintenance-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MaintenanceCardComponent {
  private readonly maintenanceService = inject(MaintenanceService);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly destroyRef = inject(DestroyRef);
  readonly i18n = inject(TranslationHelperService);

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
    'In Plesk stop all Node.js apps: public backend, admin backend, OpenMeteo, Nominatim, and Viator.',
    'Start only the admin backend once.',
    'The admin backend applies the prepared restore automatically during startup.',
    'After that, start the remaining Node.js apps in Plesk again.',
    'Finally, reload this page and verify the restore status.'
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
    if (this.loading()) return this.i18n.t('Loading...');
    if (this.isActive()) return this.i18n.t('Active');
    if (this.hasSchedule()) return this.i18n.t('Scheduled');
    return this.i18n.t('Inactive');
  });
  readonly latestBackup = computed(() => this.backups()[0] ?? null);
  readonly hasBackup = computed(() => this.backups().length > 0);
  readonly canCreateBackup = computed(() => !this.loading() && !this.saving() && !this.backupRunning() && !this.restorePreparing());
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
      this.snackBar.open(this.i18n.t('Start date is required when a start time is set.'), this.i18n.t('OK'), {
        duration: 3000,
        panelClass: ['snack-error'],
        horizontalPosition: 'center',
        verticalPosition: 'top'
      });
      return;
    }

    if (!this.form.controls.endDate.value && this.form.controls.endTime.value) {
      this.snackBar.open(this.i18n.t('End date is required when an end time is set.'), this.i18n.t('OK'), {
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
      this.snackBar.open(this.i18n.t('End date must be after the start date.'), this.i18n.t('OK'), {
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
          this.snackBar.open(this.i18n.t('Maintenance settings updated.'), this.i18n.t('OK'), {
            duration: 2000,
            panelClass: ['snack-success'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        error: () => {
          this.saving.set(false);
          this.snackBar.open(this.i18n.t('Failed to update maintenance settings.'), this.i18n.t('OK'), {
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
          this.snackBar.open(this.i18n.t('Backup created successfully.'), this.i18n.t('OK'), {
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
          this.snackBar.open(this.i18n.t('Failed to create backup.'), this.i18n.t('OK'), {
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
            this.snackBar.open(this.i18n.t('Empty backup archive received.'), this.i18n.t('OK'), {
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
          this.snackBar.open(this.i18n.t('Could not download the backup ZIP.'), this.i18n.t('OK'), {
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
          this.snackBar.open(this.i18n.t(response.valid ? 'Backup validation successful.' : 'Backup has validation issues.'), this.i18n.t('OK'), {
            duration: 2500,
            panelClass: [response.valid ? 'snack-success' : 'snack-error'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        error: () => {
          this.validationBusyId.set(null);
          this.snackBar.open(this.i18n.t('Could not validate the selected backup.'), this.i18n.t('OK'), {
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
          this.snackBar.open(this.i18n.t('Restore confirmation challenge created.'), this.i18n.t('OK'), {
            duration: 2500,
            panelClass: ['snack-success'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        error: () => {
          this.challengeBusyId.set(null);
          this.snackBar.open(this.i18n.t('Could not create the restore challenge.'), this.i18n.t('OK'), {
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
          this.snackBar.open(this.i18n.t('Restore prepared. Follow the Plesk steps below.'), this.i18n.t('OK'), {
            duration: 3000,
            panelClass: ['snack-success'],
            horizontalPosition: 'center',
            verticalPosition: 'top'
          });
        },
        error: () => {
          this.restorePreparing.set(false);
          this.snackBar.open(this.i18n.t('Could not prepare the restore.'), this.i18n.t('OK'), {
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
    return new Date(ts).toLocaleString(this.i18n.dateLocale());
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
      case 'pending': return this.i18n.t('Prepared');
      case 'running': return this.i18n.t('Running');
      case 'success': return this.i18n.t('Successful');
      case 'failed': return this.i18n.t('Failed');
      default: return status || this.i18n.t('Unknown');
    }
  }

  canPrepareRestore(): boolean {
    const challenge = this.restoreChallenge();
    if (!challenge || !this.restoreTargetBackup()) {
      return false;
    }

    const confirmationWord = this.restoreConfirmForm.controls.confirmationWord.value.trim();
    const confirmationPin = this.restoreConfirmForm.controls.confirmationPin.value.trim();

    return this.restoreConfirmForm.valid
      && confirmationWord === challenge.confirmationWord
      && confirmationPin === challenge.confirmationPin
      && !this.restorePreparing()
      && !this.backupRunning();
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
          this.snackBar.open(this.i18n.t('Failed to load maintenance status.'), this.i18n.t('OK'), {
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
            this.snackBar.open(this.i18n.t('Failed to load backup catalog.'), this.i18n.t('OK'), {
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
            this.snackBar.open(this.i18n.t('Failed to load restore status.'), this.i18n.t('OK'), {
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
