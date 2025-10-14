import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
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
  readonly primaryText: string;
  readonly secondaryText: string;

  constructor(
    private readonly dialogRef: MatDialogRef<DsaStatusLinkDialogComponent>,
    private readonly snack: MatSnackBar,
    @Inject(MAT_DIALOG_DATA) public data: DsaStatusLinkDialogData
  ) {
    this.primaryText = data.kind === 'signal'
      ? 'Your report was sent successfully.'
      : 'Your notice was submitted successfully.';

    if (data.kind === 'signal') {
      this.secondaryText = 'Keep the link below to follow up on the review progress at any time.';
    } else {
      const hasEmail = (data.reporterEmail || '').trim().length > 0;
      this.secondaryText = hasEmail
        ? 'We will also try to reach out via email when the review is complete. You can check the latest status using this link.'
        : 'If you want to keep track of the review, save this link. You can come back to it whenever you need the latest status.';
    }
  }

  async copy(): Promise<void> {
    const text = this.data.statusUrl || this.data.token;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      this.snack.open('Link copied to clipboard.', 'OK', { duration: 2500 });
    } catch (err) {
      this.copyFallback(text as string);
    }
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
    } catch (err) {
      this.snack.open('Could not copy the link automatically. Please copy it manually.', 'OK', { duration: 4000 });
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
