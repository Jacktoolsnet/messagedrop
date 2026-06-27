import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule, provideNativeDateAdapter } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { TranslocoPipe } from '@jsverse/transloco';
import { Location } from '../../interfaces/location';
import { Multimedia } from '../../interfaces/multimedia';
import { MultimediaType } from '../../interfaces/multimedia-type';
import { SecretDropCreateRequest } from '../../interfaces/secret-drop';
import { GeolocationService } from '../../services/geolocation.service';
import { SecretDropCryptoService } from '../../services/secret-drop-crypto.service';
import { SecretDropService } from '../../services/secret-drop.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { DisplayMessageService } from '../../services/display-message.service';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { LocationPickerTileComponent } from '../utils/location-picker/location-picker-tile.component';
import { TextComponent } from '../utils/text/text.component';
import { FontPickerDialogComponent } from '../utils/font-picker-dialog/font-picker-dialog.component';
import { SelectMultimediaComponent } from '../multimedia/select-multimedia/select-multimedia.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';

interface TextDialogResult {
  text: string;
}

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
    MatCheckboxModule,
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
  private readonly data = inject<{ location: Location }>(MAT_DIALOG_DATA);
  private readonly cryptoService = inject(SecretDropCryptoService);
  private readonly secretDropService = inject(SecretDropService);
  private readonly userService = inject(UserService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);

  location: Location = { ...this.data.location };
  message = '';
  messageStyle = '';
  hint = '';
  password = '';
  passwordRepeat = '';
  oneTime = true;
  useValidFrom = false;
  useValidUntil = false;
  validFromDate: Date | null = null;
  validFromTime: Date | null = null;
  validUntilDate: Date | null = null;
  validUntilTime: Date | null = null;
  multimedia: Multimedia = this.emptyMultimedia();
  saving = signal(false);

  get hasMultimedia(): boolean {
    return this.multimedia.type !== MultimediaType.UNDEFINED;
  }

  async create(): Promise<void> {
    if (this.saving()) {
      return;
    }
    const validationError = this.validate();
    if (validationError) {
      this.showWarning(validationError);
      return;
    }

    this.saving.set(true);
    try {
      const encrypted = await this.cryptoService.encryptSecret(
        this.message.trim(),
        this.password,
        this.hasMultimedia ? this.multimedia : undefined,
        this.messageStyle
      );
      const request: SecretDropCreateRequest = {
        userId: this.userService.getUser().id,
        latitude: this.location.latitude,
        longitude: this.location.longitude,
        plusCode: this.resolvePlusCode(this.location),
        discoveryPlusCode: this.resolvePlusCode(this.location),
        hint: this.hint.trim(),
        encryptedPayload: encrypted.encryptedPayload,
        crypto: encrypted.crypto,
        authVerifier: encrypted.authVerifier,
        maxUnlocks: this.oneTime ? 1 : null,
        validFrom: this.useValidFrom ? this.toSeconds(this.validFromDate, this.validFromTime) : null,
        validUntil: this.useValidUntil ? this.toSeconds(this.validUntilDate, this.validUntilTime) : null
      };
      await this.secretDropService.createSecretDrop(request);
      this.snackBar.open(this.translation.t('common.secretDrop.createSuccess'), undefined, {
        duration: 3200,
        verticalPosition: 'top',
        panelClass: 'snack-success'
      });
      this.dialogRef.close(true);
    } catch (error) {
      const key = error instanceof Error && error.message === 'password_too_short'
        ? 'common.secretDrop.passwordTooShort'
        : 'common.secretDrop.createFailed';
      this.showWarning(key, 'snack-error');
    } finally {
      this.saving.set(false);
    }
  }

  updateLocation(location: Location): void {
    this.location = { ...location };
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

  private validate(): string | null {
    if (!this.message.trim() && !this.hasMultimedia) {
      return 'common.secretDrop.contentRequired';
    }
    if (this.password.length < 6) {
      return 'common.secretDrop.passwordTooShort';
    }
    if (this.password !== this.passwordRepeat) {
      return 'common.secretDrop.passwordMismatch';
    }
    const validFrom = this.useValidFrom ? this.toSeconds(this.validFromDate, this.validFromTime) : null;
    const validUntil = this.useValidUntil ? this.toSeconds(this.validUntilDate, this.validUntilTime) : null;
    if (this.useValidFrom && validFrom === null) {
      return 'common.secretDrop.validFromInvalid';
    }
    if (this.useValidUntil && validUntil === null) {
      return 'common.secretDrop.validUntilInvalid';
    }
    if (validFrom !== null && validUntil !== null && validFrom > validUntil) {
      return 'common.secretDrop.validityInvalid';
    }
    return null;
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
