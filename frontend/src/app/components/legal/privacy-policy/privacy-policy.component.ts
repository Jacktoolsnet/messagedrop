
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogActions, MatDialogContent, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppService } from '../../../services/app.service';

@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatProgressBarModule,
    TranslocoPipe
  ],
  templateUrl: './privacy-policy.component.html',
  styleUrls: ['./privacy-policy.component.css']
})
export class PrivacyPolicyComponent implements OnInit {
  accepted = false;
  readonly lang = signal<'de' | 'en'>('de');
  readonly url = computed(() => new URL(`assets/legal/privacy-policy-${this.lang()}.txt`, document.baseURI).toString());

  readonly text = signal<string>('');
  readonly loading = signal<boolean>(true);
  readonly error = signal<boolean>(false);

  private http = inject(HttpClient);
  private dialogRef = inject(MatDialogRef<PrivacyPolicyComponent>);
  private appService = inject(AppService);

  constructor() { this.load(); }

  ngOnInit(): void {
    // falls bereits zugestimmt wurde, Toggle vorbefüllen
    const settings = this.appService.getAppSettings();
    this.accepted = !!settings?.consentSettings?.privacyPolicy;
  }

  onToggle(val: boolean) {
    const current = this.appService.getAppSettings();
    current.consentSettings.privacyPolicy = val;
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
    a.download = `privacy-policy-${this.lang()}.txt`;
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
