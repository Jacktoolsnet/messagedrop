import { CommonModule } from '@angular/common';
import { Component, inject, signal, ChangeDetectionStrategy, computed } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import { finalize, firstValueFrom } from 'rxjs';
import { SecretDrop, SecretDropCryptoMetadata, SecretDropDecryptedContent, SecretDropEncryptedPayload } from '../../interfaces/secret-drop';
import { SecretDropCryptoService } from '../../services/secret-drop-crypto.service';
import { SecretDropService } from '../../services/secret-drop.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { LanguageService } from '../../services/language.service';
import { TranslateService } from '../../services/translate.service';
import { UserService } from '../../services/user.service';
import { AppService } from '../../services/app.service';
import { SpeechService } from '../../services/speech.service';
import { ShortNumberPipe } from '../../pipes/short-number.pipe';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { DisplayMessage } from '../utils/display-message/display-message.component';
import { DisplayMessageService } from '../../services/display-message.service';
import { CheckPinComponent } from '../pin/check-pin/check-pin.component';
import { ShowmessageComponent } from '../showmessage/showmessage.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { SecretDropCommentsDialogComponent } from '../secret-drop-comments-dialog/secret-drop-comments-dialog.component';
import { EditSecretDropComponent } from '../edit-secret-drop/edit-secret-drop.component';
import { DeleteMessageComponent } from '../messagelist/delete-message/delete-message.component';

interface FoundSecretDropListData {
  drops: SecretDrop[];
  plusCode: string;
  zoomLevel: number;
}

interface UnlockedContent {
  drop: SecretDrop;
  content: SecretDropDecryptedContent;
  pin: string;
}

