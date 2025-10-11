import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DsaService } from '../../../../services/dsa/dsa/dsa.service';

export type DecisionOutcome = 'REMOVE_CONTENT' | 'RESTRICT' | 'NO_ACTION' | 'FORWARD_TO_AUTHORITY';

@Component({
  selector: 'app-add-decision-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule,
    MatButtonModule, MatIconModule
  ],
  templateUrl: './decision-dialog.component.html',
  styleUrls: ['./decision-dialog.component.css']
})
export class DecisionDialogComponent {
  private fb = inject(FormBuilder);
  private dsa = inject(DsaService);
  private snack = inject(MatSnackBar);
  private ref = inject(MatDialogRef<DecisionDialogComponent>);
  data = inject<{ noticeId: string }>(MAT_DIALOG_DATA);

  submitting = signal(false);

  outcomes: { value: DecisionOutcome; label: string; icon: string }[] = [
    { value: 'REMOVE_CONTENT', label: 'Remove content', icon: 'delete_forever' },
    { value: 'RESTRICT', label: 'Restrict / mask', icon: 'visibility_off' },
    { value: 'NO_ACTION', label: 'No action', icon: 'check_circle' },
    { value: 'FORWARD_TO_AUTHORITY', label: 'Forward to authority', icon: 'gavel' }
  ];

  form = this.fb.nonNullable.group({
    outcome: this.fb.nonNullable.control<DecisionOutcome>('NO_ACTION', { validators: [Validators.required] }),
    legalBasis: this.fb.control<string>(''),
    tosBasis: this.fb.control<string>(''),
    automatedUsed: this.fb.nonNullable.control<boolean>(false),
    statement: this.fb.control<string>('', { validators: [Validators.maxLength(2000)] })
  });

  close(): void { this.ref.close(false); }

  submit(): void {
    if (this.form.invalid || this.submitting()) return;
    this.submitting.set(true);
    const { outcome, legalBasis, tosBasis, automatedUsed, statement } = this.form.getRawValue();

    this.dsa.createDecision(this.data.noticeId, {
      outcome, legalBasis: legalBasis || null, tosBasis: tosBasis || null,
      automatedUsed, statement: statement || null
    }).subscribe({
      next: () => {
        this.snack.open('Decision saved.', 'OK', { duration: 2500 });
        this.ref.close(true); // signalisiere dem Caller "refresh"
      },
      error: () => {
        this.snack.open('Failed to save decision.', 'OK', { duration: 3500 });
        this.submitting.set(false);
      }
    });
  }
}