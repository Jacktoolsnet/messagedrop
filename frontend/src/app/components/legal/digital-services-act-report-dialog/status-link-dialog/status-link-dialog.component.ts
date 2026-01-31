
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe } from '@jsverse/transloco';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { HelpDialogService } from '../../../utils/help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';

export type DsaStatusKind = 'signal' | 'notice';

export interface DsaStatusLinkDialogData {
  kind: DsaStatusKind;
  statusUrl: string | null;
  token: string | null;
  reporterEmail?: string | null;
}

@Component({
  selector: 'app-dsa-status-link-dialog',
  standalone: true,
  imports: [
    DialogHeaderComponent,MatDialogModule, MatButtonModule, MatIconModule, MatTooltipModule, TranslocoPipe],
  templateUrl: './status-link-dialog.component.html',
  styleUrl: './status-link-dialog.component.css'
})
export class DsaStatusLinkDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<DsaStatusLinkDialogComponent>);
  private readonly snack = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  readonly data = inject<DsaStatusLinkDialogData>(MAT_DIALOG_DATA);

  readonly primaryText = this.data.kind === 'signal'
    ? this.translation.t('dsa.status.primarySignal')
    : this.translation.t('dsa.status.primaryNotice');

  readonly secondaryText = this.data.kind === 'signal'
    ? this.translation.t('dsa.status.secondarySignal')
    : (this.data.reporterEmail || '').trim().length > 0
      ? this.translation.t('dsa.status.secondaryNoticeEmail')
      : this.translation.t('dsa.status.secondaryNotice');

  async copy(): Promise<void> {
    const text = this.data.statusUrl || this.data.token;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      this.snack.open(
        this.translation.t('dsa.status.copySuccess'),
        this.translation.t('common.actions.ok'),
        { duration: 2500 }
      );
    } catch {
      this.copyFallback(text as string);
    }
  }

  openInBrowser(): void {
    const url = this.data.statusUrl;
    if (!url) {
      return;
    }
    window.open(url, '_blank', 'noopener');
  }

  close(): void {
    this.dialogRef.close(true);
  }

  private copyFallback(text: string): void {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      this.snack.open(
        this.translation.t('dsa.status.copySuccess'),
        this.translation.t('common.actions.ok'),
        { duration: 2500 }
      );
    } catch {
      this.snack.open(
        this.translation.t('dsa.status.copyFailed'),
        this.translation.t('common.actions.ok'),
        { duration: 4000 }
      );
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
