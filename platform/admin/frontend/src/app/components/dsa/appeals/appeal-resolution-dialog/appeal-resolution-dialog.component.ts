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
  readonly outcomes = [
    { value: 'UPHELD', label: 'Decision upheld' },
    { value: 'REVISED', label: 'Decision revised' },
    { value: 'PARTIAL', label: 'Partially revised' },
    { value: 'WITHDRAWN', label: 'Withdrawn' }
  ];

  readonly form = this.fb.nonNullable.group({
    outcome: ['', Validators.required],
    reviewer: ['']
  });

  constructor(
    private readonly dialogRef: MatDialogRef<AppealResolutionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { defaultOutcome?: string | null; reviewer?: string | null }
  ) {
    if (data?.defaultOutcome) {
      this.form.patchValue({ outcome: data.defaultOutcome });
    }
    if (data?.reviewer) {
      this.form.patchValue({ reviewer: data.reviewer });
    }
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.dialogRef.close({
      outcome: value.outcome,
      reviewer: value.reviewer?.trim() || null
    } as AppealResolutionData);
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
