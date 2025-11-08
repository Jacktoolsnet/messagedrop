import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { EvidenceFileItem, EvidenceInputComponent, EvidenceUrlItem } from '../../utils/evidence-input/evidence-input.component';

import { firstValueFrom } from 'rxjs';
import { DsaNoticeCategory } from '../../../interfaces/dsa-notice-category.interface';
import { Message } from '../../../interfaces/message';
import { DigitalServicesActService, DsaSubmissionResponse } from '../../../services/digital-services-act.service';
import { DisplayMessage } from '../../utils/display-message/display-message.component';
import { DsaStatusLinkDialogComponent } from './status-link-dialog/status-link-dialog.component';

interface DigitalServicesActReportDialogData {
  message?: Partial<Message> | null;
  contentUrl?: string;
  reporterEmail?: string;
  reporterName?: string;
}

@Component({
  selector: 'app-digital-services-act-report-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatTabsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    EvidenceInputComponent
  ],
  templateUrl: './digital-services-act-report-dialog.component.html',
  styleUrls: ['./digital-services-act-report-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DigitalServicesActReportDialogComponent {

  private readonly dialogRef = inject(MatDialogRef<DigitalServicesActReportDialogComponent, { created: boolean }>);
  private readonly dialogData = inject<DigitalServicesActReportDialogData>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);
  private readonly dsa = inject(DigitalServicesActService);
  private readonly matDialog = inject(MatDialog);
  readonly data = this.dialogData;

  // Content-ID robust aus der Message ziehen
  private readonly contentIdSig = signal<string>(
    String(this.data?.message?.uuid ?? this.data?.message?.id ?? '')
  );

  readonly formalForm = this.fb.group({
    contentId: [{ value: this.contentIdSig(), disabled: true }],
    category: ['' as '' | DsaNoticeCategory],
    reasonText: [''],
    reporterEmail: ['', [Validators.email, Validators.maxLength(254)]], // <- optional + valid
    reporterName: [''],
    truthAffirmation: [false]
  });

  get formalEmailCtrl() {
    return this.formalForm.get('reporterEmail') as FormControl;
  }

  get isFormalEmailInvalid(): boolean {
    const v = (this.formalEmailCtrl?.value || '').trim();
    return !!v && this.formalEmailCtrl?.invalid === true;
  }

  readonly categories: { value: DsaNoticeCategory; label: string }[] = [
    { value: 'privacy', label: 'Privacy / personal data' },
    { value: 'hate', label: 'Hate speech / incitement' },
    { value: 'copyright', label: 'Copyright / IP infringement' },
    { value: 'terror', label: 'Terrorism content' },
    { value: 'other', label: 'Other illegal content' }
  ];

  /** Quick report – alles optional */
  readonly quickForm = this.fb.group({
    // contentId nur anzeigen (Backend kennt die echte ID ohnehin)
    contentId: [{ value: this.contentIdSig(), disabled: true }],
    category: ['' as '' | DsaNoticeCategory],
    reasonText: ['']
  });

  submitting = false;
  errorMsg = '';
  activeTabIndex = 0; // 0 = Quick, 1 = Formal

  // Evidence tab state
  readonly maxEvidenceBytes = 5 * 1024 * 1024;
  evidenceItems = signal<{ id: string; type: 'file' | 'url'; file?: File; url?: string }[]>([]);

  // Separate views like in the appeal UI
  readonly evidenceUrlViews = computed<readonly EvidenceUrlItem[]>(() =>
    this.evidenceItems()
      .filter(e => e.type === 'url' && !!e.url)
      .map(e => ({
        id: e.id,
        label: e.url ?? '',
        tooltip: e.url ?? ''
      }))
  );

  readonly evidenceFileViews = computed<readonly EvidenceFileItem[]>(() =>
    this.evidenceItems()
      .filter(e => e.type === 'file' && !!e.file)
      .map(e => ({
        id: e.id,
        label: e.file ? `${e.file.name} · ${this.formatBytes(e.file.size)}` : 'File',
        tooltip: e.file ? `${e.file.name} · ${this.formatBytes(e.file.size)}` : undefined
      }))
  );

  evidenceFilesSizeLabel(): string {
    const total = this.evidenceItems()
      .filter(e => e.type === 'file' && !!e.file)
      .reduce((sum, item) => sum + (item.file?.size ?? 0), 0);
    return this.formatBytes(total);
  }

  removeEvidenceById(id: string): void {
    const arr = this.evidenceItems().filter(e => e.id !== id);
    this.evidenceItems.set(arr);
  }

  addEvidenceUrlFromInput(url: string): void {
    const normalized = this.normalizeUrl(url);
    if (!normalized) return;
    const exists = this.evidenceItems().some(e => e.type === 'url' && (e.url || '').toLowerCase() === normalized.toLowerCase());
    if (exists) return;
    this.evidenceItems.update(arr => [...arr, { id: crypto.randomUUID(), type: 'url', url: normalized }]);
  }

  onEvidenceFilesPicked(files: File[]): void {
    if (!files || files.length === 0) return;
    const items: { id: string; type: 'file'; file: File }[] = [];
    for (const f of files) {
      if (f.size > this.maxEvidenceBytes) { continue; }
      const okType = f.type === 'application/pdf' || f.type.startsWith('image/') || /\.(pdf|png|jpe?g|gif|webp)$/i.test(f.name);
      if (!okType) { continue; }
      items.push({ id: crypto.randomUUID(), type: 'file', file: f });
    }
    if (items.length) this.evidenceItems.update(arr => [...arr, ...items]);
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  // Helfer: formatiertes Datum
  asDateString(d: Date | null) {
    return d ? d.toLocaleString() : '—';
  }

  async submit(): Promise<void> {
    if (this.submitting) return;
    this.errorMsg = '';
    this.submitting = true;

    try {
      const contentId = this.contentIdSig();
      const contentUrl = this.data?.contentUrl ?? '';
      const contentSnapshot = this.data?.message ? JSON.stringify(this.data.message) : '';
      const contentType = 'public message';

      if (this.activeTabIndex === 0) {
        // QUICK REPORT
        const raw = this.quickForm.getRawValue();
        const response: DsaSubmissionResponse = await firstValueFrom(this.dsa.submitSignal({
          contentId,
          contentUrl,
          category: raw.category || '',
          reasonText: raw.reasonText || '',
          contentType,
          content: contentSnapshot
        }));
        this.showSuccess('signal', response?.statusUrl ?? null, response?.token ?? null);
      } else {
        // FORMAL NOTICE
        const raw = this.formalForm.getRawValue();
        const response: DsaSubmissionResponse = await firstValueFrom(this.dsa.submitNotice({
          contentId,
          contentUrl,
          category: raw.category || '',
          reasonText: raw.reasonText || '',
          email: raw.reporterEmail || '',
          name: raw.reporterName || '',
          truthAffirmation: !!raw.truthAffirmation,
          contentType,
          content: contentSnapshot
        }));
        // attach evidence to created notice (via public token), if any
        await this.attachEvidenceAfterSubmit('notice', response?.id, response?.token || null);
        // clear selected evidence after successful submission
        this.evidenceItems.set([]);
        this.showSuccess('notice', response?.statusUrl ?? null, response?.token ?? null, raw.reporterEmail || '');
      }
    } catch (error) {
      const detail =
        (error as { error?: { message?: string } })?.error?.message ??
        'Submitting failed. Please try again.';
      this.errorMsg = detail;
      this.showError(error);
    } finally {
      this.submitting = false;
    }
  }

  cancel(): void {
    this.dialogRef.close({ created: false });
  }

  private openDisplayMessage(opts: {
    title: string;
    message: string;
    icon: string;          // z. B. 'task_alt', 'flag', 'gavel', 'report_problem'
    closeParentalDialog?: boolean; // bei Erfolg true, bei Fehler false
  }) {
    const dialogRef = this.matDialog.open(DisplayMessage, {
      panelClass: '',
      closeOnNavigation: false,
      data: {
        showAlways: true,
        title: opts.title,
        image: '',
        icon: opts.icon,
        message: opts.message,
        button: 'Ok',
        delay: 0,
        showSpinner: false
      },
      maxWidth: '90vw',
      maxHeight: '90vh',
      hasBackdrop: true,
      autoFocus: false
    });

    dialogRef.afterClosed().subscribe(() => {
      if (opts.closeParentalDialog) {
        // schließt den DSA-Dialog selbst
        this.dialogRef.close({ created: true });
      }
    });

    return dialogRef;
  }

  private showSuccess(kind: 'signal' | 'notice', statusUrl?: string | null, token?: string | null, reporterEmail?: string | null) {
    if (statusUrl || token) {
      const dialogRef = this.matDialog.open(DsaStatusLinkDialogComponent, {
        data: {
          kind,
          statusUrl: statusUrl ?? null,
          token: token ?? null,
          reporterEmail: reporterEmail ?? null
        },
        width: 'min(540px, 95vw)',
        autoFocus: false
      });

      dialogRef.afterClosed().subscribe(() => {
        this.dialogRef.close({ created: true });
      });
      return;
    }

    if (kind === 'signal') {
      this.openDisplayMessage({
        title: 'Report sent',
        message: 'Thanks! Your quick report was submitted successfully. Our team will review it.',
        icon: 'flag',
        closeParentalDialog: true
      });
      return;
    }

    const email = (reporterEmail || '').trim();
    const message = email
      ? 'Your DSA notice was submitted successfully. We will contact you via email after the review.'
      : 'Your DSA notice was submitted successfully. If you would like to receive updates, please provide an email address next time.';

    this.openDisplayMessage({
      title: 'Notice submitted',
      message,
      icon: 'gavel',
      closeParentalDialog: true
    });
  }

  private showError(error: unknown) {
    const typed = error as { error?: { message?: string; detail?: string }; message?: string };
    const detail =
      typed?.error?.message ||
      typed?.error?.detail ||
      typed?.message ||
      'Submitting failed. Please try again.';
    // Fehler: deutliches Warn-Icon, Dialog bleibt offen
    this.openDisplayMessage({
      title: 'Submission failed',
      message: detail,
      icon: 'report_problem',
      closeParentalDialog: false
    });
  }

  private async attachEvidenceAfterSubmit(kind: 'signal' | 'notice', id?: string | null, token?: string | null): Promise<void> {
    const items = this.evidenceItems();
    if (!id || items.length === 0) return;
    // perform sequentially to simplify error handling
    for (const item of items) {
      try {
        if (kind === 'notice') {
          // Use public token route so no admin auth is required
          if (!token) continue;
          if (item.type === 'file' && item.file) {
            await firstValueFrom(this.dsa.addNoticeEvidenceByToken(token, { type: 'file', file: item.file }));
          } else if (item.type === 'url' && item.url) {
            await firstValueFrom(this.dsa.addNoticeEvidenceByToken(token, { type: 'url', url: item.url }));
          }
        } else {
          if (item.type === 'file' && item.file) {
            await firstValueFrom(this.dsa.addSignalEvidence(id, { type: 'file', file: item.file }));
          } else if (item.type === 'url' && item.url) {
            await firstValueFrom(this.dsa.addSignalEvidence(id, { type: 'url', url: item.url }));
          }
        }
      } catch {
        // continue with others; individual errors are handled in service
      }
    }
  }

  private normalizeUrl(u: string): string | null {
    if (!u) return null;
    const trimmed = u.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    // If looks like a domain (has a dot) or starts with www., prefix https://
    if (/^www\./i.test(trimmed) || /\.[a-z]{2,}(?:\/.+)?$/i.test(trimmed)) {
      return `https://${trimmed}`;
    }
    return null;
  }
}
