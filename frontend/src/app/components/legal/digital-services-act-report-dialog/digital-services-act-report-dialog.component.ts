import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';

import { CreateDsaNotice } from '../../../interfaces/create-dsa-notice.interface';
import { CreateDsaSignal } from '../../../interfaces/create-dsa-signal.interface';
import { DsaNoticeCategory } from '../../../interfaces/dsa-notice-category.interface';
import { DigitalServicesActService } from '../../../services/digital-services-act.service';

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
    private dsa: DigitalServicesActService
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
      const contentSnapshot = this.data?.message ?? null; // komplettes Message-Objekt
      const contentType = this.data?.contentType ?? 'public message';

      if (this.activeTabIndex === 0) {
        // QUICK REPORT
        const raw = this.quickForm.getRawValue();
        const payload: CreateDsaSignal = {
          contentId,
          contentUrl,
          category: raw.category || '',
          reasonText: raw.reasonText || '',
          contentType,
          content: contentSnapshot
        };
        await this.dsa.submitSignal(payload).toPromise();
      } else {
        // FORMAL NOTICE
        const raw = this.formalForm.getRawValue();
        const payload: CreateDsaNotice = {
          contentId,
          contentUrl,
          category: raw.category || '',
          reasonText: raw.reasonText || '',
          email: raw.reporterEmail || '',
          name: raw.reporterName || '',
          truthAffirmation: !!raw.truthAffirmation,
          contentType,
          content: contentSnapshot
        };
        await this.dsa.submitNotice(payload).toPromise();
      }

      this.dialogRef.close({ created: true });
    } catch (e: any) {
      this.errorMsg = e?.error?.message ?? 'Submitting failed. Please try again.';
    } finally {
      this.submitting = false;
    }
  }

  cancel(): void {
    this.dialogRef.close({ created: false });
  }
}