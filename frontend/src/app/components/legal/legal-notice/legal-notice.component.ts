
import { HttpClient } from '@angular/common/http';
import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AppService } from '../../../services/app.service';
import { SpeechService } from '../../../services/speech.service';
import { DisplayMessage } from '../../utils/display-message/display-message.component';
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
export class LegalNoticeComponent implements OnDestroy {
  readonly lang = signal<'de' | 'en'>('de');
  readonly url = computed(() => new URL(`assets/legal/legal-notice-${this.lang()}.txt`, document.baseURI).toString());
  private readonly speechTargetId = 'legal:legal-notice';

  readonly text = signal<string>('');
  readonly loading = signal<boolean>(true);
  readonly error = signal<boolean>(false);

  private http = inject(HttpClient);
  private dialog = inject(MatDialog);
  private dialogRef = inject(MatDialogRef<LegalNoticeComponent>);
  private appService = inject(AppService);
  private speechService = inject(SpeechService);
  private translation = inject(TranslocoService);
  readonly help = inject(HelpDialogService);

  constructor() { this.load(); }

  ngOnDestroy(): void {
    this.stopReadAloud();
  }

  setLanguage(lang: 'de' | 'en'): void {
    if (this.lang() === lang) return;
    this.stopReadAloud();
    this.lang.set(lang);
    this.load();
  }

  reload(): void {
    this.stopReadAloud();
    this.load();
  }
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

  toggleReadAloud(): void {
    if (!this.speechService.supported()) {
      this.showReadAloudHint('common.speech.unsupported');
      return;
    }

    if (!this.appService.getAppSettings().speech?.enabled) {
      this.showReadAloudHint('common.speech.disabled');
      return;
    }

    const content = this.text().trim();
    if (!content) {
      return;
    }

    this.speechService.toggle({
      targetId: this.speechTargetId,
      text: content,
      lang: this.lang()
    });
  }

  isReadAloudActive(): boolean {
    return this.speechService.isActive(this.speechTargetId);
  }

  getReadAloudIcon(): string {
    return this.isReadAloudActive() ? 'stop' : 'volume_up';
  }

  getReadAloudLabel(): string {
    return this.translation.translate(
      this.isReadAloudActive()
        ? 'common.actions.stopReadAloud'
        : 'common.actions.readAloud'
    );
  }

  close(): void {
    this.stopReadAloud();
    this.dialogRef.close();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.http.get(this.url(), { responseType: 'text' }).subscribe({
      next: (content) => { this.text.set(content ?? ''); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); }
    });
  }

  private stopReadAloud(): void {
    this.speechService.stopIfCurrentTarget(this.speechTargetId);
  }

  private showReadAloudHint(messageKey: string): void {
    this.dialog.open(DisplayMessage, {
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: this.translation.translate('common.actions.readAloud'),
        image: '',
        icon: 'record_voice_over',
        message: this.translation.translate(messageKey),
        button: this.translation.translate('common.actions.ok'),
        delay: 0,
        showSpinner: false,
        autoclose: false
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
      autoFocus: false
    });
  }
}
