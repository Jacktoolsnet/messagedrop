import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DisplayMessageConfig } from '../../../interfaces/display-message-config.interface';
import { TranslationHelperService } from '../../../services/translation-helper.service';

@Component({
  selector: 'app-display-message',
  imports: [
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIcon
  ],
  templateUrl: './display-message.component.html',
  styleUrl: './display-message.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DisplayMessageComponent implements OnInit, OnDestroy {
  readonly showOk = signal(false);
  readonly closing = signal(false);

  readonly dialogRef = inject(MatDialogRef<DisplayMessageComponent>);
  readonly data = inject<DisplayMessageConfig>(MAT_DIALOG_DATA);
  readonly i18n = inject(TranslationHelperService);
  readonly hasActions = !!this.data.button || !!this.data.secondaryButton;
  readonly toastRole = this.hasActions ? 'dialog' : 'status';
  readonly toastLive = this.hasActions ? 'polite' : 'assertive';

  private readonly closeAnimationMs = 180;
  private showButtonTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private closeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private finalizeCloseTimeoutId: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    const delay = Math.max(0, this.data.delay ?? 0);
    if (this.data.autoclose) {
      this.closeTimeoutId = setTimeout(() => {
        this.close();
      }, delay);
    }

    if (!this.hasActions) {
      return;
    }

    if (this.data.autoclose || delay === 0) {
      this.showOk.set(true);
      return;
    }

    this.showButtonTimeoutId = setTimeout(() => {
      this.showOk.set(true);
    }, delay);
  }

  onPrimaryClick(): void {
    this.close(true);
  }

  onSecondaryClick(): void {
    this.close('secondary');
  }

  onDismiss(): void {
    this.close();
  }

  private close(result?: boolean | 'secondary'): void {
    if (this.closing()) {
      return;
    }

    if (this.closeTimeoutId) {
      clearTimeout(this.closeTimeoutId);
      this.closeTimeoutId = null;
    }

    this.closing.set(true);
    this.finalizeCloseTimeoutId = setTimeout(() => {
      this.dialogRef.close(result);
    }, this.closeAnimationMs);
  }

  ngOnDestroy(): void {
    if (this.showButtonTimeoutId) {
      clearTimeout(this.showButtonTimeoutId);
    }
    if (this.closeTimeoutId) {
      clearTimeout(this.closeTimeoutId);
    }
    if (this.finalizeCloseTimeoutId) {
      clearTimeout(this.finalizeCloseTimeoutId);
    }
  }
}
