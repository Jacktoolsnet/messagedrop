import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DsaService } from '../../../../services/dsa/dsa/dsa.service';

@Component({
  selector: 'app-notify-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatSlideToggleModule,
    MatIcon
  ],
  templateUrl: './notify-dialog.component.html',
  styleUrls: ['./notify-dialog.component.css']
})
export class NotifyDialogComponent {
  private fb = inject(FormBuilder);
  private snack = inject(MatSnackBar);
  private dsa = inject(DsaService);
  private ref = inject(MatDialogRef<NotifyDialogComponent>);
  data = inject<{ noticeId: string }>(MAT_DIALOG_DATA);

  sending = signal(false);

  channels = [
    { value: 'USER', label: 'User' },
    { value: 'AUTHORITY', label: 'Authority' },
    { value: 'OTHER', label: 'Other / Internal' }
  ];

  form = this.fb.nonNullable.group({
    channel: this.fb.nonNullable.control('USER', { validators: [Validators.required] }),
    subject: this.fb.nonNullable.control('', { validators: [Validators.required, Validators.maxLength(120)] }),
    message: this.fb.nonNullable.control('', { validators: [Validators.required, Validators.maxLength(2000)] }),
    sendEmail: this.fb.nonNullable.control(false)
  });

  close(): void {
    this.ref.close(false);
  }

  send(): void {
    if (this.form.invalid || this.sending()) return;
    this.sending.set(true);
    const { channel, subject, message, sendEmail } = this.form.getRawValue();

    this.dsa.notifyStakeholder(this.data.noticeId, {
      channel,
      subject,
      message,
      sendEmail
    }).subscribe({
      next: () => {
        this.snack.open('Notification sent successfully.', 'OK', { duration: 2500 });
        this.ref.close(true);
      },
      error: () => {
        this.snack.open('Failed to send notification.', 'OK', { duration: 3500 });
        this.sending.set(false);
      }
    });
  }
}