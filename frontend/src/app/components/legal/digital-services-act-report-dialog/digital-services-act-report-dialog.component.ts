import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';

import { DsaNoticeCategory } from '../../../interfaces/dsa-notice-category.interface';
import { DigitalServicesActService } from '../../../services/digital-services-act.service';
import { DisplayMessage } from '../../utils/display-message/display-message.component';

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
    MatIconModule
  ],
  templateUrl: './digital-services-act-report-dialog.component.html',
  styleUrls: ['./digital-services-act-report-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DigitalServicesActReportDialogComponent {

  // Wir verzichten auf ein externes Dialog-Interface.
  // Erwartete Struktur: { message: any; contentUrl?: string; reporterEmail?: string; reporterName?: string }
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: any,
    private dialogRef: MatDialogRef<DigitalServicesActReportDialogComponent, { created: boolean }>,
    private fb: FormBuilder,
    private dsa: DigitalServicesActService,
    private matDialog: MatDialog,
  ) { }

  // Content-ID robust aus der Message ziehen
  private readonly contentIdSig = signal<string>(
    this.data?.message?.uuid ?? this.data?.message?.id ?? ''
  );

  readonly categories: { value: DsaNoticeCategory; label: string }[] = [
    { value: 'copyright', label: 'Copyright / IP infringement' },
    { value: 'hate', label: 'Hate speech / incitement' },
    { value: 'terror', label: 'Terrorism content' },
    { value: 'privacy', label: 'Privacy / personal data' },
    { value: 'other', label: 'Other illegal content' }
  ];

  /** Quick report – alles optional */
  readonly quickForm = this.fb.group({
    // contentId nur anzeigen (Backend kennt die echte ID ohnehin)
    contentId: [{ value: this.contentIdSig(), disabled: true }],
    category: ['' as '' | DsaNoticeCategory],
    reasonText: ['']
  });

  /** Formal DSA report – ohne Pflichtfelder */
  readonly formalForm = this.fb.group({
    contentId: [{ value: this.contentIdSig(), disabled: true }],
    category: ['' as '' | DsaNoticeCategory],
    reasonText: [''],
    reporterEmail: [this.data?.reporterEmail ?? ''],
    reporterName: [this.data?.reporterName ?? ''],
    truthAffirmation: [false]
  });

  submitting = false;
  errorMsg = '';
  activeTabIndex = 0; // 0 = Quick, 1 = Formal

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
      const contentSnapshot = this.data?.message ?? null;
      const contentType = 'public message';

      if (this.activeTabIndex === 0) {
        // QUICK REPORT
        const raw = this.quickForm.getRawValue();
        await this.dsa.submitSignal({
          contentId,
          contentUrl,
          category: raw.category || '',
          reasonText: raw.reasonText || '',
          contentType,
          content: contentSnapshot
        });

        this.showSuccess('signal');
      } else {
        // FORMAL NOTICE
        const raw = this.formalForm.getRawValue();
        await this.dsa.submitNotice({
          contentId,
          contentUrl,
          category: raw.category || '',
          reasonText: raw.reasonText || '',
          email: raw.reporterEmail || '',
          name: raw.reporterName || '',
          truthAffirmation: !!raw.truthAffirmation,
          contentType,
          content: contentSnapshot
        });

        this.showSuccess('notice');
      }
    } catch (e: any) {
      this.errorMsg = e?.error?.message ?? 'Submitting failed. Please try again.';
      this.showError(e);
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

    dialogRef.afterOpened().subscribe(() => {
      // optional: analytics/telemetry
    });

    dialogRef.afterClosed().subscribe(() => {
      if (opts.closeParentalDialog) {
        // schließt den DSA-Dialog selbst
        this.dialogRef.close({ created: true });
      }
    });

    return dialogRef;
  }

  private showSuccess(kind: 'signal' | 'notice') {
    if (kind === 'signal') {
      this.openDisplayMessage({
        title: 'Report sent',
        message: 'Thanks! Your quick report was submitted successfully. Our team will review it.',
        icon: 'flag',
        closeParentalDialog: true
      });
      return;
    }

    // kind === 'notice'
    const email = (this.formalForm.getRawValue().reporterEmail || '').trim();
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

  private showError(e: any) {
    const detail =
      e?.error?.message ||
      e?.error?.detail ||
      e?.message ||
      'Submitting failed. Please try again.';
    // Fehler: deutliches Warn-Icon, Dialog bleibt offen
    this.openDisplayMessage({
      title: 'Submission failed',
      message: detail,
      icon: 'report_problem',
      closeParentalDialog: false
    });
  }
}