import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ShortNumberPipe } from '../../pipes/short-number.pipe';
import { Location } from '../../interfaces/location';
import { SecretDrop, SecretDropCreateRequest } from '../../interfaces/secret-drop';
import { SecretDropCryptoService } from '../../services/secret-drop-crypto.service';
import { SecretDropService } from '../../services/secret-drop.service';
import { MessageService } from '../../services/message.service';
import { DisplayMessageService } from '../../services/display-message.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { DisplayMessage } from '../utils/display-message/display-message.component';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';
import { HelpDialogService } from '../utils/help-dialog/help-dialog.service';
import { EditSecretDropComponent } from '../edit-secret-drop/edit-secret-drop.component';
import { DeleteMessageComponent } from '../messagelist/delete-message/delete-message.component';
import { ShowmessageComponent } from '../showmessage/showmessage.component';
import { ShowmultimediaComponent } from '../multimedia/showmultimedia/showmultimedia.component';
import { CreatePinComponent } from '../pin/create-pin/create-pin.component';

@Component({
  selector: 'app-my-secret-drop-list',
  imports: [
    CommonModule,
    DatePipe,
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
  templateUrl: './my-secret-drop-list.component.html',
  styleUrl: './my-secret-drop-list.component.css',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class MySecretDropListComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<MySecretDropListComponent>);
  private readonly data = inject<{ location: Location }>(MAT_DIALOG_DATA);
  private readonly matDialog = inject(MatDialog);
  private readonly cryptoService = inject(SecretDropCryptoService);
  private readonly secretDropService = inject(SecretDropService);
  private readonly messageService = inject(MessageService);
  private readonly userService = inject(UserService);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);

  readonly loading = signal(false);
  readonly secretDrops = this.secretDropService.mySecretDropsSignal;

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    if (!this.userService.hasJwt()) {
      return;
    }
    this.loading.set(true);
    try {
      await this.secretDropService.loadMySecretDrops(this.userService.getUser().id);
    } finally {
      this.loading.set(false);
    }
  }

  async deleteDrop(drop: SecretDrop): Promise<void> {
    const confirmed = await this.confirmDelete();
    if (!confirmed) {
      return;
    }
    if (drop.localOnly) {
      await this.secretDropService.removeLocalSecretDrop(this.userService.getUser().id, drop.uuid);
      this.snackBar.open(this.translation.t('common.secretDrop.deleteSuccess'), undefined, {
        duration: 3200,
        verticalPosition: 'top',
        panelClass: 'snack-success'
      });
      return;
    }
    const deleted = await this.secretDropService.deleteSecretDrop(drop.uuid);
    this.snackBar.open(
      this.translation.t(deleted ? 'common.secretDrop.deleteSuccess' : 'common.secretDrop.deleteFailed'),
      undefined,
      {
        duration: 3200,
        verticalPosition: 'top',
        panelClass: deleted ? 'snack-success' : 'snack-error'
      }
    );
  }

  editDrop(drop: SecretDrop): void {
    const dialogRef = this.matDialog.open(EditSecretDropComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { location: drop.location, secretDrop: drop },
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
        void this.reload();
      }
    });
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

  async publishDrop(drop: SecretDrop): Promise<void> {
    try {
      if (drop.localOnly) {
        await this.publishLocalDraft(drop);
        return;
      }
      await this.secretDropService.publishSecretDrop(drop.uuid);
      this.snackBar.open(this.translation.t('common.secretDrop.publishSuccess'), undefined, {
        duration: 2600,
        verticalPosition: 'top',
        panelClass: 'snack-success'
      });
    } catch (error) {
      if (error instanceof Error && (error.message === 'moderation_rejected' || error.message === 'moderation_rejected_pattern')) {
        this.showModerationRejected(
          error.message === 'moderation_rejected_pattern'
            ? 'common.message.moderationRejectedPattern'
            : 'common.message.moderationRejectedAi'
        );
        return;
      }
      this.snackBar.open(this.translation.t('common.secretDrop.publishFailed'), undefined, {
        duration: 3200,
        verticalPosition: 'top',
        panelClass: 'snack-error'
      });
    }
  }

  async unpublishDrop(drop: SecretDrop): Promise<void> {
    try {
      await this.secretDropService.unpublishSecretDrop(drop.uuid);
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

  close(): void {
    this.dialogRef.close();
  }

  async addSecretDropDialog(): Promise<void> {
    if (!this.userService.hasJwt()) {
      return;
    }
    const dialogRef = this.matDialog.open(EditSecretDropComponent, {
      panelClass: '',
      closeOnNavigation: true,
      data: { location: this.data.location },
      minWidth: 'min(450px, 95vw)',
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe((created?: boolean) => {
      if (created) {
        void this.reload();
      }
    });
  }

  getStatusKey(drop: SecretDrop): string {
    const now = Math.floor(Date.now() / 1000);
    if (drop.publishState === 'draft' || drop.localOnly) return 'common.secretDrop.status.draft';
    if (drop.status === 'consumed') return 'common.secretDrop.status.consumed';
    if (drop.status === 'deleted') return 'common.secretDrop.status.deleted';
    if (drop.validFrom && drop.validFrom > now) return 'common.secretDrop.status.pending';
    if (drop.validUntil && drop.validUntil < now) return 'common.secretDrop.status.expired';
    if (drop.status === 'enabled') return 'common.secretDrop.status.active';
    return 'common.secretDrop.status.disabled';
  }

  canPublishDrop(drop: SecretDrop): boolean {
    return drop.status === 'disabled' || drop.publishState === 'draft' || !!drop.localOnly;
  }

  canUnpublishDrop(drop: SecretDrop): boolean {
    return drop.status === 'enabled';
  }

  getStatusBadgeClass(drop: SecretDrop): string {
    const key = this.getStatusKey(drop).split('.').pop() || 'disabled';
    return `publish-state-badge publish-state-${key}`;
  }

  private async publishLocalDraft(drop: SecretDrop): Promise<void> {
    const userId = this.userService.getUser().id;
    const moderationInput = [drop.message, drop.hint].map((value) => String(value ?? '').trim()).filter(Boolean).join('\n\n');
    if (this.messageService.detectPersonalInformation(moderationInput)) {
      throw new Error('moderation_rejected_pattern');
    }
    if (this.detectThreateningOrAbusiveContent(moderationInput)) {
      throw new Error('moderation_rejected');
    }
    const response = await firstValueFrom(this.messageService.moderatePublicContent(moderationInput));
    if ((response?.moderation?.decision ?? 'approved') === 'rejected') {
      throw new Error(response?.moderation?.reason === 'pattern' ? 'moderation_rejected_pattern' : 'moderation_rejected');
    }
    const pin = await this.openPinDialog();
    if (!pin) {
      return;
    }
    const encrypted = await this.cryptoService.encryptSecret(
      String(drop.message ?? '').trim(),
      pin,
      drop.multimedia ?? undefined,
      drop.messageStyle ?? ''
    );
    const request: SecretDropCreateRequest = {
      userId,
      latitude: drop.location.latitude,
      longitude: drop.location.longitude,
      plusCode: drop.plusCode,
      discoveryPlusCode: drop.discoveryPlusCode || drop.plusCode,
      hint: drop.hint ?? '',
      hintStyle: drop.hintStyle ?? '',
      encryptedPayload: encrypted.encryptedPayload,
      crypto: encrypted.crypto,
      authVerifier: encrypted.authVerifier,
      maxUnlocks: drop.maxUnlocks,
      validFrom: drop.validFrom,
      validUntil: drop.validUntil,
      publishState: 'published'
    };
    await this.secretDropService.createSecretDrop(request, {
      message: drop.message,
      messageStyle: drop.messageStyle,
      multimedia: drop.multimedia ?? null
    });
    await this.secretDropService.removeLocalSecretDrop(userId, drop.uuid);
    this.snackBar.open(this.translation.t('common.secretDrop.publishSuccess'), undefined, {
      duration: 2600,
      verticalPosition: 'top',
      panelClass: 'snack-success'
    });
  }

  private async openPinDialog(): Promise<string | null> {
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
    return (await firstValueFrom(dialogRef.afterClosed())) ?? null;
  }

  private showModerationRejected(messageKey: string): void {
    this.matDialog.open(DisplayMessage, {
      panelClass: '',
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.translation.t('common.moderation.title'),
        image: '',
        icon: 'block',
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
}
