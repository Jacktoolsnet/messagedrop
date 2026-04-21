import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleChange, MatSlideToggleModule } from '@angular/material/slide-toggle';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { APP_VERSION_INFO } from '../../../environments/version';
import { AppSettings } from '../../interfaces/app-settings';
import { PinInputFeedbackHapticStrength } from '../../interfaces/pin-input-feedback-settings';
import { SpeechVoiceMode } from '../../interfaces/speech-settings';
import { AppService } from '../../services/app.service';
import { LanguageMode, LanguageService } from '../../services/language.service';
import { SpeechService } from '../../services/speech.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { EnableLocationComponent } from '../utils/enable-location/enable-location.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-app-settings',
  providers: [provideTranslocoScope('settings')],
  imports: [
    DialogHeaderComponent,
    CommonModule,
    MatFormFieldModule,
    MatButtonModule,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatIconModule,
    MatSelectModule,
    MatSliderModule,
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
  readonly speechService = inject(SpeechService);
  private readonly translation = inject(TranslationHelperService);
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
  readonly speechRateMin = 0.6;
  readonly speechRateMax = 1.6;
  readonly speechRateStep = 0.1;
  readonly pinFeedbackAudioLevelMin = 0.4;
  readonly pinFeedbackAudioLevelMax = 1.6;
  readonly pinFeedbackAudioLevelStep = 0.1;
  readonly pinFeedbackHapticStrengthLevels: PinInputFeedbackHapticStrength[] = ['soft', 'normal', 'strong'];
  private readonly speechPreviewTargetId = 'settings:speech-preview';
  public showDetectLocationOnStart = false;
  public storagePersistenceSupported = this.appService.isStoragePersistenceSupported();
  public storagePersistenceBusy = false;
  public storagePersistenceWarning = '';
  public storageQuotaWarning = '';
  public pinFeedbackHapticSupported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
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

    if (!this.pinFeedbackHapticSupported && this.appSettings.pinInputFeedback.hapticEnabled) {
      this.appSettings = {
        ...this.appSettings,
        pinInputFeedback: {
          ...this.appSettings.pinInputFeedback,
          hapticEnabled: false
        }
      };
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

    this.speechService.init();
    void this.refreshStorageEstimate();
  }

  onCloseClick(): void {
    this.stopSpeechPreview();
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
    this.languageService.endLanguagePreview();

    if (shouldClose) {
      this.dialogRef.close();
    }
  }

  setTheme(themeName: string): void {
    this.appSettings = { ...this.appSettings, defaultTheme: themeName };
    this.appService.setTheme(this.appSettings);
  }

  setThemeMode(mode: 'light' | 'dark' | 'system'): void {
    this.appSettings = { ...this.appSettings, themeMode: mode };
    this.appService.setTheme(this.appSettings);
  }

  setDetectLocationOnStart(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, detectLocationOnStart: enabled };
  }

  setBackupOnExit(enabled: boolean): void {
    this.appSettings = { ...this.appSettings, backupOnExit: enabled };
  }

  setPinFeedbackHapticEnabled(enabled: boolean): void {
    this.appSettings = {
      ...this.appSettings,
      pinInputFeedback: {
        ...this.appSettings.pinInputFeedback,
        hapticEnabled: enabled
      }
    };
  }

  setPinFeedbackHapticStrength(hapticStrength: PinInputFeedbackHapticStrength): void {
    this.appSettings = {
      ...this.appSettings,
      pinInputFeedback: {
        ...this.appSettings.pinInputFeedback,
        hapticStrength
      }
    };
  }

  setPinFeedbackAudioEnabled(enabled: boolean): void {
    this.appSettings = {
      ...this.appSettings,
      pinInputFeedback: {
        ...this.appSettings.pinInputFeedback,
        audioEnabled: enabled
      }
    };
  }

  setPinFeedbackAudioLevel(level: number): void {
    this.appSettings = {
      ...this.appSettings,
      pinInputFeedback: {
        ...this.appSettings.pinInputFeedback,
        audioLevel: Math.min(this.pinFeedbackAudioLevelMax, Math.max(this.pinFeedbackAudioLevelMin, level))
      }
    };
  }

  setSpeechEnabled(enabled: boolean): void {
    this.appSettings = {
      ...this.appSettings,
      speech: {
        ...this.appSettings.speech,
        enabled
      }
    };
  }

  setSpeechPreferTranslatedText(enabled: boolean): void {
    this.appSettings = {
      ...this.appSettings,
      speech: {
        ...this.appSettings.speech,
        preferTranslatedText: enabled
      }
    };
  }

  setSpeechAutoStopOnNavigation(enabled: boolean): void {
    this.appSettings = {
      ...this.appSettings,
      speech: {
        ...this.appSettings.speech,
        autoStopOnNavigation: enabled
      }
    };
  }

  setSpeechVoiceMode(mode: SpeechVoiceMode): void {
    const recommendedVoiceUri = mode === 'custom' ? this.getRecommendedSpeechVoiceUri() : '';
    this.appSettings = {
      ...this.appSettings,
      speech: {
        ...this.appSettings.speech,
        voiceMode: mode,
        voiceUri: mode === 'system'
          ? ''
          : (this.appSettings.speech.voiceUri || recommendedVoiceUri)
      }
    };
  }

  setSpeechVoiceUri(voiceUri: string): void {
    this.appSettings = {
      ...this.appSettings,
      speech: {
        ...this.appSettings.speech,
        voiceUri
      }
    };
  }

  setSpeechRate(rate: number): void {
    this.appSettings = {
      ...this.appSettings,
      speech: {
        ...this.appSettings.speech,
        rate
      }
    };
  }

  toggleSpeechPreview(): void {
    const previewText = this.translation.t('settings.speech.previewText');
    this.speechService.toggle(
      {
        targetId: this.speechPreviewTargetId,
        text: previewText,
        lang: this.languageService.effectiveLanguage()
      },
      {
        ...this.appSettings.speech,
        enabled: true
      }
    );
  }

  stopSpeechPreview(): void {
    this.speechService.stopIfCurrentTarget(this.speechPreviewTargetId);
  }

  isSpeechPreviewActive(): boolean {
    return this.speechService.isActive(this.speechPreviewTargetId);
  }

  getSpeechPreviewIcon(): string {
    return this.isSpeechPreviewActive() ? 'stop' : 'volume_up';
  }

  getSpeechPreviewLabel(): string {
    return this.translation.t(
      this.isSpeechPreviewActive()
        ? 'settings.speech.stopPreviewAction'
        : 'settings.speech.previewAction'
    );
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

  formatSpeechRate(rate: number): string {
    return `${rate.toFixed(1)}×`;
  }

  formatPinFeedbackAudioLevel(level: number): string {
    return `${Math.round(level * 100)}%`;
  }

  readonly formatPinFeedbackAudioLevelSlider = (value: number): string =>
    this.formatPinFeedbackAudioLevel(value);

  getResolvedSpeechVoiceUri(): string {
    return this.appSettings.speech.voiceUri || this.getRecommendedSpeechVoiceUri();
  }

  getSpeechVoiceOptionValue(voice: SpeechSynthesisVoice): string {
    return this.speechService.getVoiceStorageId(voice);
  }

  private getRecommendedSpeechVoiceUri(): string {
    const voice = this.speechService.getRecommendedVoice(this.languageService.effectiveLanguage(), {
      ...this.appSettings.speech,
      enabled: true
    });
    return voice ? this.speechService.getVoiceStorageId(voice) : '';
  }

  private resetPreviewState(): void {
    this.stopSpeechPreview();
    const baseline = structuredClone(this.baselineSettings);
    this.appSettings = baseline;
    this.appService.setTheme(baseline);
    const languageMode = baseline.languageMode ?? 'system';
    this.languageService.setLanguageModePreview(languageMode);
    this.languageService.endLanguagePreview();
  }
}
