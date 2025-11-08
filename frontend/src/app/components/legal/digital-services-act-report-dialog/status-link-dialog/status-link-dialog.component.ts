import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

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
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './status-link-dialog.component.html',
  styleUrl: './status-link-dialog.component.css'
})
export class DsaStatusLinkDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<DsaStatusLinkDialogComponent>);
  private readonly snack = inject(MatSnackBar);
  readonly data = inject<DsaStatusLinkDialogData>(MAT_DIALOG_DATA);

  readonly primaryText = this.data.kind === 'signal'
    ? 'Your report was sent successfully.'
    : 'Your notice was submitted successfully.';

  readonly secondaryText = this.data.kind === 'signal'
    ? 'Keep the link below to follow up on the review progress at any time.'
    : (this.data.reporterEmail || '').trim().length > 0
      ? 'We will also try to reach out via email when the review is complete. You can check the latest status using this link.'
      : 'If you want to keep track of the review, save this link. You can come back to it whenever you need the latest status.';

  async copy(): Promise<void> {
    const text = this.data.statusUrl || this.data.token;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      this.snack.open('Link copied to clipboard.', 'OK', { duration: 2500 });
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
      this.snack.open('Link copied to clipboard.', 'OK', { duration: 2500 });
    } catch {
      this.snack.open('Could not copy the link automatically. Please copy it manually.', 'OK', { duration: 4000 });
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