@Component({
  selector: 'app-found-secret-drop-list',
  imports: [
    CommonModule,
    DialogHeaderComponent,
    ShortNumberPipe,
    MatBadgeModule,
    MatButtonModule,
    MatCardModule,
    MatDialogActions,
    MatDialogContent,
    MatIconModule,
    MatMenuModule,
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
  private readonly appService = inject(AppService);
  private readonly speechService = inject(SpeechService);
  readonly userService = inject(UserService);
  readonly data = inject<FoundSecretDropListData>(MAT_DIALOG_DATA);
  readonly unlockingUuid = signal<string | null>(null);
  readonly unlocked = signal<Record<string, UnlockedContent>>({});
  readonly translatedHints = signal<Record<string, string>>({});
  readonly translatingHintUuid = signal<string | null>(null);
  readonly translatingMessageUuid = signal<string | null>(null);
  readonly translatedMessages = signal<Record<string, string>>({});
  readonly reactingUuid = signal<string | null>(null);
  readonly translationTargetLabel = computed(() => this.languageService.effectiveLanguage().toUpperCase());

  close(): void {
    this.dialogRef.close();
  }

  isUnlocked(drop: SecretDrop): boolean {
    return !!this.unlocked()[drop.uuid];
  }

  getUnlocked(drop: SecretDrop): UnlockedContent | null {
    return this.unlocked()[drop.uuid] ?? null;
  }



  isOwnUnlockedDrop(drop: SecretDrop): boolean {
    const unlocked = this.getUnlocked(drop);
    return !!unlocked
      && this.userService.hasJwt()
      && String(unlocked.drop.userId || '') === String(this.userService.getUser().id || '');
  }

  canPublishDrop(drop: SecretDrop): boolean {
    const displayDrop = this.getDisplayDrop(drop);
    return displayDrop.status === 'disabled' || displayDrop.status === 'consumed';
  }

  canUnpublishDrop(drop: SecretDrop): boolean {
    return this.getDisplayDrop(drop).status === 'enabled';
  }

  editOwnDrop(drop: SecretDrop): void {
    const unlocked = this.getUnlocked(drop);
    if (!unlocked || !this.isOwnUnlockedDrop(drop)) {
      return;
    }
    const editableDrop: SecretDrop = {
      ...unlocked.drop,
      location: unlocked.drop.location ?? {
        latitude: Number(unlocked.drop.latitude ?? 0),
        longitude: Number(unlocked.drop.longitude ?? 0),
        plusCode: unlocked.drop.plusCode
      },
      message: unlocked.content.message ?? '',
      messageStyle: unlocked.content.style ?? '',
      multimedia: unlocked.content.multimedia ?? null,
      localSecretPin: unlocked.pin
    };
    const dialogRef = this.matDialog.open(EditSecretDropComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { location: editableDrop.location, secretDrop: editableDrop },
      minWidth: 'min(450px, 95vw)',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
    dialogRef.afterClosed().subscribe((changed?: boolean) => {
      if (changed) {
        this.close();
      }
    });
  }

  async publishOwnDrop(drop: SecretDrop): Promise<void> {
    if (!this.isOwnUnlockedDrop(drop)) {
      return;
    }
    try {
      const updated = await this.secretDropService.publishSecretDrop(drop.uuid);
      this.patchUnlockedDrop(drop, updated);
      this.snackBar.open(this.translation.t('common.secretDrop.publishSuccess'), undefined, {
        duration: 2600,
        verticalPosition: 'top',
        panelClass: 'snack-success'
      });
    } catch {
      this.snackBar.open(this.translation.t('common.secretDrop.publishFailed'), undefined, {
        duration: 3200,
        verticalPosition: 'top',
        panelClass: 'snack-error'
      });
    }
  }

  async unpublishOwnDrop(drop: SecretDrop): Promise<void> {
    if (!this.isOwnUnlockedDrop(drop)) {
      return;
    }
    try {
      const updated = await this.secretDropService.unpublishSecretDrop(drop.uuid);
      this.patchUnlockedDrop(drop, updated);
      this.snackBar.open(this.translation.t('common.secretDrop.unpublishSuccess'), undefined, {
        duration: 2600,
        verticalPosition: 'top',
        panelClass: 'snack-success'
      });
    } catch {
      this.snackBar.open(this.translation.t('common.secretDrop.unpublishFailed'), undefined, {
        duration: 3200,
        verticalPosition: 'top',
        panelClass: 'snack-error'
      });
    }
  }

  async deleteOwnDrop(drop: SecretDrop): Promise<void> {
    if (!this.isOwnUnlockedDrop(drop)) {
      return;
    }
    const confirmed = await this.confirmDelete();
    if (!confirmed) {
      return;
    }
    try {
      const deleted = await this.secretDropService.deleteSecretDrop(drop.uuid);
      if (deleted) {
        await this.secretDropService.removeLocalSecretDrop(this.userService.getUser().id, drop.uuid);
        const index = this.data.drops.findIndex((entry) => entry.uuid === drop.uuid);
        if (index >= 0) {
          this.data.drops.splice(index, 1);
        }
        this.unlocked.update((state) => {
          const { [drop.uuid]: _removed, ...rest } = state;
          return rest;
        });
      }
      this.snackBar.open(this.translation.t(deleted ? 'common.secretDrop.deleteSuccess' : 'common.secretDrop.deleteFailed'), undefined, {
        duration: 3200,
        verticalPosition: 'top',
        panelClass: deleted ? 'snack-success' : 'snack-error'
      });
      if (deleted && this.data.drops.length === 0) {
        this.close();
      }
    } catch {
      this.snackBar.open(this.translation.t('common.secretDrop.deleteFailed'), undefined, {
        duration: 3200,
        verticalPosition: 'top',
        panelClass: 'snack-error'
      });
    }
  }

  private async confirmDelete(): Promise<boolean> {
    const dialogRef = this.matDialog.open(DeleteMessageComponent, {
      closeOnNavigation: true,
      data: {
        titleKey: 'common.secretDrop.deleteDialog.title',
        confirmKey: 'common.secretDrop.deleteDialog.confirm'
      },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false
    });
    return !!(await firstValueFrom(dialogRef.afterClosed()));
  }

  private patchUnlockedDrop(drop: SecretDrop, updated: SecretDrop): void {
    Object.assign(drop, updated);
    this.unlocked.update((state) => {
      const unlocked = state[drop.uuid];
      if (!unlocked) {
        return state;
      }
      return {
        ...state,
        [drop.uuid]: {
          ...unlocked,
          drop: { ...unlocked.drop, ...updated }
        }
      };
    });
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
        error: (error) => this.showTranslateError(error)
      });
  }


  getDisplayDrop(drop: SecretDrop): SecretDrop {
    return this.getUnlocked(drop)?.drop ?? drop;
  }

  getUnlockedMessage(drop: SecretDrop): string {
    const unlocked = this.getUnlocked(drop);
    if (!unlocked) {
      return '';
    }
    return this.translatedMessages()[drop.uuid] ?? unlocked.content.message ?? '';
  }

  translateUnlockedMessage(drop: SecretDrop): void {
    const unlocked = this.getUnlocked(drop);
    const message = unlocked?.content.message?.trim() ?? '';
    if (!message || this.translatingMessageUuid()) {
      return;
    }

    this.translatingMessageUuid.set(drop.uuid);
    this.translateService.translate(message, this.languageService.effectiveLanguage(), false)
      .pipe(finalize(() => this.translatingMessageUuid.set(null)))
      .subscribe({
        next: (response) => {
          const translatedText = response.result?.text?.trim();
          if (!translatedText) {
            return;
          }
          this.translatedMessages.update((state) => ({
            ...state,
            [drop.uuid]: translatedText
          }));
        },
        error: (error) => this.showTranslateError(error)
      });
  }



  toggleReadAloud(drop: SecretDrop, source: 'hint' | 'message'): void {
    if (!this.speechService.supported()) {
      this.showReadAloudHint('common.messageList.readAloudUnsupported');
      return;
    }

    if (!this.appService.getAppSettings().speech?.enabled) {
      this.showReadAloudHint('common.messageList.readAloudDisabled');
      return;
    }

    const text = this.getSpeechText(drop, source);
    if (!text) {
      return;
    }

    this.speechService.toggle({
      targetId: this.getSpeechTargetId(drop, source),
      text,
      lang: this.isTranslatedSpeech(drop, source) ? this.languageService.effectiveLanguage() : undefined
    });
  }

  getReadAloudIcon(drop: SecretDrop, source: 'hint' | 'message'): string {
    return this.speechService.isActive(this.getSpeechTargetId(drop, source)) ? 'stop' : 'volume_up';
  }

  getReadAloudLabel(drop: SecretDrop, source: 'hint' | 'message'): string {
    return this.translation.t(
      this.speechService.isActive(this.getSpeechTargetId(drop, source))
        ? 'common.messageList.stopReadAloud'
        : 'common.messageList.readAloud'
    );
  }

  private getSpeechTargetId(drop: SecretDrop, source: 'hint' | 'message'): string {
    return `secret-drop:${source}:${drop.uuid}`;
  }

  private isTranslatedSpeech(drop: SecretDrop, source: 'hint' | 'message'): boolean {
    if (this.appService.getAppSettings().speech?.preferTranslatedText === false) {
      return false;
    }
    return source === 'hint'
      ? !!this.translatedHints()[drop.uuid]
      : !!this.translatedMessages()[drop.uuid];
  }

  private getSpeechText(drop: SecretDrop, source: 'hint' | 'message'): string {
    if (source === 'hint') {
      return (this.isTranslatedSpeech(drop, source)
        ? this.translatedHints()[drop.uuid]
        : drop.hint ?? '').trim();
    }
    const unlocked = this.getUnlocked(drop);
    if (!unlocked) {
      return '';
    }
    return (this.isTranslatedSpeech(drop, source)
      ? this.translatedMessages()[drop.uuid]
      : unlocked.content.message ?? '').trim();
  }

  private showReadAloudHint(messageKey: string): void {
    this.matDialog.open(DisplayMessage, {
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.translation.t('common.messageList.readAloud'),
        image: '',
        icon: 'record_voice_over',
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

  openComments(drop: SecretDrop): void {
    const unlocked = this.getUnlocked(drop);
    if (!unlocked) {
      return;
    }
    const dialogRef = this.matDialog.open(SecretDropCommentsDialogComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { drop: unlocked.drop, pin: unlocked.pin },
      maxWidth: '95vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
    dialogRef.afterClosed().subscribe((result?: { commentsNumber?: number }) => {
      if (typeof result?.commentsNumber !== 'number') {
        return;
      }
      this.updateDropCommentCount(drop, result.commentsNumber);
    });
  }

  private updateDropCommentCount(drop: SecretDrop, commentsNumber: number): void {
    drop.commentsNumber = commentsNumber;
    this.unlocked.update((state) => {
      const unlocked = state[drop.uuid];
      if (!unlocked) {
        return state;
      }
      return {
        ...state,
        [drop.uuid]: {
          ...unlocked,
          drop: {
            ...unlocked.drop,
            commentsNumber
          }
        }
      };
    });
  }

  async toggleReaction(drop: SecretDrop, reaction: 'like' | 'dislike'): Promise<void> {
    if (!this.userService.hasJwt()) {
      this.userService.loginWithBackend(() => void this.toggleReaction(drop, reaction));
      return;
    }
    if (this.reactingUuid()) {
      return;
    }
    this.reactingUuid.set(drop.uuid);
    try {
      const state = await this.secretDropService.toggleReaction(drop.uuid, reaction);
      this.updateDropReactionState(drop, state.likes, state.dislikes);
    } catch {
      this.snackBar.open(this.translation.t('errors.unknown'), undefined, {
        duration: 3000,
        verticalPosition: 'top',
        panelClass: 'snack-error'
      });
    } finally {
      this.reactingUuid.set(null);
    }
  }

  private updateDropReactionState(drop: SecretDrop, likes: number, dislikes: number): void {
    drop.likes = likes;
    drop.dislikes = dislikes;
    this.unlocked.update((state) => {
      const unlocked = state[drop.uuid];
      if (!unlocked) {
        return state;
      }
      return {
        ...state,
        [drop.uuid]: {
          ...unlocked,
          drop: {
            ...unlocked.drop,
            likes,
            dislikes
          }
        }
      };
    });
  }

  private showTranslateError(error: unknown): void {
    const message = this.translateService.getErrorMessage(error)
      ?? this.translation.t('common.messageList.translateFailed');
    this.snackBar.open(message, undefined, {
      duration: 3000,
      verticalPosition: 'top',
      panelClass: 'snack-error'
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
          content,
          pin
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
