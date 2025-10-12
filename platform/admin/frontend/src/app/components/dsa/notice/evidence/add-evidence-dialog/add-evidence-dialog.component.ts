import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DsaService } from '../../../../../services/dsa/dsa/dsa.service';

@Component({
  selector: 'app-add-evidence-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatDialogModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule
  ],
  templateUrl: './add-evidence-dialog.component.html',
  styleUrls: ['./add-evidence-dialog.component.css']
})
export class AddEvidenceDialogComponent {
  private fb = inject(FormBuilder);
  private dsa = inject(DsaService);
  private snack = inject(MatSnackBar);
  private ref = inject(MatDialogRef<AddEvidenceDialogComponent, boolean>);
  data = inject<{ noticeId: string }>(MAT_DIALOG_DATA);

  saving = signal(false);

  form = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<'url' | 'hash' | 'file'>('url', { validators: [Validators.required] }),
    url: this.fb.control<string>(''),
    hash: this.fb.control<string>(''),
  });

  close(): void { this.ref.close(false); }

  submit(): void {
    if (this.form.invalid || this.saving()) return;
    const { type, url, hash } = this.form.getRawValue();
    // einfache Validierung je nach Typ
    if (type === 'url' && !url) { this.snack.open('Please provide an URL.', 'OK', { duration: 2500 }); return; }
    if (type === 'hash' && !hash) { this.snack.open('Please provide a hash.', 'OK', { duration: 2500 }); return; }

    this.saving.set(true);
    this.dsa.addEvidence(this.data.noticeId, { type, url: url || null, hash: hash || null }).subscribe({
      next: () => {
        this.snack.open('Evidence added.', 'OK', { duration: 2200 });
        this.ref.close(true);
      },
      error: () => {
        this.snack.open('Could not add evidence.', 'OK', { duration: 3200 });
        this.saving.set(false);
      }
    });
  }
}