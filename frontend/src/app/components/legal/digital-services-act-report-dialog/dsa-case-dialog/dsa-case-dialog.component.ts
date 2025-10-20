import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, effect, Inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { DsaStatusAppeal } from '../../../../interfaces/dsa-status-appeal.interface';
import { DsaStatusEvidence } from '../../../../interfaces/dsa-status-evidence.interface';
import { DsaStatusResponse } from '../../../../interfaces/dsa-status-response.interface';
import { Message } from '../../../../interfaces/message';
import { DsaStatusService } from '../../../../services/dsa-status.service';

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
    MatTabsModule,
    MatChipsModule,
    DatePipe,
    MatSnackBarModule
  ],
  templateUrl: './dsa-case-dialog.component.html',
  styleUrl: './dsa-case-dialog.component.css'
})
export class DsaCaseDialogComponent implements OnInit {
  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024;
  private static readonly MAX_TOTAL_SIZE = 10 * 1024 * 1024;
  private static readonly ALLOWED_TYPES = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ]);
  private static readonly NOTICE_STATUS_LABELS: Record<string, string> = {
    RECEIVED: 'Received',
    UNDER_REVIEW: 'Under review',
    DECIDED: 'Decided'
  };

  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly uploading = signal(false);
  readonly error = signal<string | null>(null);
  readonly status = signal<DsaStatusResponse | null>(null);

  readonly appeals = computed<DsaStatusAppeal[]>(() => this.status()?.appeals ?? []);
  readonly evidence = computed<DsaStatusEvidence[]>(() => this.status()?.evidence ?? []);
  readonly attachments = signal<File[]>([]);
  readonly attachmentsSize = computed(() => this.attachments().reduce((sum, file) => sum + file.size, 0));
  readonly attachmentsSizeLabel = computed(() => this.formatBytes(this.attachmentsSize()));
  readonly activeTab = signal(0);
  readonly notice = computed(() => this.status()?.notice ?? null);
  readonly signalCase = computed(() => this.status()?.signal ?? null);
  readonly isNotice = computed(() => this.status()?.entityType === 'notice' && !!this.notice());
  readonly isSignal = computed(() => this.status()?.entityType === 'signal' && !!this.signalCase());
  readonly canSubmitAppeal = computed(() => this.isNotice() && !!this.status()?.decision);
  readonly summaryStatusLabel = computed(() => {
    if (this.isNotice()) {
      return this.formatNoticeStatus(this.notice()?.status);
    }
    if (this.isSignal()) {
      return 'Signal received';
    }
    return '—';
  });
  readonly summaryContentId = computed(() =>
    this.notice()?.contentId ??
    this.signalCase()?.contentId ??
    this.data.message?.uuid ??
    '—'
  );
  readonly summarySubmittedAt = computed(() =>
    this.notice()?.createdAt ??
    this.signalCase()?.createdAt ??
    null
  );
  readonly signalCategory = computed(() => this.signalCase()?.category ?? null);
  readonly signalReason = computed(() => this.signalCase()?.reasonText ?? null);
  readonly signalContentType = computed(() => this.signalCase()?.reportedContentType ?? null);
  readonly signalContentUrl = computed(() => this.signalCase()?.contentUrl ?? null);

  readonly appealForm = this.fb.nonNullable.group({
    arguments: ['', [Validators.required, Validators.minLength(20)]]
  });

  readonly publicStatusUrl = computed(() => this.buildPublicStatusUrl(this.data.token));

  constructor(
    private readonly fb: FormBuilder,
    private readonly service: DsaStatusService,
    private readonly snack: MatSnackBar,
    private readonly dialogRef: MatDialogRef<DsaCaseDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { token: string; message: Message }
  ) { }

  ngOnInit(): void {
    this.loadStatus();
    effect(() => {
      if (!this.canSubmitAppeal() && this.activeTab() !== 0) {
        this.activeTab.set(0);
      }
    });
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

  async submitAppeal(): Promise<void> {
    if (this.appealForm.invalid) {
      this.appealForm.markAllAsTouched();
      return;
    }

    if (this.attachmentsSize() > DsaCaseDialogComponent.MAX_TOTAL_SIZE) {
      this.snack.open('Files exceed the total limit of 10 MB.', 'OK', { duration: 4000, verticalPosition: 'top' });
      return;
    }

    this.submitting.set(true);
    try {
      const { id } = await firstValueFrom(this.service.createAppeal(this.data.token, this.appealForm.getRawValue()));

      let uploadIssue = false;
      if (id && this.attachments().length > 0) {
        uploadIssue = !(await this.uploadAttachments(id));
      }

      const successMessage = uploadIssue
        ? 'Appeal submitted but some files failed to upload.'
        : 'Appeal submitted successfully.';

      this.snack.open(successMessage, 'OK', { duration: 3500, verticalPosition: 'top' });
      if (!uploadIssue) {
        this.appealForm.reset();
        this.attachments.set([]);
        if (this.activeTab() !== 0) {
          this.activeTab.set(0);
        }
      }
      this.loadStatus();
    } catch (err: any) {
      const msg = err?.error?.error === 'decision_pending'
        ? 'A decision has not been finalised yet. Appeals are only possible afterwards.'
        : 'Could not submit the appeal. Please try again later.';
      this.snack.open(msg, 'OK', { duration: 4000, verticalPosition: 'top' });
    } finally {
      this.submitting.set(false);
      this.uploading.set(false);
    }
  }

  onAttachmentsSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);

    if (!files.length) {
      input.value = '';
      return;
    }

    let rejected = false;
    let message: string | null = null;
    const currentFiles = [...this.attachments()];
    let currentSize = this.attachmentsSize();

    for (const file of files) {
      if (!this.isAllowedFile(file)) {
        rejected = true;
        message = 'Only PDF or image files are allowed.';
        continue;
      }
      if (file.size > DsaCaseDialogComponent.MAX_FILE_SIZE) {
        rejected = true;
        message = 'Each file must be at most 5 MB.';
        continue;
      }
      if (currentSize + file.size > DsaCaseDialogComponent.MAX_TOTAL_SIZE) {
        rejected = true;
        message = 'Files exceed the total limit of 10 MB.';
        continue;
      }
      currentSize += file.size;
      currentFiles.push(file);
    }

    this.attachments.set(currentFiles);
    input.value = '';

    if (rejected && message) {
      this.snack.open(message, 'OK', { duration: 4000, verticalPosition: 'top' });
    }
  }

  removeAttachment(index: number): void {
    const next = [...this.attachments()];
    next.splice(index, 1);
    this.attachments.set(next);
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

  openPublicStatus(): void {
    const url = this.publicStatusUrl();
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  }

  private async uploadAttachments(appealId: string): Promise<boolean> {
    const files = this.attachments();
    if (!files.length) return true;

    this.uploading.set(true);
    try {
      for (const file of files) {
        await firstValueFrom(this.service.uploadAppealEvidence(this.data.token, appealId, file));
      }
      return true;
    } catch (err) {
      console.error('Failed to upload some appeal evidence', err);
      return false;
    } finally {
      this.uploading.set(false);
    }
  }

  private isAllowedFile(file: File): boolean {
    if (DsaCaseDialogComponent.ALLOWED_TYPES.has(file.type)) return true;
    if (file.type.startsWith('image/')) return true;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'pdf'].includes(ext);
  }

  private buildPublicStatusUrl(token: string | null | undefined): string | null {
    if (!token) return null;
    const base = (environment.publicStatusBaseUrl || '').trim().replace(/\/+$/, '');
    if (!base) return null;
    return `${base}/${encodeURIComponent(token)}`;
  }

  formatBytes(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let value = bytes;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1) {
      value /= 1024;
      unitIndex++;
    }
    return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  formatNoticeStatus(status: string | null | undefined): string {
    if (!status) return '—';
    const label = DsaCaseDialogComponent.NOTICE_STATUS_LABELS[status.toUpperCase()];
    return label ?? status;
  }

  formatAppealOutcome(outcome: string | null | undefined): string {
    if (!outcome) return 'Pending';
    switch (outcome.toUpperCase()) {
      case 'UPHELD':
        return 'Decision upheld';
      case 'REVISED':
        return 'Decision revised';
      case 'PARTIAL':
        return 'Partially revised';
      case 'WITHDRAWN':
        return 'Withdrawn';
      default:
        return outcome;
    }
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
