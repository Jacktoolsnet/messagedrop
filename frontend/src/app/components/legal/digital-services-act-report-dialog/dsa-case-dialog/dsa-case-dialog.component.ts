import { CommonModule, DatePipe } from '@angular/common';
import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatListModule } from '@angular/material/list';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';
import { EvidenceFileItem, EvidenceInputComponent, EvidenceUrlItem } from '../../../utils/evidence-input/evidence-input.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { environment } from '../../../../../environments/environment';
import { DsaStatusAppeal } from '../../../../interfaces/dsa-status-appeal.interface';
import { DsaStatusEvidence } from '../../../../interfaces/dsa-status-evidence.interface';
import { DsaStatusResponse } from '../../../../interfaces/dsa-status-response.interface';
import { Message } from '../../../../interfaces/message';
import { DsaStatusService } from '../../../../services/dsa-status.service';
import { TranslationHelperService } from '../../../../services/translation-helper.service';

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
    MatFormFieldModule,
    ReactiveFormsModule,
    MatProgressBarModule,
    MatListModule,
    MatTabsModule,
    MatChipsModule,
    MatTooltipModule,
    EvidenceInputComponent,
    DatePipe,
    MatSnackBarModule,
    TranslocoPipe
  ],
  templateUrl: './dsa-case-dialog.component.html',
  styleUrl: './dsa-case-dialog.component.css'
})
export class DsaCaseDialogComponent implements OnInit {
  private static readonly MAX_FILES = 4;
  private static readonly MAX_FILE_SIZE = 1 * 1024 * 1024;
  private static readonly MAX_TOTAL_SIZE = DsaCaseDialogComponent.MAX_FILES * DsaCaseDialogComponent.MAX_FILE_SIZE;
  private static readonly ALLOWED_TYPES = new Set([
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'image/svg+xml'
  ]);
  private static readonly NOTICE_STATUS_LABELS: Record<string, string> = {
    RECEIVED: 'dsa.case.noticeStatus.received',
    UNDER_REVIEW: 'dsa.case.noticeStatus.underReview',
    DECIDED: 'dsa.case.noticeStatus.decided'
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
  readonly maxFiles = DsaCaseDialogComponent.MAX_FILES;
  // Appeal URL evidence state
  readonly appealUrls = signal<string[]>([]);
  readonly appealUrlViews = computed<readonly EvidenceUrlItem[]>(() =>
    this.appealUrls().map((url, index) => ({
      id: `${index}`,
      label: url,
      tooltip: url
    }))
  );
  readonly attachmentViews = computed<readonly EvidenceFileItem[]>(() =>
    this.attachments().map((file, index) => ({
      id: `${index}`,
      label: `${file.name} · ${this.formatBytes(file.size)}`,
      tooltip: `${file.name} · ${this.formatBytes(file.size)}`
    }))
  );
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
      return this.translation.t('dsa.case.signalReceived');
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

  private readonly service = inject(DsaStatusService);
  private readonly fb = inject(FormBuilder);
  private readonly snack = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  private readonly dialogRef = inject(MatDialogRef<DsaCaseDialogComponent>);
  private readonly dialogData = inject<{ token: string; message: Message }>(MAT_DIALOG_DATA);
  readonly data = this.dialogData;

  readonly appealForm = this.fb.nonNullable.group({
    arguments: ['', [Validators.required, Validators.minLength(20)]]
  });

  readonly publicStatusUrl = computed(() => this.buildPublicStatusUrl(this.data.token));

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
          ? this.translation.t('dsa.case.loadNotFound')
          : this.translation.t('dsa.case.loadFailed');
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

    if (this.attachments().length > DsaCaseDialogComponent.MAX_FILES) {
      this.snack.open(
        this.translation.t('dsa.case.filesCountLimit', { max: DsaCaseDialogComponent.MAX_FILES }),
        this.translation.t('common.actions.ok'),
        { duration: 4000, verticalPosition: 'top' }
      );
      return;
    }

    if (this.attachmentsSize() > DsaCaseDialogComponent.MAX_TOTAL_SIZE) {
      this.snack.open(
        this.translation.t('dsa.case.filesTotalLimit'),
        this.translation.t('common.actions.ok'),
        { duration: 4000, verticalPosition: 'top' }
      );
      return;
    }

    this.submitting.set(true);
    try {
      const { id } = await firstValueFrom(this.service.createAppeal(this.data.token, this.appealForm.getRawValue()));

      let uploadIssue = false;
      if (id && this.attachments().length > 0) {
        uploadIssue = !(await this.uploadAttachments(id));
      }

      // Upload URL evidence entries (if any)
      if (id && this.appealUrls().length > 0) {
        for (const url of this.appealUrls()) {
          try {
            await firstValueFrom(this.service.uploadAppealUrlEvidence(this.data.token, id, url));
          } catch (e) {
            uploadIssue = true;
            console.error('Failed to upload URL evidence', e);
          }
        }
      }

      const successMessage = uploadIssue
        ? this.translation.t('dsa.case.appealSubmittedPartial')
        : this.translation.t('dsa.case.appealSubmitted');

      this.snack.open(successMessage, this.translation.t('common.actions.ok'), { duration: 3500, verticalPosition: 'top' });
      if (!uploadIssue) {
        this.appealForm.reset();
        this.attachments.set([]);
        this.appealUrls.set([]);
        if (this.activeTab() !== 0) {
          this.activeTab.set(0);
        }
      }
      this.loadStatus();
    } catch (err) {
      const typed = err as { error?: { error?: string } };
      const msg = typed?.error?.error === 'decision_pending'
        ? this.translation.t('dsa.case.appealDecisionPending')
        : this.translation.t('dsa.case.appealSubmitFailed');
      this.snack.open(msg, this.translation.t('common.actions.ok'), { duration: 4000, verticalPosition: 'top' });
    } finally {
      this.submitting.set(false);
      this.uploading.set(false);
    }
  }

