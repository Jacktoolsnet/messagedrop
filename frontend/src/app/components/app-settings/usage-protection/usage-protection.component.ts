import { CommonModule } from '@angular/common';
import { Component, OnInit, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { DateAdapter, MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogClose, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { provideTranslocoScope, TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AppSettings } from '../../../interfaces/app-settings';
import {
  createDefaultUsageProtectionDailyWindows,
  USAGE_PROTECTION_DAY_KEYS,
  UsageProtectionDailyWindows,
  UsageProtectionDayKey,
  UsageProtectionMode,
  UsageProtectionSettings
} from '../../../interfaces/usage-protection-settings';
import { AppService } from '../../../services/app.service';
import { LanguageService } from '../../../services/language.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { UsageProtectionService } from '../../../services/usage-protection.service';
import { CheckPinComponent } from '../../pin/check-pin/check-pin.component';
import { CreatePinComponent } from '../../pin/create-pin/create-pin.component';
import { DisplayMessage } from '../../utils/display-message/display-message.component';
import { HelpDialogService } from '../../utils/help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';
import {
  ValueEditDialogComponent,
  ValueEditDialogData,
  ValueEditDialogResult
} from '../../utils/value-edit-dialog/value-edit-dialog.component';

type UsageTimePickerModel = Record<UsageProtectionDayKey, { start: Date; end: Date }>;

@Component({
  selector: 'app-usage-protection',
  providers: [provideTranslocoScope('settings'), provideNativeDateAdapter()],
  imports: [
    DialogHeaderComponent,
    CommonModule,
    FormsModule,
    MatNativeDateModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogContent,
    MatDialogActions,
    MatDialogClose,
    MatIconModule,
    MatButtonToggleModule,
    MatSliderModule,
    MatSlideToggleModule,
    MatTimepickerModule,
    TranslocoPipe
  ],
  templateUrl: './usage-protection.component.html',
  styleUrl: './usage-protection.component.css'
})
export class UsageProtectionComponent implements OnInit {
  private readonly appService = inject(AppService);
  private readonly dialog = inject(MatDialog);
  private readonly dialogRef = inject(MatDialogRef<UsageProtectionComponent>);
  private readonly dialogData = inject<{ appSettings: AppSettings }>(MAT_DIALOG_DATA);
  private readonly translation = inject(TranslationHelperService);
  private readonly usageProtectionService = inject(UsageProtectionService);
  private readonly languageService = inject(LanguageService);
  private readonly dateAdapter = inject<DateAdapter<Date>>(DateAdapter);
  readonly help = inject(HelpDialogService);

  public appSettings: AppSettings = structuredClone(this.dialogData.appSettings);
  public readonly usageModes: UsageProtectionMode[] = ['off', 'self', 'parental'];
  public usageParentPin = '';
  public usageProtectionWarning = '';
  public usageProtectionUnlocked = false;
  readonly usageDailyLimitMin = 5;
  readonly usageDailyLimitMax = 720;
  readonly usageDailyLimitStep = 1;
  readonly usageSelfExtensionMin = 0;
  readonly usageSelfExtensionMax = 120;
  readonly usageSelfExtensionStep = 1;
  readonly usageParentalExtensionMin = 1;
  readonly usageParentalExtensionMax = 240;
  readonly usageParentalExtensionStep = 1;
  readonly usageScheduleDays = [...USAGE_PROTECTION_DAY_KEYS];
  private readonly defaultDailyWindows = createDefaultUsageProtectionDailyWindows();
  usageTimePickerModel: UsageTimePickerModel = this.createUsageTimePickerModel(this.defaultDailyWindows);

  constructor() {
    effect(() => {
      this.dateAdapter.setLocale(this.languageService.effectiveLanguage());
    });
  }

  ngOnInit(): void {
    const normalizedDailyWindows = this.normalizeDailyWindows(
      this.appSettings.usageProtection.dailyWindows,
      this.appSettings.usageProtection
    );
    this.appSettings = {
      ...this.appSettings,
      usageProtection: {
        ...this.appSettings.usageProtection,
        dailyWindows: normalizedDailyWindows
      }
    };
    this.usageTimePickerModel = this.createUsageTimePickerModel(normalizedDailyWindows);
    this.usageProtectionUnlocked = !this.hasParentPinConfigured(this.appSettings.usageProtection);
  }

  onCloseClick(): void {
    this.dialogRef.close();
  }

  async onApplyClick(): Promise<void> {
    this.usageProtectionWarning = '';

    const preparedUsageProtection = await this.prepareUsageProtectionSettings(this.appSettings.usageProtection);
    if (!preparedUsageProtection) {
      return;
    }

    const currentSettings = this.appService.getAppSettings();
    await this.appService.setAppSettings({
      ...currentSettings,
      usageProtection: preparedUsageProtection
    });

    this.usageParentPin = '';
    this.dialogRef.close();
  }

  async setUsageMode(mode: UsageProtectionMode): Promise<void> {
    if (this.needsUsageProtectionUnlock()) {
      return;
    }

    const currentMode = this.appSettings.usageProtection.mode;
    const hasParentPin = Boolean(this.appSettings.usageProtection.parentPinHash?.trim());
    if (currentMode === 'parental' && mode !== 'parental' && hasParentPin) {
      const verified = await this.verifyCurrentParentPin();
      if (!verified) {
        return;
      }
    }

    this.appSettings = {
      ...this.appSettings,
      usageProtection: {
        ...this.appSettings.usageProtection,
        mode
      }
    };
    this.usageProtectionWarning = '';
  }

  async unlockUsageProtectionSettings(): Promise<void> {
    const verified = await this.verifyCurrentParentPin();
    if (!verified) {
      return;
    }
    this.usageProtectionUnlocked = true;
  }

  async removeUsageParentPin(): Promise<void> {
    if (!this.hasParentPinConfigured(this.appSettings.usageProtection)) {
      return;
    }
    const verified = await this.verifyCurrentParentPin();
    if (!verified) {
      return;
    }

    const current = this.appSettings.usageProtection;
    this.appSettings = {
      ...this.appSettings,
      usageProtection: {
        ...current,
        mode: current.mode === 'parental' ? 'self' : current.mode,
        parentPinHash: undefined
      }
    };
    this.usageParentPin = '';
    this.usageProtectionWarning = '';
    this.usageProtectionUnlocked = true;
  }

  async openUsageParentPinDialog(): Promise<void> {
    if (this.needsUsageProtectionUnlock()) {
      return;
    }
    this.usageProtectionWarning = '';
    const existingParentHash = this.appSettings.usageProtection.parentPinHash?.trim();
    if (existingParentHash) {
      const verified = await this.verifyCurrentParentPin();
      if (!verified) {
        return;
      }
    }

    const dialogRef = this.dialog.open(CreatePinComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
    });
    const pin = await firstValueFrom(dialogRef.afterClosed());
    if (!pin || !this.usageProtectionService.isValidPinFormat(pin)) {
      return;
    }
    this.usageParentPin = pin.trim();
  }

  setUsageScheduleEnabled(enabled: boolean): void {
    if (this.needsUsageProtectionUnlock()) {
      return;
    }
    this.appSettings = {
      ...this.appSettings,
      usageProtection: {
        ...this.appSettings.usageProtection,
        scheduleEnabled: enabled
      }
    };
  }

  setUsageDailyLimitMinutes(value: number): void {
    if (this.needsUsageProtectionUnlock()) {
      return;
    }
    this.appSettings = {
      ...this.appSettings,
      usageProtection: {
        ...this.appSettings.usageProtection,
        dailyLimitMinutes: this.clampInteger(value, 5, 720, 60)
      }
    };
  }

  setUsageSelfExtensionMinutes(value: number): void {
    if (this.needsUsageProtectionUnlock()) {
      return;
    }
    this.appSettings = {
      ...this.appSettings,
      usageProtection: {
        ...this.appSettings.usageProtection,
        selfExtensionMinutes: this.clampInteger(value, 0, 120, 5)
      }
    };
  }

  setUsageParentalExtensionMinutes(value: number): void {
    if (this.needsUsageProtectionUnlock()) {
      return;
    }
    this.appSettings = {
      ...this.appSettings,
      usageProtection: {
        ...this.appSettings.usageProtection,
        parentalExtensionMinutes: this.clampInteger(value, 1, 240, 5)
      }
    };
  }

  async openUsageDailyLimitEditor(): Promise<void> {
    await this.openUsageValueEditor({
      title: this.translation.t('settings.usageProtection.dailyLimit'),
      label: this.translation.t('settings.usageProtection.dailyLimit'),
      minBound: this.usageDailyLimitMin,
      maxBound: this.usageDailyLimitMax,
      step: this.usageDailyLimitStep,
      value: this.appSettings.usageProtection.dailyLimitMinutes
    }, value => this.setUsageDailyLimitMinutes(value));
  }

  async openUsageSelfExtensionEditor(): Promise<void> {
    await this.openUsageValueEditor({
      title: this.translation.t('settings.usageProtection.selfExtension'),
      label: this.translation.t('settings.usageProtection.selfExtension'),
      minBound: this.usageSelfExtensionMin,
      maxBound: this.usageSelfExtensionMax,
      step: this.usageSelfExtensionStep,
      value: this.appSettings.usageProtection.selfExtensionMinutes
    }, value => this.setUsageSelfExtensionMinutes(value));
  }

  async openUsageParentalExtensionEditor(): Promise<void> {
    await this.openUsageValueEditor({
      title: this.translation.t('settings.usageProtection.parentalExtension'),
      label: this.translation.t('settings.usageProtection.parentalExtension'),
      minBound: this.usageParentalExtensionMin,
      maxBound: this.usageParentalExtensionMax,
      step: this.usageParentalExtensionStep,
      value: this.appSettings.usageProtection.parentalExtensionMinutes
    }, value => this.setUsageParentalExtensionMinutes(value));
  }

  getUsageDayStartDate(day: UsageProtectionDayKey): Date {
    return this.usageTimePickerModel[day].start;
  }

  getUsageDayEndDate(day: UsageProtectionDayKey): Date {
    return this.usageTimePickerModel[day].end;
  }

  setUsageDayStart(day: UsageProtectionDayKey, value: unknown): void {
    if (this.needsUsageProtectionUnlock()) {
      return;
    }
    this.updateUsageTimeField(day, 'start', value);
  }

  setUsageDayEnd(day: UsageProtectionDayKey, value: unknown): void {
    if (this.needsUsageProtectionUnlock()) {
      return;
    }
    this.updateUsageTimeField(day, 'end', value);
  }

  private async verifyCurrentParentPin(): Promise<boolean> {
    if (this.usageProtectionUnlocked) {
      return true;
    }
    const existingParentHash = this.appSettings.usageProtection.parentPinHash?.trim();
    if (!existingParentHash) {
      return true;
    }

    const checkDialogRef = this.dialog.open(CheckPinComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {},
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
    });

    const currentPin = await firstValueFrom(checkDialogRef.afterClosed());
    if (!currentPin || !this.usageProtectionService.isValidPinFormat(currentPin)) {
      return false;
    }

    const currentHash = await this.usageProtectionService.hashPin(currentPin.trim());
    if (!currentHash || currentHash !== existingParentHash) {
      await this.showUsageProtectionMessage('settings.usageProtection.pinCurrentMismatch');
      return false;
    }
    this.usageProtectionUnlocked = true;
    return true;
  }

  private async showUsageProtectionMessage(messageKey: string): Promise<void> {
    const dialogRef = this.dialog.open(DisplayMessage, {
      panelClass: '',
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.translation.t('settings.usageProtection.title'),
        image: '',
        icon: 'warning',
        message: this.translation.t(messageKey),
        button: this.translation.t('common.actions.ok'),
        delay: 0,
        showSpinner: false,
        autoclose: false
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
    await firstValueFrom(dialogRef.afterClosed());
  }

  private async openUsageValueEditor(
    dialogData: ValueEditDialogData,
    applyValue: (value: number) => void
  ): Promise<void> {
    if (this.needsUsageProtectionUnlock()) {
      return;
    }

    const dialogRef = this.dialog.open<ValueEditDialogComponent, ValueEditDialogData, ValueEditDialogResult>(
      ValueEditDialogComponent,
      {
        panelClass: '',
        closeOnNavigation: true,
        data: dialogData,
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        disableClose: false
      }
    );
    const result = await firstValueFrom(dialogRef.afterClosed());
    if (!result) {
      return;
    }
    applyValue(result.value);
  }

  private async prepareUsageProtectionSettings(settings: UsageProtectionSettings): Promise<UsageProtectionSettings | null> {
    const normalized: UsageProtectionSettings = {
      ...settings,
      dailyLimitMinutes: this.clampInteger(settings.dailyLimitMinutes, 5, 720, 60),
      selfExtensionMinutes: this.clampInteger(settings.selfExtensionMinutes, 0, 120, 5),
      parentalExtensionMinutes: this.clampInteger(settings.parentalExtensionMinutes, 1, 240, 5),
      dailyWindows: this.normalizeDailyWindows(settings.dailyWindows, settings)
    };

    if (normalized.mode !== 'parental') {
      return normalized;
    }

    const pin = this.usageParentPin.trim();

    if (!pin && normalized.parentPinHash) {
      return normalized;
    }

    if (!pin && !normalized.parentPinHash) {
      const messageKey = 'settings.usageProtection.pinMissing';
      this.usageProtectionWarning = this.translation.t(messageKey);
      await this.showUsageProtectionMessage(messageKey);
      return null;
    }

    if (!this.usageProtectionService.isValidPinFormat(pin)) {
      this.usageProtectionWarning = this.translation.t('settings.usageProtection.pinFormat');
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

  private updateUsageTimeField(day: UsageProtectionDayKey, bound: 'start' | 'end', value: unknown): void {
    const currentWindows = this.getUsageDailyWindows();
    const fallback = currentWindows[day][bound];
    const nextValue = this.normalizeTime(this.toTimeString(value, fallback), fallback);

    this.appSettings = {
      ...this.appSettings,
      usageProtection: {
        ...this.appSettings.usageProtection,
        dailyWindows: {
          ...currentWindows,
          [day]: {
            ...currentWindows[day],
            [bound]: nextValue
          }
        }
      }
    };

    if (bound === 'start') {
      this.usageTimePickerModel = {
        ...this.usageTimePickerModel,
        [day]: {
          ...this.usageTimePickerModel[day],
          start: this.toDateFromTime(nextValue)
        }
      };
    } else {
      this.usageTimePickerModel = {
        ...this.usageTimePickerModel,
        [day]: {
          ...this.usageTimePickerModel[day],
          end: this.toDateFromTime(nextValue)
        }
      };
    }
  }

  private getUsageDailyWindows(): UsageProtectionDailyWindows {
    return this.normalizeDailyWindows(
      this.appSettings.usageProtection.dailyWindows,
      this.appSettings.usageProtection
    );
  }

  private normalizeDailyWindows(
    dailyWindows: UsageProtectionDailyWindows | undefined,
    legacy?: Partial<UsageProtectionSettings>
  ): UsageProtectionDailyWindows {
    const base = createDefaultUsageProtectionDailyWindows();
    if (dailyWindows) {
      for (const day of this.usageScheduleDays) {
        const source = dailyWindows[day];
        if (!source) {
          continue;
        }
        base[day] = {
          start: this.normalizeTime(source.start, base[day].start),
          end: this.normalizeTime(source.end, base[day].end)
        };
      }
      return base;
    }

    const weekdayStart = this.normalizeTime(legacy?.weekdayStart ?? '', this.defaultDailyWindows.monday.start);
    const weekdayEnd = this.normalizeTime(legacy?.weekdayEnd ?? '', this.defaultDailyWindows.monday.end);
    const weekendStart = this.normalizeTime(legacy?.weekendStart ?? '', this.defaultDailyWindows.saturday.start);
    const weekendEnd = this.normalizeTime(legacy?.weekendEnd ?? '', this.defaultDailyWindows.saturday.end);

    return {
      monday: { start: weekdayStart, end: weekdayEnd },
      tuesday: { start: weekdayStart, end: weekdayEnd },
      wednesday: { start: weekdayStart, end: weekdayEnd },
      thursday: { start: weekdayStart, end: weekdayEnd },
      friday: { start: weekdayStart, end: weekdayEnd },
      saturday: { start: weekendStart, end: weekendEnd },
      sunday: { start: weekendStart, end: weekendEnd }
    };
  }

  private toDateFromTime(value: string): Date {
    const normalized = this.normalizeTime(value, '00:00');
    const [hours, minutes] = normalized.split(':').map(part => Number.parseInt(part, 10));
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  private createUsageTimePickerModel(windows: UsageProtectionDailyWindows): UsageTimePickerModel {
    return {
      monday: { start: this.toDateFromTime(windows.monday.start), end: this.toDateFromTime(windows.monday.end) },
      tuesday: { start: this.toDateFromTime(windows.tuesday.start), end: this.toDateFromTime(windows.tuesday.end) },
      wednesday: { start: this.toDateFromTime(windows.wednesday.start), end: this.toDateFromTime(windows.wednesday.end) },
      thursday: { start: this.toDateFromTime(windows.thursday.start), end: this.toDateFromTime(windows.thursday.end) },
      friday: { start: this.toDateFromTime(windows.friday.start), end: this.toDateFromTime(windows.friday.end) },
      saturday: { start: this.toDateFromTime(windows.saturday.start), end: this.toDateFromTime(windows.saturday.end) },
      sunday: { start: this.toDateFromTime(windows.sunday.start), end: this.toDateFromTime(windows.sunday.end) }
    };
  }

  private toTimeString(value: unknown, fallback: string): string {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      const hours = `${value.getHours()}`.padStart(2, '0');
      const minutes = `${value.getMinutes()}`.padStart(2, '0');
      return `${hours}:${minutes}`;
    }
    if (typeof value === 'string') {
      return value;
    }
    return fallback;
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

  private hasParentPinConfigured(settings: UsageProtectionSettings): boolean {
    return Boolean(settings.parentPinHash?.trim());
  }

  needsUsageProtectionUnlock(): boolean {
    return this.hasParentPinConfigured(this.appSettings.usageProtection) && !this.usageProtectionUnlocked;
  }

  hasConfiguredParentPin(): boolean {
    return this.hasParentPinConfigured(this.appSettings.usageProtection);
  }
}
