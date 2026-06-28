import { CommonModule } from '@angular/common';
import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { finalize, firstValueFrom } from 'rxjs';
import { SecretDrop, SecretDropCryptoMetadata, SecretDropDecryptedContent, SecretDropEncryptedPayload } from '../../interfaces/secret-drop';
import { SecretDropCryptoService } from '../../services/secret-drop-crypto.service';
import { SecretDropService } from '../../services/secret-drop.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { LanguageService } from '../../services/language.service';
import { TranslateService } from '../../services/translate.service';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { DisplayMessage } from '../utils/display-message/display-message.component';
import { DisplayMessageService } from '../../services/display-message.service';
import { CheckPinComponent } from '../pin/check-pin/check-pin.component';
import { ShowmessageComponent } from '../showmessage/showmessage.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';

interface FoundSecretDropListData {
  drops: SecretDrop[];
  plusCode: string;
  zoomLevel: number;
}

interface UnlockedContent {
  drop: SecretDrop;
  content: SecretDropDecryptedContent;
}

@Component({
  selector: 'app-found-secret-drop-list',
  imports: [
    CommonModule,
    DialogHeaderComponent,
    MatButtonModule,
    MatCardModule,
    MatDialogActions,
    MatDialogContent,
    MatIconModule,
    ShowmessageComponent,
    ShowmultimediaComponent,
    TranslocoPipe
  ],
  templateUrl: './found-secret-drop-list.component.html',
  styleUrl: './found-secret-drop-list.component.css',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class FoundSecretDropListComponent {
  private readonly dialogRef = inject(MatDialogRef<FoundSecretDropListComponent>);
  private readonly matDialog = inject(MatDialog);
  private readonly secretDropService = inject(SecretDropService);
  private readonly cryptoService = inject(SecretDropCryptoService);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly translation = inject(TranslationHelperService);
  private readonly languageService = inject(LanguageService);
  private readonly translateService = inject(TranslateService);
  readonly data = inject<FoundSecretDropListData>(MAT_DIALOG_DATA);
  readonly unlockingUuid = signal<string | null>(null);
  readonly unlocked = signal<Record<string, UnlockedContent>>({});
  readonly translatedHints = signal<Record<string, string>>({});
  readonly translatingHintUuid = signal<string | null>(null);

  close(): void {
    this.dialogRef.close();
  }

  isUnlocked(drop: SecretDrop): boolean {
    return !!this.unlocked()[drop.uuid];
  }

  getUnlocked(drop: SecretDrop): UnlockedContent | null {
    return this.unlocked()[drop.uuid] ?? null;
  }


  getHintText(drop: SecretDrop): string {
    return this.translatedHints()[drop.uuid] ?? drop.hint ?? '';
  }

  translateHint(drop: SecretDrop): void {
    if (!drop.hint || this.translatingHintUuid()) {
      return;
    }

    this.translatingHintUuid.set(drop.uuid);
    this.translateService.translateSecretDropHint(drop.hint, this.languageService.effectiveLanguage(), false, drop.uuid)
      .pipe(finalize(() => this.translatingHintUuid.set(null)))
      .subscribe({
        next: (response) => {
          const translatedText = response.result?.text?.trim();
          if (!translatedText) {
            return;
          }
          this.translatedHints.update((state) => ({
            ...state,
            [drop.uuid]: translatedText
          }));
        },
        error: (error) => {
          const message = this.translateService.getErrorMessage(error)
            ?? this.translation.t('common.messageList.translateFailed');
          this.snackBar.open(message, undefined, {
            duration: 3000,
            verticalPosition: 'top',
            panelClass: 'snack-error'
          });
        }
      });
  }

  async unlock(drop: SecretDrop): Promise<void> {
    if (this.unlockingUuid()) {
      return;
    }
    const pin = await this.openPinDialog();
    if (!pin) {
      return;
    }
    const cryptoMetadata = this.asCryptoMetadata(drop.crypto);
    if (!cryptoMetadata) {
      this.showWarning('common.secretDropDiscovery.unlockFailed');
      return;
    }
    this.unlockingUuid.set(drop.uuid);
    try {
      const authVerifier = await this.cryptoService.deriveAuthVerifierFromMetadata(pin, cryptoMetadata);
      const unlockedDrop = await this.secretDropService.unlockSecretDrop(drop.uuid, authVerifier);
      const encryptedPayload = this.asEncryptedPayload(unlockedDrop.encryptedPayload);
      const unlockedCrypto = this.asCryptoMetadata(unlockedDrop.crypto);
      if (!encryptedPayload || !unlockedCrypto) {
        throw new Error('missing_secret_payload');
      }
      const content = await this.cryptoService.decryptSecret(encryptedPayload, unlockedCrypto, pin);
      this.unlocked.update((state) => ({
        ...state,
        [drop.uuid]: {
          drop: unlockedDrop,
          content
        }
      }));
      this.snackBar.open(this.translation.t('common.secretDropDiscovery.unlockSuccess'), undefined, {
        duration: 2400,
        verticalPosition: 'top',
        panelClass: 'snack-success'
      });
    } catch (error) {
      const key = this.resolveUnlockErrorKey(error);
      this.showWarning(key);
    } finally {
      this.unlockingUuid.set(null);
    }
  }

  private async openPinDialog(): Promise<string | null> {
    const dialogRef = this.matDialog.open(CheckPinComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { enterHintI18nKey: 'common.secretDropDiscovery.pinEnterHint' },
      maxWidth: '95vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
    return (await firstValueFrom(dialogRef.afterClosed())) ?? null;
  }

  private resolveUnlockErrorKey(error: unknown): string {
    const text = String((error as { error?: { message?: string; error?: string }, message?: string })?.error?.message
      ?? (error as { error?: { error?: string } })?.error?.error
      ?? (error as { message?: string })?.message
      ?? '');
    if (text.includes('invalid_secret_drop_password') || text.includes('forbidden')) {
      return 'common.secretDropDiscovery.invalidPin';
    }
    if (text.includes('consumed')) {
      return 'common.secretDropDiscovery.consumed';
    }
    if (text.includes('validity')) {
      return 'common.secretDropDiscovery.notInValidityWindow';
    }
    return 'common.secretDropDiscovery.unlockFailed';
  }

  private showWarning(messageKey: string): void {
    this.matDialog.open(DisplayMessage, {
      panelClass: '',
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.translation.t('common.secretDropDiscovery.title'),
        image: '',
        icon: 'warning',
        message: this.translation.t(messageKey),
        button: '',
        delay: 1600,
        showSpinner: false,
        autoclose: true
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      autoFocus: false
    });
  }

  private asCryptoMetadata(value: unknown): SecretDropCryptoMetadata | null {
    const candidate = typeof value === 'string' ? this.parseJson(value) : value;
    if (!candidate || typeof candidate !== 'object') {
      return null;
    }
    const metadata = candidate as SecretDropCryptoMetadata;
    return metadata.authSalt && metadata.salt && metadata.iv ? metadata : null;
  }

  private asEncryptedPayload(value: unknown): SecretDropEncryptedPayload | null {
    const candidate = typeof value === 'string' ? this.parseJson(value) : value;
    if (!candidate || typeof candidate !== 'object') {
      return null;
    }
    const payload = candidate as SecretDropEncryptedPayload;
    return payload.ciphertext ? payload : null;
  }

  private parseJson(value: string): unknown {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}