  onAppealUrlAdd(url: string): void {
    const exists = this.appealUrls().some(u => u.toLowerCase() === url.toLowerCase());
    if (exists) {
      this.snack.open(
        this.translation.t('dsa.case.urlAlreadyAdded'),
        this.translation.t('common.actions.ok'),
        { duration: 2500, verticalPosition: 'top' }
      );
      return;
    }
    this.appealUrls.update(arr => [...arr, url]);
  }

  onAttachmentsPicked(files: File[]): void {
    if (!files?.length) return;
    let rejected = false;
    let message: string | null = null;
    const currentFiles = [...this.attachments()];
    let currentSize = this.attachmentsSize();

    for (const file of files) {
      if (currentFiles.length >= DsaCaseDialogComponent.MAX_FILES) {
        rejected = true;
        message = this.translation.t('dsa.case.filesCountLimit', { max: DsaCaseDialogComponent.MAX_FILES });
        break;
      }
      if (!this.isAllowedFile(file)) {
        rejected = true;
        message = this.translation.t('dsa.case.filesTypeLimit');
        continue;
      }
      if (file.size > DsaCaseDialogComponent.MAX_FILE_SIZE) {
        rejected = true;
        message = this.translation.t('dsa.case.filesSizeLimit');
        continue;
      }
      if (currentSize + file.size > DsaCaseDialogComponent.MAX_TOTAL_SIZE) {
        rejected = true;
        message = this.translation.t('dsa.case.filesTotalLimit');
        continue;
      }
      currentSize += file.size;
      currentFiles.push(file);
    }

    this.attachments.set(currentFiles);
    if (rejected && message) {
      this.snack.open(message, this.translation.t('common.actions.ok'), { duration: 4000, verticalPosition: 'top' });
    }
  }

  removeAppealUrl(index: number): void {
    const next = [...this.appealUrls()];
    next.splice(index, 1);
    this.appealUrls.set(next);
  }

  onAppealUrlRemove(id: string): void {
    const idx = Number(id);
    if (Number.isNaN(idx)) return;
    this.removeAppealUrl(idx);
  }

  removeAttachment(index: number): void {
    const next = [...this.attachments()];
    next.splice(index, 1);
    this.attachments.set(next);
  }

  onAttachmentRemove(id: string): void {
    const idx = Number(id);
    if (Number.isNaN(idx)) return;
    this.removeAttachment(idx);
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
      error: () => this.snack.open(
        this.translation.t('dsa.case.downloadFailed'),
        this.translation.t('common.actions.ok'),
        { duration: 3000 }
      )
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

  // Expose normalized URL to the template to drive disabled/error state
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
    const key = DsaCaseDialogComponent.NOTICE_STATUS_LABELS[status.toUpperCase()];
    if (!key) return status;
    const translated = this.translation.t(key);
    return translated === key ? status : translated;
  }

  formatAppealOutcome(outcome: string | null | undefined): string {
    if (!outcome) return this.translation.t('dsa.case.appealOutcome.pending');
    switch (outcome.toUpperCase()) {
      case 'UPHELD':
        return this.translation.t('dsa.case.appealOutcome.upheld');
      case 'REVISED':
        return this.translation.t('dsa.case.appealOutcome.revised');
      case 'PARTIAL':
        return this.translation.t('dsa.case.appealOutcome.partial');
      case 'WITHDRAWN':
        return this.translation.t('dsa.case.appealOutcome.withdrawn');
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
