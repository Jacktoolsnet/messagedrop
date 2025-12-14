
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogActions,
  MatDialogContent,
  MatDialogModule,
  MatDialogRef,
  MatDialogTitle
} from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-legal-notice',
  standalone: true,
  imports: [
    MatDialogModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatProgressBarModule
  ],
  templateUrl: './legal-notice.component.html',
  styleUrls: ['./legal-notice.component.css']
})
export class LegalNoticeComponent {
  readonly url = new URL('assets/legal/legal-notice-de.txt', document.baseURI).toString();

  readonly text = signal<string>('');
  readonly loading = signal<boolean>(true);
  readonly error = signal<boolean>(false);

  private http = inject(HttpClient);
  private dialogRef = inject(MatDialogRef<LegalNoticeComponent>);

  constructor() { this.load(); }

  reload(): void { this.load(); }
  openInNewTab(): void { window.open(this.url, '_blank', 'noopener'); }

  download(): void {
    const blob = new Blob([this.text()], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = 'legal-notice.txt';
    a.click();
    URL.revokeObjectURL(objectUrl);
  }

  close(): void { this.dialogRef.close(); }

  private load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.http.get(this.url, { responseType: 'text' }).subscribe({
      next: (content) => { this.text.set(content ?? ''); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); }
    });
  }
}
