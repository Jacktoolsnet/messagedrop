import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

import { DsaNotice } from '../../../../interfaces/dsa-notice.interface';

export interface NotificationDialogData {
  notice: DsaNotice;
}

@Component({
  selector: 'app-notification-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './notification-dialog.component.html',
  styleUrls: ['./notification-dialog.component.css']
})
export class NotificationDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<NotificationDialogComponent>);
  private readonly snack = inject(MatSnackBar);
  readonly data = inject<NotificationDialogData>(MAT_DIALOG_DATA);

  readonly form = this.fb.nonNullable.group({
    stakeholder: this.fb.nonNullable.control<'reporter' | 'uploader' | 'other'>('reporter', Validators.required),
    channel: this.fb.nonNullable.control<'email' | 'inapp' | 'webhook'>('email', Validators.required),
    subject: this.fb.control<string>(''),
    body: this.fb.control<string>('', Validators.required),
    event: this.fb.control<string>('')
  });

  get channel() {
    return this.form.get('channel')?.value;
  }

  cancel(): void {
    this.dialogRef.close();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snack.open('Please complete the required fields.', 'OK', { duration: 2500 });
      return;
    }

    const value = this.form.getRawValue();
    const payload: any = { body: value.body, event: value.event || undefined };

    if (value.channel === 'email') {
      payload.subject = value.subject?.trim() || 'DSA update';
    }

    this.dialogRef.close({
      stakeholder: value.stakeholder,
      channel: value.channel,
      payload
    });
  }
}
