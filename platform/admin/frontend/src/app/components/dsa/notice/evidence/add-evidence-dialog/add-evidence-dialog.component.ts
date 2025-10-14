import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DsaService } from '../../../../../services/dsa/dsa/dsa.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

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
  selectedFile = signal<File | null>(null);
  readonly maxFileBytes = 5 * 1024 * 1024;

  form = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<'url' | 'hash' | 'file'>('url', { validators: [Validators.required] }),
    url: this.fb.control<string>(''),
    hash: this.fb.control<string>(''),
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    this.form.controls.type.valueChanges
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe((value) => {
        if (value !== 'file') {
          this.selectedFile.set(null);
        }
      });
  }

  close(): void { this.ref.close(false); }

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.selectedFile.set(null);
      return;
    }

    if (!this.isAllowedFile(file)) {
      this.snack.open('Only images or PDF files are allowed.', 'OK', { duration: 3000 });
      input.value = '';
      return;
    }
    if (file.size > this.maxFileBytes) {
      this.snack.open('File must be smaller than 5 MB.', 'OK', { duration: 3000 });
      input.value = '';
      return;
    }

    this.selectedFile.set(file);
  }

  private isAllowedFile(file: File): boolean {
    if (file.type === 'application/pdf') return true;
    if (file.type.startsWith('image/')) return true;
    const ext = file.name.toLowerCase();
    return ext.endsWith('.pdf') || ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.gif') || ext.endsWith('.webp');
  }

  submit(): void {
    if (this.form.invalid || this.saving()) return;
    const { type, url, hash } = this.form.getRawValue();
    // einfache Validierung je nach Typ
    if (type === 'url' && !url) { this.snack.open('Please provide an URL.', 'OK', { duration: 2500 }); return; }
    if (type === 'hash' && !hash) { this.snack.open('Please provide a hash.', 'OK', { duration: 2500 }); return; }
    if (type === 'file' && !this.selectedFile()) {
      this.snack.open('Please select a file.', 'OK', { duration: 2500 });
      return;
    }

    this.saving.set(true);
    this.dsa.addEvidence(this.data.noticeId, {
      type,
      url: url || null,
      hash: hash || null,
      file: this.selectedFile()
    }).subscribe({
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
