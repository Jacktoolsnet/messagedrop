
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppService } from '../../../services/app.service';

@Component({
  selector: 'app-disclaimer',
  standalone: true,
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatSlideToggleModule,
    MatProgressBarModule,
    TranslocoPipe
  ],
  templateUrl: './disclaimer.component.html',
  styleUrls: ['./disclaimer.component.css']
})
export class DisclaimerComponent implements OnInit {
  accepted = false;
  readonly lang = signal<'de' | 'en'>('de');
  readonly url = computed(() => new URL(`assets/legal/disclaimer-${this.lang()}.txt`, document.baseURI).toString());

  readonly text = signal<string>('');
  readonly loading = signal<boolean>(true);
  readonly error = signal<boolean>(false);

  private http = inject(HttpClient);
  private dialogRef = inject(MatDialogRef<DisclaimerComponent>);
  private appService = inject(AppService);

  constructor() { this.load(); }

  onToggle(val: boolean) {
    const current = this.appService.getAppSettings();
    current.consentSettings.disclaimer = val;
    current.acceptedLegalVersion = val ? this.appService.getLegalVersion() : undefined;
    this.appService.setAppSettings(current);
    this.dialogRef.close(val);
  }

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
    a.download = `disclaimer-${this.lang()}.txt`;
    a.click();
    URL.revokeObjectURL(objectUrl);
  }

  ngOnInit(): void {
    // falls bereits zugestimmt wurde, Toggle vorbefüllen
    const settings = this.appService.getAppSettings();
    this.accepted = !!settings?.consentSettings?.disclaimer;
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
