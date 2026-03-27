import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { merge } from 'rxjs';
import { DsaDecisionOutcome, DsaTextBlock, DsaTextBlockSavePayload, DsaTextBlockType } from '../../../../interfaces/dsa-text-block.interface';
import { DsaService } from '../../../../services/dsa/dsa/dsa.service';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { DialogActionBarComponent } from '../../../shared/dialog-action-bar/dialog-action-bar.component';
import { DialogHeaderComponent } from '../../../shared/dialog-header/dialog-header.component';

export interface DecisionTextBlockEditorDialogData {
  block?: DsaTextBlock | null;
}

@Component({
  selector: 'app-decision-text-block-editor-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
    DialogHeaderComponent,
    DialogActionBarComponent
  ],
  templateUrl: './decision-text-block-editor-dialog.component.html',
  styleUrls: ['./decision-text-block-editor-dialog.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DecisionTextBlockEditorDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snack = inject(MatSnackBar);
  private readonly dsa = inject(DsaService);
  private readonly dialogRef = inject(MatDialogRef<DecisionTextBlockEditorDialogComponent, boolean>);
  readonly i18n = inject(TranslationHelperService);
  readonly data = inject<DecisionTextBlockEditorDialogData>(MAT_DIALOG_DATA, { optional: true }) || {};

  readonly saving = signal(false);
  readonly translating = signal(false);
  readonly translatedAt = signal<number | null>(this.data.block?.translatedAt ?? null);
  private lastTranslatedFingerprint = '';

  readonly typeOptions: { value: DsaTextBlockType; label: string }[] = [
    { value: 'reasoning_template', label: 'Reasoning template' },
    { value: 'legal_basis', label: 'Legal basis' },
    { value: 'tos_clause', label: 'Terms of Use clause' }
  ];
  readonly decisionOutcomeOptions: { value: DsaDecisionOutcome; label: string }[] = [
    { value: 'NO_ACTION', label: 'No action' },
    { value: 'RESTRICT', label: 'Restrict visibility' },
    { value: 'FORWARD_TO_AUTHORITY', label: 'Forward to authority' },
    { value: 'REMOVE_CONTENT', label: 'Remove content' }
  ];

  readonly form = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<DsaTextBlockType>(this.data.block?.type ?? 'reasoning_template', { validators: [Validators.required] }),
    decisionOutcomes: this.fb.nonNullable.control<DsaDecisionOutcome[]>(
      this.data.block?.decisionOutcomes?.length ? this.data.block.decisionOutcomes : ['RESTRICT']
    ),
    labelDe: this.fb.nonNullable.control(this.data.block?.labelDe ?? '', { validators: [Validators.required] }),
    descriptionDe: this.fb.nonNullable.control(this.data.block?.descriptionDe ?? ''),
    contentDe: this.fb.nonNullable.control(this.data.block?.contentDe ?? ''),
    labelEn: this.fb.nonNullable.control(this.data.block?.labelEn ?? ''),
    descriptionEn: this.fb.nonNullable.control(this.data.block?.descriptionEn ?? ''),
    contentEn: this.fb.nonNullable.control(this.data.block?.contentEn ?? ''),
    sortOrder: this.fb.nonNullable.control(this.data.block?.sortOrder ?? 0),
    isActive: this.fb.nonNullable.control(this.data.block?.isActive ?? true)
  });

  readonly isEditing = computed(() => !!this.data.block?.id);
  readonly requiresContent = computed(() => this.form.controls.type.value === 'reasoning_template');
  readonly title = computed(() => this.isEditing() ? this.i18n.t('Edit DSA text block') : this.i18n.t('Create DSA text block'));

  constructor() {
    this.syncContentValidators(this.form.controls.type.value);
    this.lastTranslatedFingerprint = this.germanFingerprint();

    this.form.controls.type.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((type) => this.syncContentValidators(type));

    merge(
      this.form.controls.labelDe.valueChanges,
      this.form.controls.descriptionDe.valueChanges,
      this.form.controls.contentDe.valueChanges
    ).pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.germanFingerprint() !== this.lastTranslatedFingerprint) {
          this.translatedAt.set(null);
        }
      });
  }

  close(): void {
    this.dialogRef.close(false);
  }

  translateToEnglish(): void {
    if (this.translating()) {
      return;
    }

    if (this.form.controls.labelDe.invalid || (this.requiresContent() && this.form.controls.contentDe.invalid)) {
      this.form.controls.labelDe.markAsTouched();
      this.form.controls.contentDe.markAsTouched();
      this.form.controls.decisionOutcomes.markAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.translating.set(true);
    this.dsa.translateDecisionTextBlockPreview({
      labelDe: raw.labelDe.trim(),
      descriptionDe: raw.descriptionDe.trim(),
      contentDe: raw.contentDe.trim()
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (preview) => {
        this.form.patchValue({
          labelEn: preview.labelEn || '',
          descriptionEn: preview.descriptionEn || '',
          contentEn: preview.contentEn || ''
        }, { emitEvent: false });
        this.translatedAt.set(preview.translatedAt ?? Date.now());
        this.lastTranslatedFingerprint = this.germanFingerprint();
        const message = preview.usedFallback
          ? 'DeepL is not configured. English fields were copied from German.'
          : 'English translation updated.';
        this.snack.open(this.i18n.t(message), this.i18n.t('OK'), { duration: 3000 });
        this.translating.set(false);
      },
      error: () => {
        this.translating.set(false);
      }
    });
  }

  save(): void {
    if (this.saving()) {
      return;
    }

    this.syncContentValidators(this.form.controls.type.value);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const payload: DsaTextBlockSavePayload = {
      type: raw.type,
      labelDe: raw.labelDe.trim(),
      descriptionDe: raw.descriptionDe.trim(),
      contentDe: this.requiresContent() ? raw.contentDe.trim() : '',
      decisionOutcomes: this.requiresContent() ? raw.decisionOutcomes : [],
      labelEn: raw.labelEn.trim(),
      descriptionEn: raw.descriptionEn.trim(),
      contentEn: this.requiresContent() ? raw.contentEn.trim() : '',
      sortOrder: Number(raw.sortOrder || 0),
      isActive: raw.isActive,
      translatedAt: this.translatedAt()
    };

    this.saving.set(true);
    const request$ = this.data.block?.id
      ? this.dsa.updateDecisionTextBlock(this.data.block.id, payload)
      : this.dsa.createDecisionTextBlock(payload);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.snack.open(this.i18n.t(this.data.block?.id ? 'DSA text block saved.' : 'DSA text block created.'), this.i18n.t('OK'), { duration: 2500 });
        this.dialogRef.close(true);
      },
      error: () => {
        this.saving.set(false);
      }
    });
  }

  private syncContentValidators(type: DsaTextBlockType): void {
    const validators = type === 'reasoning_template' ? [Validators.required] : [];
    this.form.controls.contentDe.setValidators(validators);
    this.form.controls.contentDe.updateValueAndValidity({ emitEvent: false });
    this.form.controls.decisionOutcomes.setValidators(validators);
    this.form.controls.decisionOutcomes.updateValueAndValidity({ emitEvent: false });

    if (type !== 'reasoning_template') {
      this.form.controls.decisionOutcomes.setValue([], { emitEvent: false });
      return;
    }

    if (this.form.controls.decisionOutcomes.value.length === 0) {
      this.form.controls.decisionOutcomes.setValue(['RESTRICT'], { emitEvent: false });
    }
  }

  private germanFingerprint(): string {
    const raw = this.form.getRawValue();
    return JSON.stringify({
      labelDe: raw.labelDe.trim(),
      descriptionDe: raw.descriptionDe.trim(),
      contentDe: raw.contentDe.trim()
    });
  }
}
