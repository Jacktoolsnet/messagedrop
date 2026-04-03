import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { finalize } from 'rxjs';
import { DialogActionBarComponent } from '../../../shared/dialog-action-bar/dialog-action-bar.component';
import { DialogHeaderComponent } from '../../../shared/dialog-header/dialog-header.component';
import { StickerSourceMetadata } from '../../../../interfaces/sticker-source-metadata.interface';
import { StickerAdminService } from '../../../../services/content/sticker-admin.service';
import { TranslationHelperService } from '../../../../services/translation-helper.service';

export interface StickerPackDialogData {
  title: string;
  initialName?: string;
  initialSourceReference?: string;
  initialLicenseNote?: string;
  initialSourceProvider?: string;
  initialSourceMetadata?: StickerSourceMetadata | null;
}

export interface StickerPackDialogResult {
  name: string;
  sourceReference: string;
  licenseNote: string;
  sourceProvider: string;
  sourceMetadata: StickerSourceMetadata | null;
}

@Component({
  selector: 'app-sticker-pack-dialog',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule,
    MatTooltipModule,
    DialogHeaderComponent,
    DialogActionBarComponent
  ],
  templateUrl: './sticker-pack-dialog.component.html',
  styleUrl: './sticker-pack-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StickerPackDialogComponent {
  private readonly dialogRef = inject(MatDialogRef<StickerPackDialogComponent, StickerPackDialogResult | null>);
  private readonly fb = inject(FormBuilder);
  private readonly stickerService = inject(StickerAdminService);

  protected readonly data = inject<StickerPackDialogData>(MAT_DIALOG_DATA);
  protected readonly i18n = inject(TranslationHelperService);
  protected readonly loadingMetadata = signal(false);
  protected readonly resolvedMetadata = signal<StickerSourceMetadata | null>(this.data.initialSourceMetadata ?? null);
  protected readonly metadataTags = computed(() => (this.resolvedMetadata()?.tags ?? []).join(', '));
  protected readonly metadataFormats = computed(() => (this.resolvedMetadata()?.downloadFormats ?? []).join(', ').toUpperCase());

  protected readonly form = this.fb.nonNullable.group({
    sourceReference: this.fb.nonNullable.control(this.data.initialSourceReference?.trim() ?? ''),
    name: this.fb.nonNullable.control(this.data.initialName?.trim() ?? '', {
      validators: [Validators.required, Validators.pattern(/\S/)]
    }),
    licenseNote: this.fb.nonNullable.control(this.data.initialLicenseNote?.trim() ?? '')
  });

  close(): void {
    this.dialogRef.close(null);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.dialogRef.close({
      sourceReference: this.form.controls.sourceReference.value.trim(),
      name: this.form.controls.name.value.trim(),
      licenseNote: this.form.controls.licenseNote.value.trim(),
      sourceProvider: this.resolvedMetadata()?.provider || this.data.initialSourceProvider || 'flaticon',
      sourceMetadata: this.resolvedMetadata()
    });
  }

  detectMetadata(): void {
    const sourceReference = this.form.controls.sourceReference.value.trim();
    if (!sourceReference || this.loadingMetadata()) {
      return;
    }

    this.loadingMetadata.set(true);
    this.stickerService.resolveFlaticonMetadata(sourceReference).pipe(
      finalize(() => this.loadingMetadata.set(false))
    ).subscribe({
      next: (response) => {
        this.resolvedMetadata.set(response.metadata);
        this.form.patchValue({
          sourceReference: response.suggested.sourceReference || sourceReference,
          name: response.suggested.name || this.form.controls.name.value,
          licenseNote: response.suggested.licenseNote || this.form.controls.licenseNote.value
        });
      },
      error: () => undefined
    });
  }
}
