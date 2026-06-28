import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom, finalize } from 'rxjs';
import { Profile } from '../../interfaces/profile';
import { SecretDrop, SecretDropComment, SecretDropCryptoMetadata, SecretDropDecryptedContent, SecretDropEncryptedPayload } from '../../interfaces/secret-drop';
import { ShortNumberPipe } from '../../pipes/short-number.pipe';
import { AppService } from '../../services/app.service';
import { DisplayMessageService } from '../../services/display-message.service';
import { LanguageService } from '../../services/language.service';
import { ProfileService } from '../../services/profile.service';
import { SecretDropCryptoService } from '../../services/secret-drop-crypto.service';
import { SecretDropService } from '../../services/secret-drop.service';
import { SpeechService } from '../../services/speech.service';
import { TranslateService } from '../../services/translate.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { MessageService } from '../../services/message.service';
import { ShowmessageComponent } from '../showmessage/showmessage.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { DisplayMessage } from '../utils/display-message/display-message.component';
import { EditSecretDropCommentComponent, SecretDropCommentEditResult } from '../edit-secret-drop-comment/edit-secret-drop-comment.component';

interface SecretDropCommentsDialogData {
  drop: SecretDrop;
  pin: string;
}

interface DecryptedComment {
  row: SecretDropComment;
  content: SecretDropDecryptedContent;
}

