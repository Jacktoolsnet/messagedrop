import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { APP_VERSION_INFO } from '../../../environments/version';
import { AppSettings } from '../../interfaces/app-settings';
import { UsageProtectionMode, UsageProtectionSettings } from '../../interfaces/usage-protection-settings';
import { AppService } from '../../services/app.service';
import { LanguageMode, LanguageService } from '../../services/language.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UsageProtectionService } from '../../services/usage-protection.service';
import { EnableLocationComponent } from "../utils/enable-location/enable-location.component";
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';


@Component({
  selector: 'app-app-settings',
  providers: [provideTranslocoScope('settings')],
  imports: [
    DialogHeaderComponent,
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonToggleModule,
    MatSlideToggleModule,
    TranslocoPipe,
    EnableLocationComponent
  ],
  templateUrl: './app-settings.component.html',
  styleUrl: './app-settings.component.css'
})
export class AppSettingsComponent implements OnInit {
  private readonly appService = inject(AppService);
  private readonly dialogRef = inject(MatDialogRef<AppSettingsComponent>);
  private readonly dialogData = inject<{ appSettings: AppSettings }>(MAT_DIALOG_DATA);
  private readonly languageService = inject(LanguageService);
  private readonly translation = inject(TranslationHelperService);
  private readonly usageProtectionService = inject(UsageProtectionService);
  readonly help = inject(HelpDialogService);

  public versionInfo = APP_VERSION_INFO;

  public availableThemes = [
    'azure',
    'blue',
    'chartreuse',
    'cyan',
    'green',
    'magenta',
    'orange',
    'red',
    'rose',
    'spring-green',
    'violet',
    'yellow'
  ];
  public appSettings: AppSettings = structuredClone(this.dialogData.appSettings);
  private baselineSettings: AppSettings = structuredClone(this.dialogData.appSettings);
  public readonly usageModes: UsageProtectionMode[] = ['off', 'self', 'parental'];
  public usageParentPin = '';
  public usageParentPinConfirm = '';
  public usageProtectionWarning = '';
  public showDetectLocationOnStart = false;
  public storagePersistenceSupported = this.appService.isStoragePersistenceSupported();
  public storagePersistenceBusy = false;
  public storagePersistenceWarning = '';
  public storageQuotaWarning = '';
  private readonly storageWarningThreshold = 0.9;

  ngOnInit(): void {
    this.dialogRef.beforeClosed().subscribe(() => {
      this.resetPreviewState();
    });
    const initialLanguage = this.appSettings.languageMode ?? this.languageService.languageMode();
    if (initialLanguage !== this.appSettings.languageMode) {
      this.appSettings = { ...this.appSettings, languageMode: initialLanguage };
      this.baselineSettings = { ...this.baselineSettings, languageMode: initialLanguage };
    }
    if ('permissions' in navigator && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then(result => {
          this.showDetectLocationOnStart = result.state === 'granted';
        })
        .catch(() => {
          this.showDetectLocationOnStart = false;
        });
    }
    void this.refreshStorageEstimate();
  }

  onCloseClick(): void {
    this.dialogRef.close();
  }

  async onApplyClick(): Promise<void> {
    let nextSettings = { ...this.appSettings };
    let shouldClose = true;
    this.usageProtectionWarning = '';

    const preparedUsageProtection = await this.prepareUsageProtectionSettings(nextSettings.usageProtection);
    if (!preparedUsageProtection) {
      return;
    }
    nextSettings = { ...nextSettings, usageProtection: preparedUsageProtection };

    if (this.storagePersistenceSupported) {
      const wantsPersistence = !!nextSettings.persistStorage;
      if (wantsPersistence) {
        this.storagePersistenceBusy = true;
        const granted = await this.appService.requestStoragePersistence();
        this.storagePersistenceBusy = false;
        nextSettings = { ...nextSettings, persistStorage: granted };
        if (!granted) {
          this.storagePersistenceWarning = this.translation.t('settings.storage.warning');
          shouldClose = false;
        } else {
          this.storagePersistenceWarning = '';
        }
      } else {
        this.storagePersistenceWarning = '';
      }
    }

    await this.appService.setAppSettings(nextSettings);
    this.appService.setTheme(nextSettings);
    this.appSettings = nextSettings;
    this.baselineSettings = structuredClone(nextSettings);
    this.usageParentPin = '';
    this.usageParentPinConfirm = '';
    this.languageService.endLanguagePreview();

    if (shouldClose) {
      this.dialogRef.close();
    }
  }

  setTheme(themeName: string): void {
    this.appSettings = { ...this.appSettings, defaultTheme: themeName };
    this.appService.setTheme(this.appSettings);
  }

  setThemeMode(mode: 'light' | 'dark' | 'system') {
    this.appSettings = { ...this.appSettings, themeMode: mode };
    this.appService.setTheme(this.appSettings);
  }

