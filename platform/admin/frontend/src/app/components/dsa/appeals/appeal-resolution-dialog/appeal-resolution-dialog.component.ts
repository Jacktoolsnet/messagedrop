import { Component, Inject, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

export interface AppealResolutionData {
  outcome: string | null;
  reviewer?: string | null;
  reason?: string | null;
}

@Component({
  selector: 'app-appeal-resolution-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    ReactiveFormsModule
  ],
  templateUrl: './appeal-resolution-dialog.component.html',
  styleUrls: ['./appeal-resolution-dialog.component.css']
})
export class AppealResolutionDialogComponent {
  private readonly fb = inject(FormBuilder);
  private lastAutoReason: string | null = null;
  readonly outcomes = [
    { value: 'UPHELD', label: 'Decision upheld' },
    { value: 'REVISED', label: 'Decision revised' }
  ];

  private readonly standardTexts: Record<string, string> = {
    UPHELD: 'We reviewed the case and confirm that the original decision remains valid.',
    REVISED: 'After reviewing the appeal we have revised the original decision accordingly.'
  };

  readonly form = this.fb.nonNullable.group({
    outcome: ['', Validators.required],
    reviewer: [''],
    reason: ['']
  });

  constructor(
    private readonly dialogRef: MatDialogRef<AppealResolutionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { defaultOutcome?: string | null; reviewer?: string | null; reason?: string | null }
  ) {
    if (data?.defaultOutcome) {
      this.form.patchValue({ outcome: data.defaultOutcome });
      const template = this.standardTexts[data.defaultOutcome] ?? '';
      if (!data?.reason) {
        this.form.patchValue({ reason: template });
        this.lastAutoReason = template;
      }
    }
    if (data?.reviewer) {
      this.form.patchValue({ reviewer: data.reviewer });
    }
    if (data?.reason) {
      this.form.patchValue({ reason: data.reason });
      this.lastAutoReason = data.reason;
    }

    if (!this.form.controls.outcome.value) {
      const first = this.outcomes[0]?.value;
      if (first) {
        const template = this.standardTexts[first] ?? '';
        this.form.patchValue({ outcome: first, reason: template });
        this.lastAutoReason = template;
      }
    }

    this.form.controls.outcome.valueChanges.subscribe(value => {
      const std = value ? this.standardTexts[value] ?? '' : '';
      const current = this.form.controls.reason.value ?? '';
      if (!current || current === this.lastAutoReason) {
        this.form.controls.reason.setValue(std);
        this.lastAutoReason = std;
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.dialogRef.close({
      outcome: value.outcome,
      reviewer: value.reviewer?.trim() || null,
      reason: value.reason?.trim() || null
    } as AppealResolutionData);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
