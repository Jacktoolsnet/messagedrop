import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { SecretDrop, SecretDropComment, SecretDropCryptoMetadata, SecretDropDecryptedContent, SecretDropEncryptedPayload } from '../../interfaces/secret-drop';
import { SecretDropCryptoService } from '../../services/secret-drop-crypto.service';
import { SecretDropService } from '../../services/secret-drop.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { ShowmessageComponent } from '../showmessage/showmessage.component';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { DisplayMessageService } from '../../services/display-message.service';
import { TextComponent } from '../utils/text/text.component';

interface SecretDropCommentsDialogData {
  drop: SecretDrop;
  pin: string;
}

interface TextDialogResult {
  text: string;
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
    MatButtonModule,
    MatDialogActions,
    MatDialogContent,
    MatIconModule,
    ShowmessageComponent,
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

  readonly loading = signal(false);
  readonly comments = signal<DecryptedComment[]>([]);

  async ngOnInit(): Promise<void> {
    await this.loadComments();
  }

  close(): void {
    this.dialogRef.close({ commentsNumber: this.comments().length });
  }

  async addComment(): Promise<void> {
    if (!this.userService.hasJwt()) {
      this.userService.loginWithBackend(() => void this.addComment());
      return;
    }

    const dialogRef = this.dialog.open(TextComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: {
        text: '',
        titleKey: 'common.secretDropComments.addTitle',
        titleIcon: 'add_comment'
      },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: true
    });
    const result = await firstValueFrom(dialogRef.afterClosed()) as TextDialogResult | undefined;
    const text = String(result?.text ?? '').trim();
    if (!text) {
      return;
    }

    this.loading.set(true);
    try {
      const encrypted = await this.cryptoService.encryptSecret(
        text,
        this.data.pin,
        undefined,
        this.userService.getProfile().defaultStyle ?? ''
      );
      const row = await this.secretDropService.addComment(this.data.drop.uuid, {
        encryptedPayload: encrypted.encryptedPayload,
        crypto: encrypted.crypto
      });
      const content = await this.decryptComment(row);
      this.comments.update((comments) => [...comments, { row, content }]);
      this.data.drop.commentsNumber = this.comments().length;
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
      this.data.drop.commentsNumber = decrypted.length;
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
