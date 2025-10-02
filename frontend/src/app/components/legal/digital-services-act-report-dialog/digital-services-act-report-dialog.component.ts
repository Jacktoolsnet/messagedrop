import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, Inject, signal } from '@angular/core';
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
import { DigitalServicesActReportDialogData } from '../../../interfaces/digital-services-act-report-dialog-data.interface';
import { DsaNoticeCategory } from '../../../interfaces/dsa-notice-category.interface';
import { DigitalServicesActService } from '../../../services/digital-services-act.service';


@Component({
  selector: 'app-digital-services-act-report-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatTabsModule,
    MatIconModule
  ],
  templateUrl: './digital-services-act-report-dialog.component.html',
  styleUrls: ['./digital-services-act-report-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DigitalServicesActReportDialogComponent {
  private readonly dsaBase = '/api/dsa';

  // robuste Content-ID-Ermittlung
  private readonly contentIdSig = signal<string>(
    (this.data.reportedContent as any)?.uuid ??
    (this.data.reportedContent as any)?.id ??
    ''
  );

  // kompakte Preview
  readonly preview = computed(() => {
    const m: any = this.data.reportedContent ?? {};
    return {
      text: m.text ?? m.content ?? m.message ?? '',
      author: m.userId ?? m.userName ?? m.author ?? ''
    };
  });

  readonly categories: { value: DsaNoticeCategory; label: string }[] = [
    { value: 'copyright', label: 'Copyright / IP infringement' },
    { value: 'hate', label: 'Hate speech / incitement' },
    { value: 'terror', label: 'Terrorism content' },
    { value: 'privacy', label: 'Privacy / personal data' },
    { value: 'other', label: 'Other illegal content' }
  ];

  /** Quick report – alles optional */
  readonly quickForm = this.fb.group({
    contentId: [{ value: this.contentIdSig(), disabled: true }],
    category: ['' as '' | DsaNoticeCategory],
    reasonText: ['']
  });

  /** Formal DSA report – jetzt auch ohne Pflichtfelder */
  readonly formalForm = this.fb.group({
    contentId: [{ value: this.contentIdSig(), disabled: true }],
    category: ['' as '' | DsaNoticeCategory],
    reasonText: [''],
    reporterEmail: [''],
    reporterName: [''],
    truthAffirmation: [false]
  });

  submitting = false;
  errorMsg = '';
  activeTabIndex = 0; // 0 = Quick, 1 = Formal

  private normalizeUnix(ts: unknown): Date | null {
    if (ts === null || ts === undefined) return null;
    const n = Number(ts);
    if (Number.isNaN(n)) return null;
    const ms = n < 1e12 ? n * 1000 : n; // 10-stellige Sekunden -> ms
    return new Date(ms);
  }

  readonly createdDate = computed(() =>
    this.normalizeUnix((this.data.reportedContent as any)?.createDateTime)
  );

  readonly deletedDate = computed(() =>
    this.normalizeUnix((this.data.reportedContent as any)?.deleteDateTime)
  );

  readonly autoDeleteLabel = computed(() => {
    const d = this.deletedDate();
    if (!d) return 'Auto delete';
    return d.getTime() > Date.now() ? 'Auto deletes on' : 'Auto deleted on';
  });

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DigitalServicesActReportDialogData,
    private dialogRef: MatDialogRef<DigitalServicesActReportDialogComponent, { created: boolean }>,
    private fb: FormBuilder,
    private dsa: DigitalServicesActService,
    private http: HttpClient
  ) { }

  async submit(): Promise<void> {
    if (this.submitting) return;
    this.errorMsg = '';
    this.submitting = true;

    try {
      if (this.activeTabIndex === 0) {
        // QUICK REPORT: informelles Signal, alle Felder optional
        const quickPayload = {
          contentId: this.contentIdSig(),
          contentUrl: this.data.reportedContentUrl ?? '',
          category: this.quickForm.getRawValue().category || null,
          reasonText: this.quickForm.getRawValue().reasonText || ''
        };
        await this.http.post<{ id: string }>(`${this.dsaBase}/signals`, quickPayload).toPromise();
      } else {
        // FORMAL NOTICE (DSA) – ohne Pflichtfelder
        const raw = this.formalForm.getRawValue();
        const payload: CreateDsaNotice = {
          contentUuid: this.contentIdSig(),
          contentUrl: this.data.reportedContentUrl ?? '',
          category: (raw.category || '') as any,     // darf leer sein
          reasonText: raw.reasonText || '',
          reporterEmail: raw.reporterEmail || '',
          reporterName: raw.reporterName || '',
          truthAffirmation: !!raw.truthAffirmation   // optionales Flag
        };
        await this.dsa.createNotice(payload).toPromise();
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