
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { HelpDialogService } from '../../utils/help-dialog/help-dialog.service';

@Component({
  selector: 'app-third-party-licenses-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatProgressBarModule, TranslocoPipe],
  templateUrl: './third-party-licenses.component.html',
  styleUrls: ['./third-party-licenses.component.css']
})
export class ThirdPartyLicensesComponent {
  private http = inject(HttpClient);
  private dialogRef = inject(MatDialogRef<ThirdPartyLicensesComponent>);
  readonly help = inject(HelpDialogService);

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
