
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { AppService } from '../../../services/app.service';

@Component({
  selector: 'app-terms-of-service',
  standalone: true,
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatSlideToggleModule,
    MatProgressBarModule
  ],
  templateUrl: './terms-of-service.component.html',
  styleUrls: ['./terms-of-service.component.css']
})
export class TermsOfServiceComponent implements OnInit {
  accepted = false;
  readonly lang = signal<'de' | 'en'>('de');
  readonly url = computed(() => new URL(`assets/legal/terms-of-service-${this.lang()}.txt`, document.baseURI).toString());

  readonly text = signal<string>('');
  readonly loading = signal<boolean>(true);
  readonly error = signal<boolean>(false);

  private http = inject(HttpClient);
  private dialogRef = inject(MatDialogRef<TermsOfServiceComponent>);
  private appService = inject(AppService);

  constructor() { this.load(); }

  ngOnInit(): void {
    // falls bereits zugestimmt wurde, Toggle vorbefüllen
    const settings = this.appService.getAppSettings();
    this.accepted = !!settings?.consentSettings?.termsOfService;
  }

  onToggle(val: boolean) {
    const current = this.appService.getAppSettings();
    current.consentSettings.termsOfService = val;
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
    a.download = `terms-of-service-${this.lang()}.txt`;
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
