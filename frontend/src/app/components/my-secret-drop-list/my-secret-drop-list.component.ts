import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogActions, MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { SecretDrop } from '../../interfaces/secret-drop';
import { SecretDropService } from '../../services/secret-drop.service';
import { DisplayMessageService } from '../../services/display-message.service';
import { TranslationHelperService } from '../../services/translation-helper.service';
import { UserService } from '../../services/user.service';
import { DialogHeaderComponent } from '../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-my-secret-drop-list',
  imports: [
    CommonModule,
    DatePipe,
    DialogHeaderComponent,
    MatButtonModule,
    MatCardModule,
    MatDialogActions,
    MatDialogContent,
    MatIconModule,
    TranslocoPipe
  ],
  templateUrl: './my-secret-drop-list.component.html',
  styleUrl: './my-secret-drop-list.component.css',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class MySecretDropListComponent implements OnInit {
  private readonly dialogRef = inject(MatDialogRef<MySecretDropListComponent>);
  private readonly secretDropService = inject(SecretDropService);
  private readonly userService = inject(UserService);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly translation = inject(TranslationHelperService);

  readonly loading = signal(false);
  readonly secretDrops = this.secretDropService.mySecretDropsSignal;
  readonly activeCount = computed(() => this.secretDrops().filter((drop) => drop.status === 'enabled').length);

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
    const confirmed = window.confirm(this.translation.t('common.secretDrop.deleteConfirm'));
    if (!confirmed) {
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

  close(): void {
    this.dialogRef.close();
  }

  getStatusKey(drop: SecretDrop): string {
    const now = Math.floor(Date.now() / 1000);
    if (drop.status === 'consumed') return 'common.secretDrop.status.consumed';
    if (drop.status === 'deleted') return 'common.secretDrop.status.deleted';
    if (drop.validFrom && drop.validFrom > now) return 'common.secretDrop.status.pending';
    if (drop.validUntil && drop.validUntil < now) return 'common.secretDrop.status.expired';
    if (drop.status === 'enabled') return 'common.secretDrop.status.active';
    return 'common.secretDrop.status.disabled';
  }

  getUnlockLabel(drop: SecretDrop): string {
    return drop.maxUnlocks === null
      ? `${drop.unlockCount} / ∞`
      : `${drop.unlockCount} / ${drop.maxUnlocks}`;
  }
}