  setDetectLocationOnStart(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, detectLocationOnStart: enabled };
  }

  setBackupOnExit(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, backupOnExit: enabled };
  }

  setUsageMode(mode: UsageProtectionMode): void {
    this.appSettings = {
      ...this.appSettings,
      usageProtection: {
        ...this.appSettings.usageProtection,
        mode
      }
    };
    this.usageProtectionWarning = '';
  }

  setUsageScheduleEnabled(enabled: boolean): void {
    this.appSettings = {
      ...this.appSettings,
      usageProtection: {
        ...this.appSettings.usageProtection,
        scheduleEnabled: enabled
      }
    };
  }

  setUsageDailyLimitMinutes(value: number): void {
    this.appSettings = {
      ...this.appSettings,
      usageProtection: {
        ...this.appSettings.usageProtection,
        dailyLimitMinutes: this.clampInteger(value, 5, 720, 60)
      }
    };
  }

  setUsageSelfExtensionMinutes(value: number): void {
    this.appSettings = {
      ...this.appSettings,
      usageProtection: {
        ...this.appSettings.usageProtection,
        selfExtensionMinutes: this.clampInteger(value, 0, 120, 5)
      }
    };
  }

  setUsageWeekdayStart(value: string): void {
    this.updateUsageTimeField('weekdayStart', value);
  }

  setUsageWeekdayEnd(value: string): void {
    this.updateUsageTimeField('weekdayEnd', value);
  }

  setUsageWeekendStart(value: string): void {
    this.updateUsageTimeField('weekendStart', value);
  }

  setUsageWeekendEnd(value: string): void {
    this.updateUsageTimeField('weekendEnd', value);
  }

  setDiagnosticLogging(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, diagnosticLogging: enabled };
  }

  setLanguageMode(mode: LanguageMode): void {
    this.appSettings = { ...this.appSettings, languageMode: mode };
    this.languageService.setLanguageModePreview(mode);
  }

  onStoragePersistenceToggle(event: MatSlideToggleChange): void {
    if (!this.storagePersistenceSupported) {
      event.source.checked = false;
      return;
    }

    const targetState = event.checked;
    const previousState = this.appSettings.persistStorage ?? false;

    if (!targetState) {
      const confirmed = typeof window === 'undefined'
        ? true
        : window.confirm(this.translation.t('settings.storage.confirmDisable'));
      if (!confirmed) {
        event.source.checked = previousState;
        return;
      }
    }

    this.appSettings = { ...this.appSettings, persistStorage: targetState };
    this.storagePersistenceWarning = '';
  }

  private async refreshStorageEstimate(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
      this.storageQuotaWarning = '';
      return;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage;
      const quota = estimate.quota;
      if (typeof usage !== 'number' || typeof quota !== 'number' || quota <= 0) {
        this.storageQuotaWarning = '';
        return;
      }

      const ratio = usage / quota;
      if (ratio >= this.storageWarningThreshold) {
        const percent = Math.round(ratio * 100);
        const usedLabel = this.formatBytes(usage);
        const totalLabel = this.formatBytes(quota);
        this.storageQuotaWarning = this.translation.t('settings.storage.quotaWarning', {
          percent,
          used: usedLabel,
          total: totalLabel
        });
      } else {
        this.storageQuotaWarning = '';
      }
    } catch {
      this.storageQuotaWarning = '';
    }
  }

  private formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  private resetPreviewState(): void {
    const baseline = structuredClone(this.baselineSettings);
    this.appSettings = baseline;
    this.usageParentPin = '';
    this.usageParentPinConfirm = '';
    this.usageProtectionWarning = '';
    this.appService.setTheme(baseline);
    const languageMode = baseline.languageMode ?? 'system';
    this.languageService.setLanguageModePreview(languageMode);
    this.languageService.endLanguagePreview();
  }

  private async prepareUsageProtectionSettings(settings: UsageProtectionSettings): Promise<UsageProtectionSettings | null> {
    const normalized: UsageProtectionSettings = {
      ...settings,
      dailyLimitMinutes: this.clampInteger(settings.dailyLimitMinutes, 5, 720, 60),
      selfExtensionMinutes: this.clampInteger(settings.selfExtensionMinutes, 0, 120, 5),
      weekdayStart: this.normalizeTime(settings.weekdayStart, '06:00'),
      weekdayEnd: this.normalizeTime(settings.weekdayEnd, '22:00'),
      weekendStart: this.normalizeTime(settings.weekendStart, '06:00'),
      weekendEnd: this.normalizeTime(settings.weekendEnd, '23:00')
    };

    if (normalized.mode !== 'parental') {
      return normalized;
    }

    const pin = this.usageParentPin.trim();
    const confirm = this.usageParentPinConfirm.trim();

    if (!pin && !confirm && normalized.parentPinHash) {
      return normalized;
    }

    if (!pin && !confirm && !normalized.parentPinHash) {
      this.usageProtectionWarning = this.translation.t('settings.usageProtection.pinMissing');
      return null;
    }

    if (!this.usageProtectionService.isValidPinFormat(pin)) {
      this.usageProtectionWarning = this.translation.t('settings.usageProtection.pinFormat');
      return null;
    }

    if (pin !== confirm) {
      this.usageProtectionWarning = this.translation.t('settings.usageProtection.pinMismatch');
      return null;
    }

    const hashed = await this.usageProtectionService.hashPin(pin);
    if (!hashed) {
      this.usageProtectionWarning = this.translation.t('settings.usageProtection.pinHashFailed');
      return null;
    }

    return {
      ...normalized,
      parentPinHash: hashed
    };
  }

  private updateUsageTimeField(field: 'weekdayStart' | 'weekdayEnd' | 'weekendStart' | 'weekendEnd', value: string): void {
    this.appSettings = {
      ...this.appSettings,
      usageProtection: {
        ...this.appSettings.usageProtection,
        [field]: this.normalizeTime(value, this.appSettings.usageProtection[field])
      }
    };
  }

  private clampInteger(value: unknown, min: number, max: number, fallback: number): number {
    const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, Math.round(parsed)));
  }

  private normalizeTime(value: string, fallback: string): string {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value) ? value : fallback;
  }

}
