
import { HttpClient } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { HelpDialogService } from '../../utils/help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../../utils/dialog-header/dialog-header.component';

@Component({
  selector: 'app-legal-notice',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    MatDialogModule,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    TranslocoPipe
  ],
  templateUrl: './legal-notice.component.html',
  styleUrls: ['./legal-notice.component.css']
})
export class LegalNoticeComponent {
  readonly lang = signal<'de' | 'en'>('de');
  readonly url = computed(() => new URL(`assets/legal/legal-notice-${this.lang()}.txt`, document.baseURI).toString());

  readonly text = signal<string>('');
  readonly loading = signal<boolean>(true);
  readonly error = signal<boolean>(false);

  private http = inject(HttpClient);
  private dialogRef = inject(MatDialogRef<LegalNoticeComponent>);
  readonly help = inject(HelpDialogService);

  constructor() { this.load(); }

  setLanguage(lang: 'de' | 'en'): void {
    if (this.lang() === lang) return;
    this.lang.set(lang);
    this.load();
  }

  reload(): void { this.load(); }
  openInNewTab(): void { window.open(this.url(), '_blank', 'noopener'); }

  download(): void {
    const blob = new Blob([this.text()], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `legal-notice-${this.lang()}.txt`;
    a.click();
    URL.revokeObjectURL(objectUrl);
  }

  close(): void { this.dialogRef.close(); }

  private load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.http.get(this.url(), { responseType: 'text' }).subscribe({
      next: (content) => { this.text.set(content ?? ''); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); }
    });
  }
}
