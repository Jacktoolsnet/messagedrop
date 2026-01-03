import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { APP_VERSION_INFO } from '../../../environments/version';
import { AppSettings } from '../../interfaces/app-settings';
import { AppService } from '../../services/app.service';
import { LanguageMode, LanguageService } from '../../services/language.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { EnableLocationComponent } from "../utils/enable-location/enable-location.component";


@Component({
  selector: 'app-app-settings',
  providers: [provideTranslocoScope('settings')],
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatButtonToggleModule,
    MatChipsModule,
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
  readonly languageService = inject(LanguageService);
  private readonly translation = inject(TranslationHelperService);

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
  public appSettings: AppSettings = this.dialogData.appSettings;
  public showDetectLocationOnStart = false;
  public storagePersistenceSupported = this.appService.isStoragePersistenceSupported();
  public storagePersistenceBusy = false;
  public storagePersistenceWarning = '';
  public storageQuotaWarning = '';
  private readonly storageWarningThreshold = 0.9;

  ngOnInit(): void {
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

  setTheme(themeName: string): void {
    this.appSettings.defaultTheme = themeName;
    this.appService.setTheme(this.appSettings);
    this.appService.setAppSettings(this.appSettings);
  }

  setThemeMode(mode: 'light' | 'dark' | 'system') {
    this.appSettings.themeMode = mode;
    this.appService.setTheme(this.appSettings);
    this.appService.setAppSettings(this.appSettings);
  }

  setDetectLocationOnStart(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, detectLocationOnStart: enabled };
    this.appService.setAppSettings(this.appSettings);
  }

  setBackupOnExit(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, backupOnExit: enabled };
    this.appService.setAppSettings(this.appSettings);
  }

  setDiagnosticLogging(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, diagnosticLogging: enabled };
    this.appService.setAppSettings(this.appSettings);
  }

  setLanguageMode(mode: LanguageMode): void {
    this.appSettings = { ...this.appSettings, languageMode: mode };
    this.languageService.setLanguageMode(mode);
    this.appService.setAppSettings(this.appSettings);
  }

  async onStoragePersistenceToggle(event: MatSlideToggleChange): Promise<void> {
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

    this.storagePersistenceBusy = true;

    try {
      const granted = await this.appService.updateStoragePersistencePreference(targetState);
      this.appSettings = { ...this.appSettings, persistStorage: granted };
      if (targetState && !granted) {
        console.warn('Persistent storage could not be granted by the browser.');
      }
    } finally {
      this.storagePersistenceBusy = false;
      event.source.checked = this.appSettings.persistStorage;
      if (targetState && !this.appSettings.persistStorage) {
        this.storagePersistenceWarning = this.translation.t('settings.storage.warning');
      } else {
        this.storagePersistenceWarning = '';
      }
    }
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

}