@Component({
  selector: 'app-secret-drop-comments-dialog',
  imports: [
    CommonModule,
    DatePipe,
    DialogHeaderComponent,
    MatBadgeModule,
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIconModule,
    ShortNumberPipe,
    ShowmessageComponent,
    ShowmultimediaComponent,
    TranslocoPipe
  ],
  templateUrl: './secret-drop-comments-dialog.component.html',
  styleUrl: './secret-drop-comments-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class SecretDropCommentsDialogComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<SecretDropCommentsDialogComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly data = inject<SecretDropCommentsDialogData>(MAT_DIALOG_DATA);
  private readonly secretDropService = inject(SecretDropService);
  private readonly cryptoService = inject(SecretDropCryptoService);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly translation = inject(TranslationHelperService);
  private readonly userService = inject(UserService);
  private readonly appService = inject(AppService);
  readonly languageService = inject(LanguageService);
  private readonly translateService = inject(TranslateService);
  private readonly speechService = inject(SpeechService);
  private readonly messageService = inject(MessageService);
  readonly profileService = inject(ProfileService);
  readonly userProfile: Profile = this.userService.getProfile();

  readonly loading = signal(false);
  readonly reactingUuid = signal<string | null>(null);
  readonly translatingUuid = signal<string | null>(null);
  readonly comments = signal<DecryptedComment[]>([]);
  readonly levelStack = signal<DecryptedComment[]>([]);

  async ngOnInit(): Promise<void> {
    await this.loadComments();
  }

  close(): void {
    this.dialogRef.close({ commentsNumber: this.topLevelCommentCount() });
  }

  topLevelCommentCount(): number {
    return this.comments().filter((comment) => !comment.row.parentCommentUuid).length;
  }

  currentParent(): DecryptedComment | null {
    const stack = this.levelStack();
    return stack.length ? stack[stack.length - 1] : null;
  }

  visibleComments(): DecryptedComment[] {
    const parentUuid = this.currentParent()?.row.uuid ?? null;
    return this.comments()
      .filter((comment) => (comment.row.parentCommentUuid ?? null) === parentUuid)
      .sort((a, b) => Number(a.row.createdAt || 0) - Number(b.row.createdAt || 0));
  }

  enterCommentLevel(comment: DecryptedComment): void {
    this.levelStack.update((stack) => [...stack, comment]);
  }

  goBack(): void {
    this.levelStack.update((stack) => stack.slice(0, -1));
  }

  isOwnComment(comment: SecretDropComment): boolean {
    return String(comment.userId) === String(this.userService.getUser().id);
  }

  getCommentProfileName(comment: SecretDropComment): string {
    if (this.isOwnComment(comment)) {
      return this.userProfile.name || this.translation.t('common.messageList.myself');
    }
    return this.profileService.getProfile(comment.userId)?.name || this.translation.t('common.messageList.nameFallback');
  }

  getCommentAvatar(comment: SecretDropComment): string {
    return this.isOwnComment(comment)
      ? this.userProfile.base64Avatar || ''
      : this.profileService.getProfile(comment.userId)?.base64Avatar || '';
  }

  getCommentText(comment: DecryptedComment): string {
    return comment.row.translatedMessage ?? comment.content.message ?? '';
  }

  async addComment(parentComment: DecryptedComment | null = this.currentParent()): Promise<void> {
    if (!this.userService.hasJwt()) {
      this.userService.loginWithBackend(() => void this.addComment(parentComment));
      return;
    }

    const dialogRef = this.dialog.open(EditSecretDropCommentComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { titleKey: parentComment ? 'common.secretDropComments.replyTitle' : 'common.secretDropComments.addTitle' },
      maxWidth: '95vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
    const result = await firstValueFrom(dialogRef.afterClosed()) as SecretDropCommentEditResult | undefined;
    if (!result || (!result.text?.trim() && !result.multimedia)) {
      return;
    }

    const moderationErrorKey = await this.getModerationErrorKey(result.text);
    if (moderationErrorKey) {
      this.showModerationRejected(moderationErrorKey);
      return;
    }

    this.loading.set(true);
    try {
      const encrypted = await this.cryptoService.encryptSecret(
        result.text.trim(),
        this.data.pin,
        result.multimedia ?? undefined,
        result.style ?? ''
      );
      const row = await this.secretDropService.addComment(this.data.drop.uuid, {
        encryptedPayload: encrypted.encryptedPayload,
        crypto: encrypted.crypto,
        parentCommentUuid: parentComment?.row.uuid ?? null
      });
      const content = await this.decryptComment(row);
      this.comments.update((comments) => [...comments, { row, content }]);
      if (parentComment) {
        this.patchCommentCounts(parentComment.row.uuid, Number(parentComment.row.commentsNumber ?? 0) + 1);
      } else {
        this.data.drop.commentsNumber = this.topLevelCommentCount();
      }
      this.snackBar.open(this.translation.t('common.secretDropComments.addSuccess'), undefined, {
        duration: 2500,
        verticalPosition: 'top',
        panelClass: 'snack-success'
      });
    } catch {
      this.snackBar.open(this.translation.t('common.secretDropComments.addFailed'), undefined, {
        duration: 3000,
        verticalPosition: 'top',
        panelClass: 'snack-error'
      });
    } finally {
      this.loading.set(false);
    }
  }

  async toggleReaction(comment: DecryptedComment, reaction: 'like' | 'dislike'): Promise<void> {
    if (!this.userService.hasJwt()) {
      this.userService.loginWithBackend(() => void this.toggleReaction(comment, reaction));
      return;
    }
    if (this.reactingUuid()) {
      return;
    }
    this.reactingUuid.set(comment.row.uuid);
    try {
      const state = await this.secretDropService.toggleCommentReaction(this.data.drop.uuid, comment.row.uuid, reaction);
      this.patchCommentReaction(comment.row.uuid, state.likes, state.dislikes);
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

  translateComment(comment: DecryptedComment): void {
    const text = String(comment.content.message ?? '').trim();
    if (!text || this.translatingUuid()) {
      return;
    }
    this.translatingUuid.set(comment.row.uuid);
    this.translateService.translate(text, this.languageService.effectiveLanguage(), false)
      .pipe(finalize(() => this.translatingUuid.set(null)))
      .subscribe({
        next: (response) => {
          const translated = response.result?.text?.trim();
          if (translated) {
            this.patchTranslatedComment(comment.row.uuid, translated);
          }
        },
        error: (error) => {
          const message = this.translateService.getErrorMessage(error)
            ?? this.translation.t('common.messageList.translateFailed');
          this.snackBar.open(message, undefined, { duration: 3000, verticalPosition: 'top', panelClass: 'snack-error' });
        }
      });
  }

  toggleReadAloud(comment: DecryptedComment): void {
    if (!this.speechService.supported()) {
      this.showReadAloudHint('common.messageList.readAloudUnsupported');
      return;
    }
    if (!this.appService.getAppSettings().speech?.enabled) {
      this.showReadAloudHint('common.messageList.readAloudDisabled');
      return;
    }
    const text = this.getCommentText(comment).trim();
    if (!text) {
      return;
    }
    this.speechService.toggle({
      targetId: this.getSpeechTargetId(comment),
      text,
      lang: comment.row.translatedMessage ? this.languageService.effectiveLanguage() : undefined
    });
  }

  getReadAloudIcon(comment: DecryptedComment): string {
    return this.speechService.isActive(this.getSpeechTargetId(comment)) ? 'stop' : 'volume_up';
  }

  getReadAloudLabel(comment: DecryptedComment): string {
    return this.translation.t(
      this.speechService.isActive(this.getSpeechTargetId(comment))
        ? 'common.messageList.stopReadAloud'
        : 'common.messageList.readAloud'
    );
  }

  private getSpeechTargetId(comment: DecryptedComment): string {
    return `secret-drop-comment:${comment.row.uuid}`;
  }

  private patchCommentReaction(uuid: string, likes: number, dislikes: number): void {
    this.comments.update((comments) => comments.map((comment) => comment.row.uuid === uuid
      ? { ...comment, row: { ...comment.row, likes, dislikes } }
      : comment));
  }

  private patchCommentCounts(uuid: string, commentsNumber: number): void {
    this.comments.update((comments) => comments.map((comment) => comment.row.uuid === uuid
      ? { ...comment, row: { ...comment.row, commentsNumber } }
      : comment));
  }

  private patchTranslatedComment(uuid: string, translatedMessage: string): void {
    this.comments.update((comments) => comments.map((comment) => comment.row.uuid === uuid
      ? { ...comment, row: { ...comment.row, translatedMessage } }
      : comment));
  }


  private async getModerationErrorKey(text: string): Promise<string | null> {
    const moderationInput = String(text ?? '').trim();
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
      if ((response?.moderation?.decision ?? 'approved') === 'rejected') {
        return response?.moderation?.reason === 'pattern'
          ? 'common.message.moderationRejectedPattern'
          : 'common.message.moderationRejectedAi';
      }
      return null;
    } catch {
      return 'common.message.moderationFailed';
    }
  }

  private detectThreateningOrAbusiveContent(text: string): boolean {
    const normalized = String(text ?? '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return [
      /\bich\s+bring(?:e)?\s+(?:dich|dir|ihn|sie|euch|deine|deinen|deiner)\s+(?:um|umbringen)\b/i,
      /\b(?:ich\s+)?(?:mach(?:e)?|mache)\s+(?:dich|ihn|sie|euch)\s+fertig\b/i,
      /\b(?:ich\s+)?(?:toete|tote|kill(?:e)?|ermorde)\s+(?:dich|ihn|sie|euch)\b/i,
      /\bdrecks(?:schlampe|hure|fotze)\b/i
    ].some((pattern) => pattern.test(normalized));
  }

  private showModerationRejected(messageKey: string): void {
    this.dialog.open(DisplayMessage, {
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

  private async loadComments(): Promise<void> {
    this.loading.set(true);
    try {
      const rows = await this.secretDropService.getComments(this.data.drop.uuid);
      const decrypted: DecryptedComment[] = [];
      for (const row of rows) {
        try {
          decrypted.push({ row, content: await this.decryptComment(row) });
        } catch {
          // Ignore comments that cannot be decrypted with the current PIN.
        }
      }
      this.comments.set(decrypted);
      this.data.drop.commentsNumber = this.topLevelCommentCount();
    } catch {
      this.snackBar.open(this.translation.t('common.secretDropComments.loadFailed'), undefined, {
        duration: 3000,
        verticalPosition: 'top',
        panelClass: 'snack-error'
      });
    } finally {
      this.loading.set(false);
    }
  }

  private decryptComment(row: SecretDropComment): Promise<SecretDropDecryptedContent> {
    const encryptedPayload = this.asEncryptedPayload(row.encryptedPayload);
    const cryptoMetadata = this.asCryptoMetadata(row.crypto);
    if (!encryptedPayload || !cryptoMetadata) {
      throw new Error('invalid_comment_payload');
    }
    return this.cryptoService.decryptSecret(encryptedPayload, cryptoMetadata, this.data.pin);
  }

  private showReadAloudHint(messageKey: string): void {
    this.dialog.open(DisplayMessage, {
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

  private asCryptoMetadata(value: unknown): SecretDropCryptoMetadata | null {
    const candidate = typeof value === 'string' ? this.parseJson(value) : value;
    if (!candidate || typeof candidate !== 'object') {
      return null;
    }
    const metadata = candidate as SecretDropCryptoMetadata;
    return metadata.salt && metadata.iv ? metadata : null;
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
