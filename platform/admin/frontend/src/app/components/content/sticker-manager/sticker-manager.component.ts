import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { StickerCategory } from '../../../interfaces/sticker-category.interface';
import { StickerPack } from '../../../interfaces/sticker-pack.interface';
import { StickerSourceMetadata } from '../../../interfaces/sticker-source-metadata.interface';
import { StickerAdminService } from '../../../services/content/sticker-admin.service';
import { DisplayMessageService } from '../../../services/display-message.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';

@Component({
  selector: 'app-sticker-manager',
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
    MatProgressBarModule,
    MatTooltipModule
  ],
  templateUrl: './sticker-manager.component.html',
  styleUrls: ['./sticker-manager.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StickerManagerComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly stickerService = inject(StickerAdminService);

  readonly i18n = inject(TranslationHelperService);
  readonly categories = this.stickerService.categories;
  readonly packs = this.stickerService.packs;
  readonly stickers = this.stickerService.stickers;
  readonly loadingCategories = this.stickerService.loadingCategories;
  readonly loadingPacks = this.stickerService.loadingPacks;
  readonly loadingStickers = this.stickerService.loadingStickers;

  readonly selectedCategoryId = signal<string | null>(null);
  readonly selectedPackId = signal<string | null>(null);
  readonly isCreatingCategory = signal(false);
  readonly isCreatingPack = signal(false);
  readonly savingCategory = signal(false);
  readonly savingPack = signal(false);
  readonly loadingMetadata = signal(false);
  readonly importingSvg = signal(false);
  readonly selectedSvgFiles = signal<File[]>([]);
  readonly resolvedMetadata = signal<StickerSourceMetadata | null>(null);

  readonly categoryForm = this.fb.nonNullable.group({
    name: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    status: this.fb.nonNullable.control('active', { validators: [Validators.required] }),
    sortOrder: this.fb.nonNullable.control(0)
  });

  readonly packForm = this.fb.nonNullable.group({
    name: this.fb.nonNullable.control('', { validators: [Validators.required] }),
    status: this.fb.nonNullable.control('active', { validators: [Validators.required] }),
    searchVisible: this.fb.nonNullable.control(true),
    sortOrder: this.fb.nonNullable.control(0),
    sourceReference: this.fb.nonNullable.control(''),
    licenseNote: this.fb.nonNullable.control('')
  });

  readonly selectedCategory = computed(() => {
    const id = this.selectedCategoryId();
    return this.categories().find((row) => row.id === id) ?? null;
  });

  readonly selectedPack = computed(() => {
    const id = this.selectedPackId();
    return this.packs().find((row) => row.id === id) ?? null;
  });

  readonly pageBusy = computed(() => (
    this.loadingCategories()
    || this.loadingPacks()
    || this.loadingStickers()
    || this.savingCategory()
    || this.savingPack()
    || this.loadingMetadata()
    || this.importingSvg()
  ));

  readonly metadataTags = computed(() => (this.resolvedMetadata()?.tags ?? []).join(', '));
  readonly metadataFormats = computed(() => (this.resolvedMetadata()?.downloadFormats ?? []).join(', ').toUpperCase());

  constructor() {
    effect(() => {
      const rows = this.categories();
      if (this.loadingCategories()) {
        return;
      }
      if (rows.length === 0) {
        if (!this.isCreatingCategory()) {
          this.startNewCategory(false);
        }
        return;
      }
      if (this.isCreatingCategory()) {
        return;
      }
      const selectedId = this.selectedCategoryId();
      if (selectedId && rows.some((row) => row.id === selectedId)) {
        return;
      }
      this.selectCategory(rows[0]);
    }, { allowSignalWrites: true });

    effect(() => {
      const rows = this.packs();
      if (this.loadingPacks()) {
        return;
      }
      if (!this.selectedCategoryId()) {
        return;
      }
      if (rows.length === 0) {
        if (!this.isCreatingPack()) {
          this.startNewPack(false);
        }
        return;
      }
      if (this.isCreatingPack()) {
        return;
      }
      const selectedId = this.selectedPackId();
      if (selectedId && rows.some((row) => row.id === selectedId)) {
        return;
      }
      this.selectPack(rows[0]);
    }, { allowSignalWrites: true });

    this.stickerService.loadCategories();
  }

  trackById(_index: number, row: { id: string }): string {
    return row.id;
  }

  goBack(): void {
    void this.router.navigate(['/dashboard/content']);
  }

  refresh(): void {
    this.stickerService.loadCategories();
    if (this.selectedCategoryId()) {
      this.stickerService.loadPacks(this.selectedCategoryId()!);
    }
    if (this.selectedPackId()) {
      this.stickerService.loadStickers(this.selectedPackId()!);
    }
  }

  startNewCategory(markCreating = true): void {
    this.isCreatingCategory.set(markCreating);
    this.selectedCategoryId.set(null);
    this.categoryForm.reset({
      name: '',
      status: 'active',
      sortOrder: 0
    });
    this.categoryForm.markAsPristine();
    this.categoryForm.markAsUntouched();
    this.startNewPack(false);
    this.stickerService.loadPacks('');
  }

  selectCategory(row: StickerCategory): void {
    this.isCreatingCategory.set(false);
    this.selectedCategoryId.set(row.id);
    this.categoryForm.setValue({
      name: row.name ?? '',
      status: row.status ?? 'active',
      sortOrder: Number(row.sortOrder ?? 0)
    });
    this.categoryForm.markAsPristine();
    this.categoryForm.markAsUntouched();
    this.stickerService.loadPacks(row.id);
    this.selectedPackId.set(null);
    this.resolvedMetadata.set(null);
    this.selectedSvgFiles.set([]);
  }

  saveCategory(): void {
    if (this.savingCategory()) {
      return;
    }
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }

    const payload = this.categoryForm.getRawValue();
    const isNew = this.isCreatingCategory() || !this.selectedCategoryId();
    const request$ = isNew
      ? this.stickerService.createCategory(payload)
      : this.stickerService.updateCategory(this.selectedCategoryId()!, payload);

    this.savingCategory.set(true);
    request$.pipe(
      finalize(() => this.savingCategory.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (row) => {
        this.isCreatingCategory.set(false);
        this.selectedCategoryId.set(row.id);
        this.stickerService.loadCategories();
        this.stickerService.loadPacks(row.id);
        this.showMessage(isNew ? 'Sticker category created.' : 'Sticker category saved.');
      },
      error: () => undefined
    });
  }

  deleteSelectedCategory(): void {
    const category = this.selectedCategory();
    if (!category || this.savingCategory()) {
      return;
    }

    this.savingCategory.set(true);
    this.stickerService.deleteCategory(category.id).pipe(
      finalize(() => this.savingCategory.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.startNewCategory(false);
        this.stickerService.loadCategories();
        this.showMessage('Sticker category deleted.');
      },
      error: () => undefined
    });
  }

  startNewPack(markCreating = true): void {
    this.isCreatingPack.set(markCreating);
    this.selectedPackId.set(null);
    this.packForm.reset({
      name: '',
      status: 'active',
      searchVisible: true,
      sortOrder: 0,
      sourceReference: '',
      licenseNote: ''
    });
    this.resolvedMetadata.set(null);
    this.selectedSvgFiles.set([]);
    this.stickerService.loadStickers('');
    this.packForm.markAsPristine();
    this.packForm.markAsUntouched();
  }

  selectPack(row: StickerPack): void {
    this.isCreatingPack.set(false);
    this.selectedPackId.set(row.id);
    this.packForm.setValue({
      name: row.name ?? '',
      status: row.status ?? 'active',
      searchVisible: Boolean(row.searchVisible),
      sortOrder: Number(row.sortOrder ?? 0),
      sourceReference: row.sourceReference ?? '',
      licenseNote: row.licenseNote ?? ''
    });
    this.packForm.markAsPristine();
    this.packForm.markAsUntouched();
    this.resolvedMetadata.set(row.sourceMetadata ?? null);
    this.selectedSvgFiles.set([]);
    this.stickerService.loadStickers(row.id);
  }

  savePack(): void {
    if (this.savingPack()) {
      return;
    }
    const category = this.selectedCategory();
    if (!category) {
      this.showMessage('Please create or select a sticker category first.', true);
      return;
    }
    if (this.packForm.invalid) {
      this.packForm.markAllAsTouched();
      return;
    }

    const raw = this.packForm.getRawValue();
    const payload = {
      categoryId: category.id,
      name: raw.name.trim(),
      status: raw.status,
      searchVisible: Boolean(raw.searchVisible),
      sortOrder: Number(raw.sortOrder || 0),
      sourceProvider: this.resolvedMetadata()?.provider || 'flaticon',
      sourceReference: raw.sourceReference.trim(),
      sourceMetadata: this.resolvedMetadata(),
      licenseNote: raw.licenseNote.trim()
    };

    if (!payload.name) {
      this.packForm.controls.name.markAsTouched();
      return;
    }

    const isNew = this.isCreatingPack() || !this.selectedPackId();
    const request$ = isNew
      ? this.stickerService.createPack(payload)
      : this.stickerService.updatePack(this.selectedPackId()!, payload);

    this.savingPack.set(true);
    request$.pipe(
      finalize(() => this.savingPack.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (row) => {
        this.isCreatingPack.set(false);
        this.selectedPackId.set(row.id);
        this.stickerService.loadPacks(category.id);
        this.stickerService.loadStickers(row.id);
        this.showMessage(isNew ? 'Sticker pack created.' : 'Sticker pack saved.');
      },
      error: () => undefined
    });
  }

  deleteSelectedPack(): void {
    const category = this.selectedCategory();
    const pack = this.selectedPack();
    if (!category || !pack || this.savingPack()) {
      return;
    }

    this.savingPack.set(true);
    this.stickerService.deletePack(pack.id).pipe(
      finalize(() => this.savingPack.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.startNewPack(false);
        this.stickerService.loadPacks(category.id);
        this.showMessage('Sticker pack deleted.');
      },
      error: () => undefined
    });
  }

  resolveMetadata(): void {
    const sourceUrl = this.packForm.controls.sourceReference.value.trim();
    if (!sourceUrl) {
      this.showMessage('Please enter a Flaticon sticker pack URL first.', true);
      return;
    }

    this.loadingMetadata.set(true);
    this.stickerService.resolveFlaticonMetadata(sourceUrl).pipe(
      finalize(() => this.loadingMetadata.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.resolvedMetadata.set(response.metadata);
        this.packForm.patchValue({
          name: response.suggested.name || this.packForm.controls.name.value,
          sourceReference: response.suggested.sourceReference || sourceUrl,
          licenseNote: response.suggested.licenseNote || this.packForm.controls.licenseNote.value
        });
        this.showMessage('Sticker metadata loaded.');
      },
      error: () => undefined
    });
  }

  triggerSvgPicker(input: HTMLInputElement): void {
    input.click();
  }

  handleSvgSelection(event: Event): void {
    const input = event.target as HTMLInputElement;
    const fileList = Array.from(input.files ?? []);
    if (fileList.length === 0) {
      this.selectedSvgFiles.set([]);
      return;
    }
    const invalid = fileList.find((file) => !this.isSvgFile(file));
    if (invalid) {
      this.showMessage('Only SVG files are allowed.', true);
      input.value = '';
      return;
    }
    this.selectedSvgFiles.set(fileList);
  }

  importSelectedSvgFiles(input: HTMLInputElement): void {
    const pack = this.selectedPack();
    const category = this.selectedCategory();
    const files = this.selectedSvgFiles();
    if (!pack || !category) {
      this.showMessage('Please save the sticker pack first.', true);
      return;
    }
    if (files.length === 0) {
      this.showMessage('Please select at least one SVG file.', true);
      return;
    }

    this.importingSvg.set(true);
    this.stickerService.importSvgFiles(pack.id, files).pipe(
      finalize(() => this.importingSvg.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (result) => {
        input.value = '';
        this.selectedSvgFiles.set([]);
        this.stickerService.loadPacks(category.id);
        this.stickerService.loadStickers(pack.id);
        this.showMessage('SVG import completed: {{created}} created, {{updated}} updated.', false, {
          created: result.createdCount,
          updated: result.updatedCount
        });
      },
      error: () => undefined
    });
  }

  statusLabel(status: string | null | undefined): string {
    const normalized = String(status || '').toLowerCase();
    switch (normalized) {
      case 'hidden':
        return this.i18n.t('Hidden');
      case 'blocked':
        return this.i18n.t('Blocked');
      case 'deleted':
        return this.i18n.t('Deleted');
      case 'active':
      default:
        return this.i18n.t('Active');
    }
  }

  private isSvgFile(file: File): boolean {
    return file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  }

  private showMessage(message: string, isError = false, params?: Record<string, unknown>): void {
    this.snackBar.open(this.i18n.t(message, params), this.i18n.t('OK'), {
      duration: 3000,
      panelClass: [isError ? 'snack-error' : 'snack-success'],
      horizontalPosition: 'center',
      verticalPosition: 'top'
    });
  }
}
