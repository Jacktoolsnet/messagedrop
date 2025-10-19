import { CommonModule, DatePipe } from '@angular/common';
import { Component, Inject, OnInit, signal, computed } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatListModule } from '@angular/material/list';
import { DsaStatusService } from '../../../../services/dsa-status.service';
import { DsaStatusResponse } from '../../../../interfaces/dsa-status-response.interface';
import { DsaStatusEvidence } from '../../../../interfaces/dsa-status-evidence.interface';
import { DsaStatusAppeal } from '../../../../interfaces/dsa-status-appeal.interface';
import { Message } from '../../../../interfaces/message';

@Component({
  selector: 'app-dsa-case-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatInputModule,
    ReactiveFormsModule,
    MatProgressBarModule,
    MatListModule,
    DatePipe,
    MatSnackBarModule
  ],
  templateUrl: './dsa-case-dialog.component.html',
  styleUrl: './dsa-case-dialog.component.css'
})
export class DsaCaseDialogComponent implements OnInit {
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly status = signal<DsaStatusResponse | null>(null);

  readonly appeals = computed<DsaStatusAppeal[]>(() => this.status()?.appeals ?? []);
  readonly evidence = computed<DsaStatusEvidence[]>(() => this.status()?.evidence ?? []);

  readonly appealForm = this.fb.nonNullable.group({
    arguments: ['', [Validators.required, Validators.minLength(20)]],
    contact: ['', [Validators.email, Validators.maxLength(320)]]
  });

  selectedFile: File | null = null;
  lastCreatedAppealId: string | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly service: DsaStatusService,
    private readonly snack: MatSnackBar,
    private readonly dialogRef: MatDialogRef<DsaCaseDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { token: string; message: Message }
  ) { }

  ngOnInit(): void {
    this.loadStatus();
  }

  loadStatus(): void {
    this.loading.set(true);
    this.error.set(null);
    this.service.getStatus(this.data.token).subscribe({
      next: (resp) => {
        this.status.set(resp);
        this.loading.set(false);
      },
      error: (err) => {
        const msg = err?.error?.error === 'not_found'
          ? 'No case information was found for this token.'
          : 'Could not load the current status. Please try again later.';
        this.error.set(msg);
        this.loading.set(false);
      }
    });
  }

  submitAppeal(): void {
    if (this.appealForm.invalid) {
      this.appealForm.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.service.createAppeal(this.data.token, this.appealForm.getRawValue()).subscribe({
      next: ({ id }) => {
        this.snack.open('Appeal submitted successfully.', 'OK', { duration: 3000, verticalPosition: 'top' });
        this.lastCreatedAppealId = id;
        this.appealForm.reset();
        this.loadStatus();
        this.submitting.set(false);
      },
      error: (err) => {
        const msg = err?.error?.error === 'decision_pending'
          ? 'A decision has not been finalised yet. Appeals are only possible afterwards.'
          : 'Could not submit the appeal. Please try again later.';
        this.snack.open(msg, 'OK', { duration: 4000, verticalPosition: 'top' });
        this.submitting.set(false);
      }
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile = file;
  }

  uploadEvidence(): void {
    if (!this.selectedFile || !this.lastCreatedAppealId) {
      this.snack.open('Please select a file after submitting your appeal.', 'OK', { duration: 3000, verticalPosition: 'top' });
      return;
    }
    this.uploading.set(true);
    this.service.uploadAppealEvidence(this.data.token, this.lastCreatedAppealId, this.selectedFile).subscribe({
      next: () => {
        this.snack.open('File uploaded successfully.', 'OK', { duration: 3000, verticalPosition: 'top' });
        this.selectedFile = null;
        this.lastCreatedAppealId = null;
        this.uploading.set(false);
        this.loadStatus();
      },
      error: () => {
        this.snack.open('Could not upload the file.', 'OK', { duration: 4000, verticalPosition: 'top' });
        this.uploading.set(false);
      }
    });
  }

  download(ev: DsaStatusEvidence): void {
    if (ev.type !== 'file') return;
    this.service.downloadEvidence(this.data.token, ev.id).subscribe({
      next: (resp) => {
        const blob = resp.body;
        if (!blob) return;
        const filename = this.resolveFilename(resp.headers?.get('Content-Disposition'), ev.fileName || 'evidence');
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
      },
      error: () => this.snack.open('Could not download the file.', 'OK', { duration: 3000 })
    });
  }

  close(): void {
    this.dialogRef.close();
  }

  private resolveFilename(disposition: string | null, fallback: string): string {
    if (!disposition) return fallback;
    const match = /filename\*?=(?:UTF-8'')?"?([^";]+)/i.exec(disposition);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1].replace(/"/g, ''));
      } catch {
        return match[1].replace(/"/g, '');
      }
    }
    return fallback;
  }
}
