import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
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
    MatButtonModule
  ],
  templateUrl: './digital-services-act-report-dialog.component.html',
  styleUrls: ['./digital-services-act-report-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DigitalServicesActReportDialogComponent {

  /** Dropdown-Optionen – Werte müssen zu deinem DsaNoticeCategory-Typ passen */
  readonly categories: { value: DsaNoticeCategory; label: string }[] = [
    { value: 'copyright' as DsaNoticeCategory, label: 'Copyright / IP infringement' },
    { value: 'hate' as DsaNoticeCategory, label: 'Hate speech / incitement' },
    { value: 'terror' as DsaNoticeCategory, label: 'Terrorism content' },
    { value: 'privacy' as DsaNoticeCategory, label: 'Privacy / personal data' },
    { value: 'other' as DsaNoticeCategory, label: 'Other illegal content' }
  ];

  /** Reactive Form */
  readonly form = this.fb.group({
    contentUuid: [{ value: this.data.reportedMessage.uuid, disabled: true }],
    category: ['', Validators.required],
    reasonText: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(4000)]],
    reporterEmail: [this.data.reporterEmail ?? '', [Validators.required, Validators.email]],
    reporterName: [this.data.reporterName ?? ''],
    truthAffirmation: [false, Validators.requiredTrue]
  });

  submitting = false;
  errorMsg = '';

  constructor(
    @Inject(MAT_DIALOG_DATA) public data: DigitalServicesActReportDialogData,
    private dialogRef: MatDialogRef<DigitalServicesActReportDialogComponent, { created: boolean }>,
    private fb: FormBuilder,
    private dsa: DigitalServicesActService
  ) { }

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting) return;

    this.submitting = true;
    this.errorMsg = '';

    const raw = this.form.getRawValue();

    const payload: CreateDsaNotice = {
      contentUuid: this.data.reportedMessage.uuid,
      contentUrl: this.data.reportedContentUrl ?? '',
      category: raw.category as DsaNoticeCategory,
      reasonText: raw.reasonText ?? '',
      reporterEmail: raw.reporterEmail ?? '',
      reporterName: raw.reporterName ?? '',
      truthAffirmation: true
    };

    try {
      await this.dsa.createNotice(payload).toPromise();
      this.dialogRef.close({ created: true });
    } catch (e: any) {
      this.errorMsg = e?.error?.message ?? 'Submitting the report failed. Please try again.';
    } finally {
      this.submitting = false;
    }
  }

  cancel(): void {
    this.dialogRef.close({ created: false });
  }
}