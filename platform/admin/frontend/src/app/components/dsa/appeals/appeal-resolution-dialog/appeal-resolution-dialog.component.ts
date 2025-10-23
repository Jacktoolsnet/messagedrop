import { Component, Inject, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DsaService } from '../../../../services/dsa/dsa/dsa.service';
import { DecisionOutcome } from '../../decisions/decision-dialog/decision-dialog.component';

export interface AppealResolutionData {
  outcome: string | null;
  reviewer?: string | null;
  reason?: string | null;
}

@Component({
  selector: 'app-appeal-resolution-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatSlideToggleModule,
    ReactiveFormsModule
  ],
  templateUrl: './appeal-resolution-dialog.component.html',
  styleUrls: ['./appeal-resolution-dialog.component.css']
})
export class AppealResolutionDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(MatSnackBar);
  private readonly dsa = inject(DsaService);
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
    reason: [''],
    // Decision (only if outcome === 'REVISED')
    decOutcome: this.fb.nonNullable.control<DecisionOutcome>('NO_ACTION', Validators.required),
    legalBasis: [''],
    tosBasis: [''],
    automatedUsed: this.fb.nonNullable.control<boolean>(false),
    statement: ['']
  });

  isRevised = computed(() => this.form.controls.outcome.value === 'REVISED');
  decisionOutcomes: DecisionOutcome[] = ['NO_ACTION', 'RESTRICT', 'REMOVE_CONTENT', 'FORWARD_TO_AUTHORITY'];

  constructor(
    private readonly dialogRef: MatDialogRef<AppealResolutionDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { defaultOutcome?: string | null; reviewer?: string | null; reason?: string | null; noticeId?: string; noticeContentId?: string | null; currentDecisionOutcome?: DecisionOutcome | null }
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

    // Filter decision outcomes to not include current decision outcome (if provided)
    if (this.data?.currentDecisionOutcome) {
      this.decisionOutcomes = this.decisionOutcomes.filter(o => o !== this.data!.currentDecisionOutcome);
      // pick first allowed as default
      if (this.decisionOutcomes.length) {
        this.form.controls.decOutcome.setValue(this.decisionOutcomes[0]);
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

    const closeWith = () => this.dialogRef.close({
      outcome: value.outcome,
      reviewer: (value.reviewer || '').trim() || null,
      reason: (value.reason || '').trim() || null
    } as AppealResolutionData);

    if (value.outcome === 'REVISED' && this.data?.noticeId) {
      // Create a new decision with selected fields
      this.dsa.createDecision(this.data.noticeId, {
        outcome: value.decOutcome,
        legalBasis: (value.legalBasis || '').trim() || null,
        tosBasis: (value.tosBasis || '').trim() || null,
        automatedUsed: !!value.automatedUsed,
        statement: (value.statement || '').trim() || null
      }).subscribe({
        next: () => {
          // Update visible status depending on decision (NO_ACTION -> visible = true, others false)
          const cid = (this.data.noticeContentId || '').trim();
          if (cid) {
            const visible = value.decOutcome === 'NO_ACTION';
            this.dsa.setPublicMessageVisibility(cid, visible).subscribe({ next: () => {}, error: () => {} });
          }
          this.snack.open('Decision revised.', 'OK', { duration: 2000 });
          closeWith();
        },
        error: () => {
          this.snack.open('Failed to save revised decision.', 'OK', { duration: 3000 });
        }
      });
    } else {
      // UPHELD – nothing else to do here
      closeWith();
    }
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
