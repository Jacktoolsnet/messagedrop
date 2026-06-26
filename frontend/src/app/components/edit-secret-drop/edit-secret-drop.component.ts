import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { Location } from '../../interfaces/location';
import { SecretDropCreateRequest } from '../../interfaces/secret-drop';
import { GeolocationService } from '../../services/geolocation.service';
import { SecretDropCryptoService } from '../../services/secret-drop-crypto.service';
import { SecretDropService } from '../../services/secret-drop.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { DisplayMessageService } from '../../services/display-message.service';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { LocationPickerTileComponent } from '../utils/location-picker/location-picker-tile.component';

@Component({
  selector: 'app-edit-secret-drop',
  imports: [
    DialogHeaderComponent,
    FormsModule,
    LocationPickerTileComponent,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogActions,
    MatDialogContent,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslocoPipe
  ],
  templateUrl: './edit-secret-drop.component.html',
  styleUrl: './edit-secret-drop.component.css',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class EditSecretDropComponent {
  private readonly dialogRef = inject(MatDialogRef<EditSecretDropComponent>);
  private readonly data = inject<{ location: Location }>(MAT_DIALOG_DATA);
  private readonly cryptoService = inject(SecretDropCryptoService);
  private readonly secretDropService = inject(SecretDropService);
  private readonly userService = inject(UserService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly translation = inject(TranslationHelperService);

  location: Location = { ...this.data.location };
  message = '';
  hint = '';
  password = '';
  passwordRepeat = '';
  oneTime = true;
  useValidFrom = false;
  useValidUntil = false;
  validFromLocal = '';
  validUntilLocal = '';
  saving = signal(false);

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
      const encrypted = await this.cryptoService.encryptSecret(this.message.trim(), this.password);
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
        validFrom: this.useValidFrom ? this.toSeconds(this.validFromLocal) : null,
        validUntil: this.useValidUntil ? this.toSeconds(this.validUntilLocal) : null
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

  private validate(): string | null {
    if (!this.message.trim()) {
      return 'common.secretDrop.messageRequired';
    }
    if (this.password.length < 6) {
      return 'common.secretDrop.passwordTooShort';
    }
    if (this.password !== this.passwordRepeat) {
      return 'common.secretDrop.passwordMismatch';
    }
    const validFrom = this.useValidFrom ? this.toSeconds(this.validFromLocal) : null;
    const validUntil = this.useValidUntil ? this.toSeconds(this.validUntilLocal) : null;
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

  private toSeconds(value: string): number | null {
    if (!value) {
      return null;
    }
    const millis = new Date(value).getTime();
    return Number.isFinite(millis) ? Math.floor(millis / 1000) : null;
  }

  private showWarning(key: string, panelClass = 'snack-warning'): void {
    this.snackBar.open(this.translation.t(key), undefined, {
      duration: 3600,
      verticalPosition: 'top',
      panelClass
    });
  }
}
