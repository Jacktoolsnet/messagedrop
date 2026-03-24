import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { DsaTextBlock, DsaTextBlockType } from '../../../interfaces/dsa-text-block.interface';
import { DsaService } from '../../../services/dsa/dsa/dsa.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { DecisionTextBlockEditorDialogComponent } from './decision-text-block-editor-dialog/decision-text-block-editor-dialog.component';

@Component({
  selector: 'app-decision-text-blocks',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSlideToggleModule
  ],
  templateUrl: './decision-text-blocks.component.html',
  styleUrls: ['./decision-text-blocks.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DecisionTextBlocksComponent {
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly dsa = inject(DsaService);
  readonly i18n = inject(TranslationHelperService);

  readonly loading = signal(false);
  readonly rows = signal<DsaTextBlock[]>([]);

  readonly filterForm = this.fb.nonNullable.group({
    type: this.fb.nonNullable.control<DsaTextBlockType | ''>(''),
    q: this.fb.nonNullable.control(''),
    activeOnly: this.fb.nonNullable.control(true)
  });

  readonly activeCount = computed(() => this.rows().filter((row) => row.isActive).length);
  readonly typeOptions: { value: DsaTextBlockType | ''; label: string }[] = [
    { value: '', label: 'All text block types' },
    { value: 'reasoning_template', label: 'Reasoning templates' },
    { value: 'legal_basis', label: 'Legal bases' },
    { value: 'tos_clause', label: 'Terms of Use clauses' }
  ];

  constructor() {
    this.load();
    this.filterForm.valueChanges.pipe(
      debounceTime(180),
      map((value) => JSON.stringify(value)),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.load());
  }

  load(): void {
    const raw = this.filterForm.getRawValue();
    this.loading.set(true);
    this.dsa.listDecisionTextBlocks({
      type: raw.type || undefined,
      q: raw.q || undefined,
      activeOnly: raw.activeOnly
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        this.rows.set(rows || []);
        this.loading.set(false);
      },
      error: () => {
        this.rows.set([]);
        this.loading.set(false);
      }
    });
  }

  openCreateDialog(): void {
    this.dialog.open(DecisionTextBlockEditorDialogComponent, {
      width: 'min(92vw, 900px)',
      maxWidth: '95vw',
      data: { block: null }
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        if (saved) {
          this.load();
        }
      });
  }

  openEditDialog(row: DsaTextBlock): void {
    this.dialog.open(DecisionTextBlockEditorDialogComponent, {
      width: 'min(92vw, 900px)',
      maxWidth: '95vw',
      data: { block: row }
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((saved) => {
        if (saved) {
          this.load();
        }
      });
  }

  confirmDelete(row: DsaTextBlock): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete DSA text block?',
        message: 'The selected text block will be removed permanently. Existing decisions keep their stored text snapshots.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        warn: true
      }
    }).afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.dsa.deleteDecisionTextBlock(row.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: () => this.load(),
          error: () => undefined
        });
      });
  }

  displayEnglishLabel(row: DsaTextBlock): string {
    return row.labelEn || this.i18n.t('No English translation yet');
  }

  previewText(row: DsaTextBlock): string {
    const source = row.contentDe || row.descriptionDe || row.labelDe;
    return source.length > 180 ? `${source.slice(0, 179)}…` : source;
  }

  translationState(row: DsaTextBlock): string {
    if (!row.labelEn && !row.descriptionEn && !row.contentEn) {
      return this.i18n.t('Translation missing');
    }
    if (row.translatedAt && row.translatedAt >= row.updatedAt) {
      return this.i18n.t('Translation up to date');
    }
    return this.i18n.t('Translation needs review');
  }

  typeLabel(type: DsaTextBlockType): string {
    switch (type) {
      case 'reasoning_template':
        return this.i18n.t('Reasoning template');
      case 'legal_basis':
        return this.i18n.t('Legal basis');
      case 'tos_clause':
        return this.i18n.t('Terms of Use clause');
      default:
        return type;
    }
  }

  typeIcon(type: DsaTextBlockType): string {
    switch (type) {
      case 'reasoning_template':
        return 'article';
      case 'legal_basis':
        return 'gavel';
      case 'tos_clause':
        return 'rule';
      default:
        return 'notes';
    }
  }

  trackById(_index: number, row: DsaTextBlock): string {
    return row.id;
  }
}
