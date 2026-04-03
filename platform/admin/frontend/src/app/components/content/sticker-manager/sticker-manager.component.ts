import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { StickerCategory } from '../../../interfaces/sticker-category.interface';
import { StickerPack } from '../../../interfaces/sticker-pack.interface';
import { StickerAdminService } from '../../../services/content/sticker-admin.service';
import { DisplayMessageService } from '../../../services/display-message.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { StickerCategoryNameDialogComponent } from './sticker-category-name-dialog/sticker-category-name-dialog.component';
import { StickerPackDialogComponent, StickerPackDialogResult } from './sticker-pack-dialog/sticker-pack-dialog.component';

@Component({
  selector: 'app-sticker-manager',
  imports: [
    CommonModule,
    RouterLink,
    DragDropModule,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatMenuModule,
    MatProgressBarModule,
    MatTooltipModule
  ],
  templateUrl: './sticker-manager.component.html',
  styleUrls: ['./sticker-manager.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StickerManagerComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly stickerService = inject(StickerAdminService);

  readonly i18n = inject(TranslationHelperService);
  readonly categories = this.stickerService.categories;
  readonly packs = this.stickerService.packs;
  readonly stickers = this.stickerService.stickers;
  readonly loadingCategories = this.stickerService.loadingCategories;
  readonly loadingPacks = this.stickerService.loadingPacks;
  readonly loadingStickers = this.stickerService.loadingStickers;

  readonly categoryRows = signal<StickerCategory[]>([]);
  readonly packRows = signal<StickerPack[]>([]);
  readonly selectedCategoryId = signal<string | null>(null);
  readonly selectedPackId = signal<string | null>(null);
  readonly savingCategory = signal(false);
  readonly savingPack = signal(false);
  readonly importingSvg = signal(false);
  readonly selectedSvgFiles = signal<File[]>([]);
  readonly categoryStatuses = ['active', 'hidden', 'blocked', 'deleted'] as const;
  readonly packStatuses = ['active', 'hidden', 'blocked', 'deleted'] as const;
  readonly packVisibilityOptions = [true, false] as const;

  readonly selectedCategory = computed(() => {
    const id = this.selectedCategoryId();
    return this.categoryRows().find((row) => row.id === id) ?? null;
  });

  readonly selectedPack = computed(() => {
    const id = this.selectedPackId();
    return this.packRows().find((row) => row.id === id) ?? null;
  });

  readonly pageBusy = computed(() => (
    this.loadingCategories()
    || this.loadingPacks()
    || this.loadingStickers()
    || this.savingCategory()
    || this.savingPack()
    || this.importingSvg()
  ));

  constructor() {
    effect(() => {
      this.categoryRows.set(this.sortCategories(this.categories()));
    }, { allowSignalWrites: true });

    effect(() => {
      const rows = this.categoryRows();
      if (this.loadingCategories()) {
        return;
      }
      if (rows.length === 0) {
        this.selectedCategoryId.set(null);
        this.selectedPackId.set(null);
        this.selectedSvgFiles.set([]);
        this.stickerService.loadPacks('');
        this.stickerService.loadStickers('');
        return;
      }
      const selectedId = this.selectedCategoryId();
      if (selectedId && rows.some((row) => row.id === selectedId)) {
        return;
      }
      this.selectCategory(rows[0]);
    }, { allowSignalWrites: true });

    effect(() => {
      this.packRows.set(this.sortPacks(this.packs()));
    }, { allowSignalWrites: true });

    effect(() => {
      const rows = this.packRows();
      if (this.loadingPacks()) {
        return;
      }
      if (!this.selectedCategoryId()) {
        this.selectedPackId.set(null);
        this.selectedSvgFiles.set([]);
        this.stickerService.loadStickers('');
        return;
      }
      if (rows.length === 0) {
        this.selectedPackId.set(null);
        this.selectedSvgFiles.set([]);
        this.stickerService.loadStickers('');
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

  refresh(): void {
    this.stickerService.loadCategories();
    if (this.selectedCategoryId()) {
      this.stickerService.loadPacks(this.selectedCategoryId()!);
    }
    if (this.selectedPackId()) {
      this.stickerService.loadStickers(this.selectedPackId()!);
    }
  }

  selectCategory(row: StickerCategory): void {
    this.selectedCategoryId.set(row.id);
    this.selectedPackId.set(null);
    this.selectedSvgFiles.set([]);
    this.stickerService.loadPacks(row.id);
    this.stickerService.loadStickers('');
  }

  setSelectedCategory(row: StickerCategory): void {
    this.selectCategory(row);
  }

  openCreateCategoryDialog(): void {
    if (this.savingCategory()) {
      return;
    }

    this.dialog.open(StickerCategoryNameDialogComponent, {
      width: '420px',
      autoFocus: false,
      data: { title: 'Create category' }
    }).afterClosed().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((name) => {
      if (!name) {
        return;
      }

      this.savingCategory.set(true);
      this.stickerService.createCategory({
        name,
        status: 'active',
        sortOrder: this.getNextCategorySortOrder()
      }).pipe(
        finalize(() => this.savingCategory.set(false)),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (row) => {
          this.upsertCategoryRow(row);
          this.selectCategory(row);
          this.stickerService.loadCategories();
          this.showMessage('Sticker category created.');
        },
        error: () => undefined
      });
    });
  }

  openEditCategoryDialog(row: StickerCategory): void {
    if (this.savingCategory()) {
      return;
    }

    this.dialog.open(StickerCategoryNameDialogComponent, {
      width: '420px',
      autoFocus: false,
      data: {
        title: 'Edit category',
        initialName: row.name
      }
    }).afterClosed().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((name) => {
      if (!name || name === row.name) {
        return;
      }

      this.savingCategory.set(true);
      this.stickerService.updateCategory(row.id, {
        name,
        status: row.status,
        sortOrder: row.sortOrder
      }).pipe(
        finalize(() => this.savingCategory.set(false)),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe({
        next: (updatedRow) => {
          this.upsertCategoryRow(updatedRow);
          this.stickerService.loadCategories();
          this.showMessage('Sticker category saved.');
        },
        error: () => undefined
      });
    });
  }

  updateCategoryStatus(row: StickerCategory, status: StickerCategory['status']): void {
    if (this.savingCategory() || row.status === status) {
      return;
    }

    this.savingCategory.set(true);
    this.stickerService.updateCategory(row.id, {
      name: row.name,
      status,
      sortOrder: row.sortOrder
    }).pipe(
      finalize(() => this.savingCategory.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (updatedRow) => {
        this.upsertCategoryRow(updatedRow);
        this.stickerService.loadCategories();
        this.showMessage('Category status updated.');
      },
      error: () => undefined
    });
  }

  dropCategory(event: CdkDragDrop<StickerCategory[]>): void {
    if (this.savingCategory() || event.previousIndex === event.currentIndex) {
      return;
    }

    const previousRows = this.categoryRows();
    const reorderedRows = [...previousRows];
    moveItemInArray(reorderedRows, event.previousIndex, event.currentIndex);

    const updatedRows = reorderedRows.map((row, index) => ({
      ...row,
      sortOrder: index
    }));

    this.categoryRows.set(updatedRows);

    const changedRows = updatedRows.filter((row) => (
      previousRows.find((previousRow) => previousRow.id === row.id)?.sortOrder !== row.sortOrder
    ));

    if (changedRows.length === 0) {
      return;
    }

    this.savingCategory.set(true);
    forkJoin(changedRows.map((row) => this.stickerService.updateCategory(row.id, {
      name: row.name,
      status: row.status,
      sortOrder: row.sortOrder
    }))).pipe(
      finalize(() => this.savingCategory.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.stickerService.loadCategories();
        this.showMessage('Category order saved.');
      },
      error: () => {
        this.stickerService.loadCategories();
      }
    });
  }

  selectPack(row: StickerPack): void {
    this.selectedPackId.set(row.id);
    this.selectedSvgFiles.set([]);
    this.stickerService.loadStickers(row.id);
  }

  setSelectedPack(row: StickerPack): void {
    this.selectPack(row);
  }

  openCreatePackDialog(): void {
    const category = this.selectedCategory();
    if (!category) {
      this.showMessage('Please create or select a sticker category first.', true);
      return;
    }
    if (this.savingPack()) {
      return;
    }

    this.dialog.open(StickerPackDialogComponent, {
      width: '480px',
      autoFocus: false,
      data: { title: 'Create pack' }
    }).afterClosed().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((result) => {
      if (!result) {
        return;
      }
      this.createPack(category, result);
    });
  }

  openEditPackDialog(row: StickerPack): void {
    if (this.savingPack()) {
      return;
    }

    this.dialog.open(StickerPackDialogComponent, {
      width: '480px',
      autoFocus: false,
      data: {
        title: 'Edit pack',
        initialName: row.name,
        initialSourceReference: row.sourceReference,
        initialLicenseNote: row.licenseNote,
        initialSourceProvider: row.sourceProvider,
        initialSourceMetadata: row.sourceMetadata
      }
    }).afterClosed().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((result) => {
      if (!result) {
        return;
      }
      this.savePackRow(row, result);
    });
  }

  updatePackStatus(row: StickerPack, status: StickerPack['status']): void {
    if (this.savingPack() || row.status === status) {
      return;
    }

    this.persistPackUpdate(row, {
      status
    }, 'Pack status updated.');
  }

  updatePackVisibility(row: StickerPack, searchVisible: boolean): void {
    if (this.savingPack() || row.searchVisible === searchVisible) {
      return;
    }

    this.persistPackUpdate(row, {
      searchVisible
    }, 'Pack visibility updated.');
  }

  dropPack(event: CdkDragDrop<StickerPack[]>): void {
    const category = this.selectedCategory();
    if (!category || this.savingPack() || event.previousIndex === event.currentIndex) {
      return;
    }

    const previousRows = this.packRows();
    const reorderedRows = [...previousRows];
    moveItemInArray(reorderedRows, event.previousIndex, event.currentIndex);

    const updatedRows = reorderedRows.map((row, index) => ({
      ...row,
      sortOrder: index
    }));

    this.packRows.set(updatedRows);

    const changedRows = updatedRows.filter((row) => (
      previousRows.find((previousRow) => previousRow.id === row.id)?.sortOrder !== row.sortOrder
    ));

    if (changedRows.length === 0) {
      return;
    }

    this.savingPack.set(true);
    forkJoin(changedRows.map((row) => this.stickerService.updatePack(row.id, this.buildPackPayload(row)))).pipe(
      finalize(() => this.savingPack.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => {
        this.stickerService.loadPacks(category.id);
        this.showMessage('Pack order saved.');
      },
      error: () => {
        this.stickerService.loadPacks(category.id);
      }
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

  visibilityLabel(searchVisible: boolean): string {
    return this.i18n.t(searchVisible ? 'Visible in search' : 'Hidden in search');
  }

  private createPack(category: StickerCategory, result: StickerPackDialogResult): void {
    this.savingPack.set(true);
      this.stickerService.createPack({
        categoryId: category.id,
        name: result.name,
        sourceProvider: result.sourceProvider || 'flaticon',
        sourceReference: result.sourceReference,
        sourceMetadata: result.sourceMetadata,
        licenseNote: result.licenseNote,
        status: 'active',
        searchVisible: true,
      sortOrder: this.getNextPackSortOrder()
    }).pipe(
      finalize(() => this.savingPack.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (row) => {
        this.upsertPackRow(row);
        this.selectPack(row);
        this.stickerService.loadPacks(category.id);
        this.showMessage('Sticker pack created.');
      },
      error: () => undefined
    });
  }

  private savePackRow(row: StickerPack, result: StickerPackDialogResult): void {
    this.persistPackUpdate(row, {
      name: result.name,
      sourceProvider: result.sourceProvider,
      sourceReference: result.sourceReference,
      sourceMetadata: result.sourceMetadata,
      licenseNote: result.licenseNote
    }, 'Sticker pack saved.');
  }

  private persistPackUpdate(
    row: StickerPack,
    patch: Partial<StickerPack>,
    successMessage: string,
    reloadAfterSave = true
  ): void {
    const category = this.selectedCategory();
    if (!category) {
      return;
    }

    this.savingPack.set(true);
    const updatedRow: StickerPack = {
      ...row,
      ...patch
    };

    this.stickerService.updatePack(row.id, this.buildPackPayload(updatedRow)).pipe(
      finalize(() => this.savingPack.set(false)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (savedRow) => {
        this.upsertPackRow(savedRow);
        if (savedRow.id === this.selectedPackId()) {
          this.selectPack(savedRow);
        }
        if (reloadAfterSave) {
          this.stickerService.loadPacks(category.id);
        }
        this.showMessage(successMessage);
      },
      error: () => undefined
    });
  }

  private buildPackPayload(row: StickerPack): Partial<StickerPack> {
    return {
      categoryId: row.categoryId,
      name: row.name,
      status: row.status,
      searchVisible: row.searchVisible,
      sortOrder: row.sortOrder,
      sourceProvider: row.sourceProvider || 'flaticon',
      sourceReference: row.sourceReference,
      sourceMetadata: row.sourceMetadata,
      licenseNote: row.licenseNote
    };
  }

  private sortCategories(rows: StickerCategory[]): StickerCategory[] {
    return [...rows].sort((a, b) => (
      Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)
      || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    ));
  }

  private sortPacks(rows: StickerPack[]): StickerPack[] {
    return [...rows].sort((a, b) => (
      Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0)
      || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    ));
  }

  private upsertCategoryRow(row: StickerCategory): void {
    const rows = [...this.categoryRows()];
    const index = rows.findIndex((currentRow) => currentRow.id === row.id);
    if (index >= 0) {
      rows[index] = row;
    } else {
      rows.push(row);
    }
    this.categoryRows.set(this.sortCategories(rows));
  }

  private upsertPackRow(row: StickerPack): void {
    const rows = [...this.packRows()];
    const index = rows.findIndex((currentRow) => currentRow.id === row.id);
    if (index >= 0) {
      rows[index] = row;
    } else {
      rows.push(row);
    }
    this.packRows.set(this.sortPacks(rows));
  }

  private getNextCategorySortOrder(): number {
    return this.categoryRows().reduce((maxValue, row) => Math.max(maxValue, Number(row.sortOrder ?? 0)), -1) + 1;
  }

  private getNextPackSortOrder(): number {
    return this.packRows().reduce((maxValue, row) => Math.max(maxValue, Number(row.sortOrder ?? 0)), -1) + 1;
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
