import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-third-party-licenses-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatProgressBarModule],
  templateUrl: './third-party-licenses.component.html',
  styleUrls: ['./third-party-licenses.component.css']
})
export class ThirdPartyLicensesComponent {
  private http = inject(HttpClient);
  private dialogRef = inject(MatDialogRef<ThirdPartyLicensesComponent>);

  // robust against sub-path hosting
  readonly url = new URL('assets/legal/3rdpartylicenses.txt', document.baseURI).toString();

  readonly text = signal<string>('');
  readonly loading = signal<boolean>(true);
  readonly error = signal<boolean>(false);

  constructor() { this.load(); }

  private load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.http.get(this.url, { responseType: 'text' }).subscribe({
      next: (content) => { this.text.set(content ?? ''); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); }
    });
  }

  reload(): void { this.load(); }
  openInNewTab(): void { window.open(this.url, '_blank', 'noopener'); }

  download(): void {
    const blob = new Blob([this.text()], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = '3rdpartylicenses.txt';
    a.click();
    URL.revokeObjectURL(objectUrl);
  }

  close(): void { this.dialogRef.close(); }
}