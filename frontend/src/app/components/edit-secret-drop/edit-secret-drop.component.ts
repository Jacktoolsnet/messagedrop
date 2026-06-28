import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { Location } from '../../interfaces/location';
import { Multimedia } from '../../interfaces/multimedia';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { SecretDrop, SecretDropCreateRequest } from '../../interfaces/secret-drop';
import { GeolocationService } from '../../services/geolocation.service';
import { SecretDropCryptoService } from '../../services/secret-drop-crypto.service';
import { SecretDropService } from '../../services/secret-drop.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { DisplayMessageService } from '../../services/display-message.service';
import { MessageService } from '../../services/message.service';
import { DisplayMessage } from '../utils/display-message/display-message.component';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { LocationPickerTileComponent } from '../utils/location-picker/location-picker-tile.component';
import { TextComponent } from '../utils/text/text.component';
import { FontPickerDialogComponent } from '../utils/font-picker-dialog/font-picker-dialog.component';
import { SelectMultimediaComponent } from '../multimedia/select-multimedia/select-multimedia.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { CreatePinComponent } from '../pin/create-pin/create-pin.component';

interface TextDialogResult {
  text: string;
}

type SecretDropCreateAction = 'publish' | 'draft';

@Component({
  selector: 'app-edit-secret-drop',
  providers: [provideNativeDateAdapter()],
  imports: [
    DialogHeaderComponent,
    FormsModule,
    LocationPickerTileComponent,
    SelectMultimediaComponent,
    ShowmultimediaComponent,
    MatButtonModule,
    MatCardModule,
    MatSlideToggleModule,
    MatSliderModule,
    MatDatepickerModule,
    MatDialogActions,
    MatDialogContent,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatNativeDateModule,
    MatTimepickerModule,
    TranslocoPipe
  ],
  templateUrl: './edit-secret-drop.component.html',
  styleUrl: './edit-secret-drop.component.css',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class EditSecretDropComponent {
  private readonly dialogRef = inject(MatDialogRef<EditSecretDropComponent>);
  private readonly matDialog = inject(MatDialog);
  private readonly data = inject<{ location: Location; secretDrop?: SecretDrop }>(MAT_DIALOG_DATA);
  private readonly cryptoService = inject(SecretDropCryptoService);
  private readonly secretDropService = inject(SecretDropService);
  private readonly messageService = inject(MessageService);
  private readonly userService = inject(UserService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);

  location: Location = { ...this.data.location };
  message = '';
  messageStyle = '';
  hint = '';
  hintStyle = '';
  readonly minDiscoveryZoomLevel = 12;
  readonly maxDiscoveryZoomLevel = 19;
  pin = '';
  oneTime = true;
  discoveryZoomLevel = 18;
  useValidFrom = false;
  useValidUntil = false;
  validFromDate: Date | null = null;
  validFromTime: Date | null = null;
  validUntilDate: Date | null = null;
  validUntilTime: Date | null = null;
  multimedia: Multimedia = this.emptyMultimedia();
  saving = signal(false);

  constructor() {
    const drop = this.data.secretDrop;
    if (!drop) {
      return;
    }
    this.location = { ...drop.location };
    this.message = drop.message ?? '';
    this.messageStyle = drop.messageStyle ?? '';
    this.hint = drop.hint ?? '';
    this.hintStyle = drop.hintStyle ?? '';
    this.oneTime = drop.maxUnlocks === 1;
    this.discoveryZoomLevel = this.clampDiscoveryZoomLevel(drop.discoveryZoomLevel);
    this.useValidFrom = drop.validFrom !== null && drop.validFrom !== undefined;
    this.useValidUntil = drop.validUntil !== null && drop.validUntil !== undefined;
    this.validFromDate = drop.validFrom ? new Date(drop.validFrom * 1000) : null;
    this.validFromTime = drop.validFrom ? new Date(drop.validFrom * 1000) : null;
    this.validUntilDate = drop.validUntil ? new Date(drop.validUntil * 1000) : null;
    this.validUntilTime = drop.validUntil ? new Date(drop.validUntil * 1000) : null;
    this.multimedia = drop.multimedia ?? this.emptyMultimedia();
  }

  get hasMultimedia(): boolean {
    return this.multimedia.type !== MultimediaType.UNDEFINED;
  }

  get hasSecretContent(): boolean {
    return this.message.trim().length > 0 || this.hasMultimedia;
  }

  get minStartDate(): Date {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  }

  get validFromMinTime(): Date | null {
    if (!this.validFromDate || !this.isSameDate(this.validFromDate, new Date())) {
      return null;
    }
    return this.ceilToNextMinuteInterval(new Date(), 15);
  }

  get minEndDate(): Date {
    if (this.useValidFrom && this.validFromDate) {
      return this.startOfDay(this.validFromDate);
    }
    return this.minStartDate;
  }

  get validUntilMinTime(): Date | null {
    if (!this.validUntilDate) {
      return null;
    }
    const minimum = this.getMinimumValidUntilDateTime();
    return this.isSameDate(this.validUntilDate, minimum) ? minimum : null;
  }

  async create(action: SecretDropCreateAction = 'publish'): Promise<void> {
    if (this.saving()) {
      return;
    }
    const validationError = this.validate(action);
    if (validationError) {
      if (validationError === 'common.secretDrop.pinRequired') {
        const pinCreated = await this.openPinDialog();
        if (!pinCreated) {
          return;
        }
        const validationAfterPin = this.validate(action);
        if (validationAfterPin) {
          this.showWarning(validationAfterPin);
          return;
        }
      } else {
        this.showWarning(validationError);
        return;
      }
    }

    if (action === 'draft') {
      await this.saveLocalDraft();
      return;
    }

    const moderationErrorKey = await this.getSecretTextModerationErrorKey();
    if (moderationErrorKey) {
      this.dialogRef.close(true);
      this.showModerationRejected(moderationErrorKey);
      return;
    }

    this.saving.set(true);
    try {
      const request = await this.buildPublishRequest();
      if (this.data.secretDrop) {
        await this.secretDropService.republishSecretDrop(this.data.secretDrop.uuid, request, this.getLocalPlainData());
        this.snackBar.open(this.translation.t('common.secretDrop.updateSuccess'), undefined, {
          duration: 3200,
          verticalPosition: 'top',
          panelClass: 'snack-success'
        });
      } else {
        await this.secretDropService.createSecretDrop(request, this.getLocalPlainData());
        this.snackBar.open(this.translation.t('common.secretDrop.createSuccess'), undefined, {
          duration: 3200,
          verticalPosition: 'top',
          panelClass: 'snack-success'
        });
      }
      this.dialogRef.close(true);
    } catch (error) {
      const key = error instanceof Error && (error.message === 'password_too_short' || error.message === 'pin_too_short')
        ? 'common.secretDrop.pinRequired'
        : 'common.secretDrop.createFailed';
      this.showWarning(key, 'snack-error');
    } finally {
      this.saving.set(false);
    }
  }


  private async buildPublishRequest(): Promise<SecretDropCreateRequest> {
    const encrypted = await this.cryptoService.encryptSecret(
      this.message.trim(),
      this.pin,
      this.hasMultimedia ? this.multimedia : undefined,
      this.messageStyle
    );
    return {
      userId: this.userService.getUser().id,
      latitude: this.location.latitude,
      longitude: this.location.longitude,
      plusCode: this.resolvePlusCode(this.location),
      discoveryPlusCode: this.resolvePlusCode(this.location),
      discoveryZoomLevel: this.clampDiscoveryZoomLevel(this.discoveryZoomLevel),
      hint: this.hint.trim(),
      hintStyle: this.hintStyle,
      encryptedPayload: encrypted.encryptedPayload,
      crypto: encrypted.crypto,
      authVerifier: encrypted.authVerifier,
      maxUnlocks: this.oneTime ? 1 : null,
      validFrom: this.useValidFrom ? this.toSeconds(this.validFromDate, this.validFromTime) : null,
      validUntil: this.useValidUntil ? this.toSeconds(this.validUntilDate, this.validUntilTime) : null,
      publishState: 'published'
    };
  }

  private async saveLocalDraft(): Promise<void> {
    const userId = this.userService.getUser().id;
    const drop: SecretDrop = {
      uuid: this.data.secretDrop?.uuid ?? crypto.randomUUID(),
      userId,
      location: this.location,
      latitude: this.location.latitude,
      longitude: this.location.longitude,
      plusCode: this.resolvePlusCode(this.location),
      discoveryPlusCode: this.resolvePlusCode(this.location),
      discoveryZoomLevel: this.clampDiscoveryZoomLevel(this.discoveryZoomLevel),
      hint: this.hint.trim(),
      hintStyle: this.hintStyle,
      message: this.message.trim(),
      messageStyle: this.messageStyle,
      multimedia: this.hasMultimedia ? this.multimedia : null,
      maxUnlocks: this.oneTime ? 1 : null,
      unlockCount: this.data.secretDrop?.unlockCount ?? 0,
      failedUnlockCount: this.data.secretDrop?.failedUnlockCount ?? 0,
      validFrom: this.useValidFrom ? this.toSeconds(this.validFromDate, this.validFromTime) : null,
      validUntil: this.useValidUntil ? this.toSeconds(this.validUntilDate, this.validUntilTime) : null,
      status: this.data.secretDrop?.status ?? 'disabled',
      publishState: this.data.secretDrop?.publishState ?? 'draft',
      localOnly: this.data.secretDrop?.localOnly ?? true,
      likes: this.data.secretDrop?.likes ?? 0,
      dislikes: this.data.secretDrop?.dislikes ?? 0,
      commentsNumber: this.data.secretDrop?.commentsNumber ?? 0,
      createdAt: this.data.secretDrop?.createdAt ?? Math.floor(Date.now() / 1000)
    };
    await this.secretDropService.saveDraftSecretDrop(userId, drop);
    this.snackBar.open(this.translation.t(this.data.secretDrop ? 'common.secretDrop.updateSuccess' : 'common.secretDrop.draftSuccess'), undefined, {
      duration: 3200,
      verticalPosition: 'top',
      panelClass: 'snack-success'
    });
    this.dialogRef.close(true);
  }

  private getLocalPlainData(): Partial<SecretDrop> {
    return {
      message: this.message.trim(),
      messageStyle: this.messageStyle,
      multimedia: this.hasMultimedia ? this.multimedia : null,
      discoveryZoomLevel: this.clampDiscoveryZoomLevel(this.discoveryZoomLevel),
      hint: this.hint.trim(),
      hintStyle: this.hintStyle,
      maxUnlocks: this.oneTime ? 1 : null,
      validFrom: this.useValidFrom ? this.toSeconds(this.validFromDate, this.validFromTime) : null,
      validUntil: this.useValidUntil ? this.toSeconds(this.validUntilDate, this.validUntilTime) : null
    };
  }


  formatZoomLevelLabel(value: number): string {
    return `${Math.round(value)}`;
  }

  onDiscoveryZoomLevelChange(value: number): void {
    this.discoveryZoomLevel = this.clampDiscoveryZoomLevel(value);
  }

  updateLocation(location: Location): void {
    this.location = { ...location };
  }

  ensureValidFromNotInPast(): void {
    if (!this.validFromDate) {
      return;
    }

    const now = new Date();
    if (this.isBeforeDateOnly(this.validFromDate, now)) {
      this.validFromDate = this.minStartDate;
      this.validFromTime = this.ceilToNextMinuteInterval(now, 15);
      return;
    }

    if (this.isSameDate(this.validFromDate, now)) {
      const minTime = this.ceilToNextMinuteInterval(now, 15);
      if (!this.validFromTime || this.compareTime(this.validFromTime, minTime) < 0) {
        this.validFromTime = minTime;
      }
    }
    this.ensureValidUntilNotBeforeMinimum();
  }

  ensureValidUntilNotBeforeMinimum(): void {
    if (!this.validUntilDate) {
      return;
    }

    const minimum = this.getMinimumValidUntilDateTime();
    if (this.isBeforeDateOnly(this.validUntilDate, minimum)) {
      this.validUntilDate = this.startOfDay(minimum);
      this.validUntilTime = new Date(minimum);
      return;
    }

    if (this.isSameDate(this.validUntilDate, minimum)) {
      const currentUntil = this.toDateTime(this.validUntilDate, this.validUntilTime);
      if (currentUntil.getTime() < minimum.getTime()) {
        this.validUntilTime = new Date(minimum);
      }
    }
  }

  applyNewMultimedia(multimedia: Multimedia): void {
    this.multimedia = multimedia;
  }

  removeMultimedia(): void {
    this.multimedia = this.emptyMultimedia();
  }

  openTextDialog(): void {
    const dialogRef = this.matDialog.open(TextComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { text: this.message },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: true
    });

    dialogRef.afterClosed().subscribe((result?: TextDialogResult) => {
      if (result?.text != null) {
        this.message = result.text;
        if (!this.messageStyle) {
          this.messageStyle = this.userService.getProfile().defaultStyle ?? '';
        }
      }
    });
  }

  removeText(): void {
    this.message = '';
  }

  openHintDialog(): void {
    const dialogRef = this.matDialog.open(TextComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {
        text: this.hint,
        titleKey: 'common.secretDrop.hintLabel',
        titleIcon: 'psychology_alt'
      },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: true
    });

    dialogRef.afterClosed().subscribe((result?: TextDialogResult) => {
      if (result?.text != null) {
        this.hint = result.text;
        if (!this.hintStyle) {
          this.hintStyle = this.userService.getProfile().defaultStyle ?? '';
        }
      }
    });
  }

  removeHint(): void {
    this.hint = '';
    this.hintStyle = '';
  }

  async openPinDialog(): Promise<boolean> {
    const dialogRef = this.matDialog.open(CreatePinComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {
        titleKey: 'common.secretDrop.pinTitle',
        createHintKey: 'common.secretDrop.pinCreateHint',
        confirmHintKey: 'common.secretDrop.pinConfirmHint'
      },
      maxWidth: '95vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    const pin = await firstValueFrom(dialogRef.afterClosed());
    if (!pin) {
      return false;
    }
    this.pin = pin;
    this.snackBar.open(this.translation.t('common.secretDrop.pinCreated'), undefined, {
      duration: 2400,
      verticalPosition: 'top',
      panelClass: 'snack-success'
    });
    return true;
  }

  onHintFontClick(): void {
    const dialogRef = this.matDialog.open(FontPickerDialogComponent, {
      data: { currentStyle: this.hintStyle },
      maxWidth: '95vw',
      width: '95vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((style?: string) => {
      if (style) {
        this.hintStyle = style;
      }
    });
  }

  onFontClick(): void {
    const dialogRef = this.matDialog.open(FontPickerDialogComponent, {
      data: { currentStyle: this.messageStyle },
      maxWidth: '95vw',
      width: '95vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((style?: string) => {
      if (style) {
        this.messageStyle = style;
      }
    });
  }


  private clampDiscoveryZoomLevel(value: unknown): number {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 18;
    }
    return Math.min(this.maxDiscoveryZoomLevel, Math.max(this.minDiscoveryZoomLevel, Math.round(numeric)));
  }

  private validate(action: SecretDropCreateAction = 'publish'): string | null {
    if (!this.hasSecretContent) {
      return 'common.secretDrop.contentRequired';
    }
    if (action === 'publish' && this.pin.length !== 6) {
      return 'common.secretDrop.pinRequired';
    }
    const validFrom = this.useValidFrom ? this.toSeconds(this.validFromDate, this.validFromTime) : null;
    const validUntil = this.useValidUntil ? this.toSeconds(this.validUntilDate, this.validUntilTime) : null;
    if (this.useValidFrom && validFrom === null) {
      return 'common.secretDrop.validFromInvalid';
    }
    if (validFrom !== null && validFrom < Math.floor(Date.now() / 1000)) {
      return 'common.secretDrop.validFromPast';
    }
    if (this.useValidUntil && validUntil === null) {
      return 'common.secretDrop.validUntilInvalid';
    }
    if (validUntil !== null && validUntil < Math.floor(Date.now() / 1000)) {
      return 'common.secretDrop.validUntilPast';
    }
    if (validFrom !== null && validUntil !== null && validFrom > validUntil) {
      return 'common.secretDrop.validityInvalid';
    }
    return null;
  }

  private async getSecretTextModerationErrorKey(): Promise<string | null> {
    const moderationInput = [this.message, this.hint]
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .join('\n\n');

    if (!moderationInput) {
      return null;
    }

    if (this.messageService.detectPersonalInformation(moderationInput)) {
      return 'common.message.moderationRejectedPattern';
    }
    if (this.detectThreateningOrAbusiveContent(moderationInput)) {
      return 'common.message.moderationRejectedAi';
    }

    try {
      const response = await firstValueFrom(this.messageService.moderatePublicContent(moderationInput));
      const decision = response?.moderation?.decision ?? 'approved';
      if (decision === 'rejected') {
        const reason = response?.moderation?.reason ?? null;
        const key = reason === 'pattern'
          ? 'common.message.moderationRejectedPattern'
          : reason === 'ai'
            ? 'common.message.moderationRejectedAi'
            : 'common.message.moderationRejected';
        return key;
      }
      return null;
    } catch {
      return 'common.message.moderationFailed';
    }
  }

  private showModerationRejected(messageKey: string): void {
    this.matDialog.open(DisplayMessage, {
      panelClass: '',
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.translation.t('common.moderation.title'),
        image: '',
        icon: messageKey === 'common.message.moderationFailed' ? 'warning' : 'block',
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
  }

  private detectThreateningOrAbusiveContent(text: string): boolean {
    const normalized = String(text ?? '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) {
      return false;
    }

    const patterns = [
      /\bich\s+bring(?:e)?\s+(?:dich|dir|ihn|sie|euch|deine|deinen|deiner)\s+(?:um|umbringen)\b/i,
      /\b(?:bring(?:e)?|bringe|bringen)\s+(?:dich|ihn|sie|euch)\s+um\b/i,
      /\b(?:ich\s+)?(?:mach(?:e)?|mache)\s+(?:dich|ihn|sie|euch)\s+fertig\b/i,
      /\b(?:ich\s+)?(?:toete|tote|kill(?:e)?|ermorde)\s+(?:dich|ihn|sie|euch)\b/i,
      /\bdu\s+(?:bloede|blode|dumme|drecks|scheiss|scheiss)\w*\s*(?:schlampe|hure|fotze)\b/i,
      /\bdrecks(?:schlampe|hure|fotze)\b/i,
      /\b(?:ich\s+)?(?:werde\s+)?(?:dich|ihn|sie|euch)\s+(?:verletzen|verpruegeln|verprugeln|erschlagen|abstechen)\b/i
    ];

    return patterns.some((pattern) => pattern.test(normalized));
  }

  private resolvePlusCode(location: Location): string {
    return location.plusCode?.trim() || this.geolocationService.getPlusCode(location.latitude, location.longitude);
  }

  private toSeconds(date: Date | null, time: Date | null): number | null {
    if (!date) {
      return null;
    }
    const combined = new Date(date);
    combined.setHours(time?.getHours() ?? 0, time?.getMinutes() ?? 0, 0, 0);
    const millis = combined.getTime();
    return Number.isFinite(millis) ? Math.floor(millis / 1000) : null;
  }

  private toDateTime(date: Date, time: Date | null): Date {
    const combined = new Date(date);
    combined.setHours(time?.getHours() ?? 0, time?.getMinutes() ?? 0, 0, 0);
    return combined;
  }

  private getMinimumValidUntilDateTime(): Date {
    if (this.useValidFrom && this.validFromDate) {
      return this.toDateTime(this.validFromDate, this.validFromTime);
    }
    return this.ceilToNextMinuteInterval(new Date(), 15);
  }

  private startOfDay(value: Date): Date {
    const result = new Date(value);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private isBeforeDateOnly(value: Date, compareTo: Date): boolean {
    const left = this.startOfDay(value);
    const right = this.startOfDay(compareTo);
    return left.getTime() < right.getTime();
  }

  private isSameDate(left: Date, right: Date): boolean {
    return left.getFullYear() === right.getFullYear()
      && left.getMonth() === right.getMonth()
      && left.getDate() === right.getDate();
  }

  private compareTime(left: Date, right: Date): number {
    const leftMinutes = left.getHours() * 60 + left.getMinutes();
    const rightMinutes = right.getHours() * 60 + right.getMinutes();
    return leftMinutes - rightMinutes;
  }

  private ceilToNextMinuteInterval(value: Date, intervalMinutes: number): Date {
    const result = new Date(value);
    result.setSeconds(0, 0);
    const minutes = result.getMinutes();
    const remainder = minutes % intervalMinutes;
    if (remainder !== 0) {
      result.setMinutes(minutes + intervalMinutes - remainder);
    }
    return result;
  }

  private showWarning(key: string, panelClass = 'snack-warning'): void {
    this.snackBar.open(this.translation.t(key), undefined, {
      duration: 3600,
      verticalPosition: 'top',
      panelClass
    });
  }

  private emptyMultimedia(): Multimedia {
    return {
      type: MultimediaType.UNDEFINED,
      url: '',
      sourceUrl: '',
      attribution: '',
      title: '',
      description: '',
      contentId: ''
    };
  }
}
