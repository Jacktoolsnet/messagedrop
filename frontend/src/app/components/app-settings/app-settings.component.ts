import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
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
    this.appService.setTheme(baseline);
    const languageMode = baseline.languageMode ?? 'system';
    this.languageService.setLanguageModePreview(languageMode);
    this.languageService.endLanguagePreview();
  }

}
