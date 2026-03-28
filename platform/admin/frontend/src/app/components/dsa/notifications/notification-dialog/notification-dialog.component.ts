
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';

import { DsaNotice } from '../../../../interfaces/dsa-notice.interface';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { DialogActionBarComponent } from '../../../shared/dialog-action-bar/dialog-action-bar.component';
import { DialogHeaderComponent } from '../../../shared/dialog-header/dialog-header.component';
import { DisplayMessageService } from '../../../../services/display-message.service';

export interface NotificationDialogData {
  notice: DsaNotice;
}

@Component({
  selector: 'app-notification-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    DialogHeaderComponent,
    DialogActionBarComponent
  ],
  templateUrl: './notification-dialog.component.html',
  styleUrls: ['./notification-dialog.component.css']
})
export class NotificationDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<NotificationDialogComponent>);
  private readonly snack = inject(DisplayMessageService);
  readonly i18n = inject(TranslationHelperService);
  readonly data = inject<NotificationDialogData>(MAT_DIALOG_DATA);

  readonly form = this.fb.nonNullable.group({
    stakeholder: this.fb.nonNullable.control<'reporter' | 'uploader' | 'other'>('reporter', Validators.required),
    subject: this.fb.control<string>(''),
    body: this.fb.control<string>('', Validators.required),
    event: this.fb.control<string>(''),
    otherEmail: this.fb.control<string>('')
  });

  // Reporter kann E-Mail bekommen, wenn vorhanden; Uploader nur InApp; Other benötigt E-Mail-Adresse
  private stakeholderSig = signal<'reporter' | 'uploader' | 'other'>(this.form.controls.stakeholder.value);
  canEmailReporter = computed(() => !!(this.data?.notice?.reporterEmail));
  isReporter = computed(() => this.stakeholderSig() === 'reporter');
  isUploader = computed(() => this.stakeholderSig() === 'uploader');
  isOther = computed(() => this.stakeholderSig() === 'other');

  constructor() {
    // Sync the reactive-form control to a signal so computed() values update in the template
    this.form.controls.stakeholder.valueChanges.subscribe(v => {
      if (v === 'reporter' || v === 'uploader' || v === 'other') {
        this.stakeholderSig.set(v);
      }
    });
  }

  cancel(): void {
    this.dialogRef.close();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snack.open(this.i18n.t('Please complete the required fields.'), this.i18n.t('OK'), { duration: 2500 });
      return;
    }

    const value = this.form.getRawValue();
    // Validierung: Other braucht eine E-Mail
    if (value.stakeholder === 'other') {
      const email = (value.otherEmail || '').trim();
      const emailOk = /.+@.+\..+/.test(email);
      if (!emailOk) {
        this.snack.open(this.i18n.t('Please provide a valid email address.'), this.i18n.t('OK'), { duration: 2500 });
        return;
      }
    }

    this.dialogRef.close({
      stakeholder: value.stakeholder,
      subject: (value.subject || '').trim(),
      body: (value.body || '').trim(),
      event: (value.event || '').trim(),
      otherEmail: (value.otherEmail || '').trim()
    });
  }
}
