import { A11yModule } from '@angular/cdk/a11y';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIcon } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { TileFileEntry, TileSetting } from '../../../../interfaces/tile-settings';
import { TileFileService } from '../../../../services/tile-file.service';
import { TranslationHelperService } from '../../../../services/translation-helper.service';
import { getFileIcon } from '../../../../utils/file-icon.util';
import { isQuotaExceededError } from '../../../../utils/storage-error.util';
import { HelpDialogService } from '../../../utils/help-dialog/help-dialog.service';
import { DialogHeaderComponent } from '../../../utils/dialog-header/dialog-header.component';
import {
  TileDisplaySettingsDialogComponent,
  TileDisplaySettingsDialogData,
  TileDisplaySettingsDialogResult
} from '../../tile-display-settings-dialog/tile-display-settings-dialog.component';

interface FileTileDialogData {
  tile: TileSetting;
  onTileCommit?: (updated: TileSetting) => void;
}

@Component({
  selector: 'app-file-tile-edit',
  standalone: true,
  imports: [
    DialogHeaderComponent,
    ReactiveFormsModule,
    MatDialogModule,
    MatDialogContent,
    MatDialogActions,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIcon,
    A11yModule,
    CdkDrag,
    CdkDropList,
    CdkDragHandle,
    DatePipe,
    TranslocoPipe
  ],
  templateUrl: './file-tile-edit.component.html',
  styleUrl: './file-tile-edit.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FileTileEditComponent {
  private readonly dialogRef = inject(MatDialogRef<FileTileEditComponent>);
  private readonly dialog = inject(MatDialog);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly fileTileService = inject(TileFileService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translation = inject(TranslationHelperService);
  readonly help = inject(HelpDialogService);
  readonly data = inject<FileTileDialogData>(MAT_DIALOG_DATA);
  private readonly fallbackTitle = this.translation.t('common.tileTypes.files');

  private readonly initialFiles = this.normalizeFiles(this.data.tile.payload?.files);
  readonly titleControl = new FormControl(
    this.data.tile.payload?.title ?? this.data.tile.label ?? this.fallbackTitle,
    { nonNullable: true }
  );
  readonly icon = signal<string | undefined>(this.data.tile.payload?.icon);
  readonly files = signal<TileFileEntry[]>(this.initialFiles);
  private readonly pendingHandles = new Map<string, FileSystemFileHandle>();

  get headerTitle(): string {
    return this.titleControl.value.trim() || this.fallbackTitle;
  }

  get headerIcon(): string {
    return this.icon() || 'attach_file';
  }

  get hasFiles(): boolean {
    return this.files().length > 0;
  }

  openDisplaySettings(): void {
    const ref = this.dialog.open<TileDisplaySettingsDialogComponent, TileDisplaySettingsDialogData, TileDisplaySettingsDialogResult | undefined>(
      TileDisplaySettingsDialogComponent,
      {
        width: '460px',
        maxWidth: '95vw',
        data: {
          title: this.headerTitle,
          icon: this.icon(),
          fallbackTitle: this.fallbackTitle,
          dialogTitleKey: 'common.tileEdit.displaySettingsTitle'
        },
        hasBackdrop: true,
        backdropClass: 'dialog-backdrop',
        disableClose: false,
      }
    );

    ref.afterClosed().subscribe((result) => {
      if (!result) {
        return;
      }
      this.titleControl.setValue(result.title);
      this.icon.set(result.icon);
      this.cdr.markForCheck();
      this.commitDisplaySettings();
    });
  }

  async addFiles(): Promise<void> {
    if (!this.fileTileService.isSupported()) {
      this.snackBar.open(this.translation.t('common.tiles.files.pickerUnsupported'), undefined, { duration: 4000 });
      return;
    }

    let picked: { entry: TileFileEntry; handle: FileSystemFileHandle }[] = [];
    try {
      picked = await this.fileTileService.pickFiles();
    } catch (error) {
      const message = isQuotaExceededError(error)
        ? this.translation.t('common.tiles.files.storageFull')
        : this.fileTileService.lastErrorSignal() ?? this.translation.t('common.tiles.files.saveHandlesFailed');
      this.snackBar.open(message, undefined, { duration: 4000 });
      return;
    }
    if (!picked.length) {
      const message = this.fileTileService.lastErrorSignal();
      if (message) {
        this.snackBar.open(message, undefined, { duration: 4000 });
      }
      return;
    }

    const updated = [...this.files()];
    picked.forEach(({ entry, handle }) => {
      this.pendingHandles.set(entry.id, handle);
      updated.push({ ...entry, order: updated.length });
    });

    this.files.set(this.normalizeFiles(updated));
  }

  deleteFile(file: TileFileEntry): void {
    this.files.set(this.files().filter(item => item.id !== file.id));
    if (this.pendingHandles.has(file.id)) {
      this.pendingHandles.delete(file.id);
    }
  }

  drop(event: CdkDragDrop<TileFileEntry[]>) {
    const updated = [...this.files()];
    moveItemInArray(updated, event.previousIndex, event.currentIndex);
    this.files.set(updated.map((file, index) => ({ ...file, order: index })));
  }

  async openFile(file: TileFileEntry): Promise<void> {
    try {
      const pendingHandle = this.pendingHandles.get(file.id);
      await this.fileTileService.openFile(file, pendingHandle);
    } catch {
      const message = this.fileTileService.lastErrorSignal() ?? this.translation.t('common.tiles.files.openFailed');
      this.snackBar.open(message, undefined, { duration: 4000 });
    }
  }

  cancel(): void {
    this.dialogRef.close();
  }

  async save(): Promise<void> {
    const title = this.titleControl.value.trim() || this.fallbackTitle;
    const files = this.normalizeFiles(this.files()).map((file, index) => ({ ...file, order: index }));
    const removedFiles = this.initialFiles
      .filter(initial => !files.some(current => current.id === initial.id));

    try {
      for (const [id, handle] of this.pendingHandles.entries()) {
        await this.fileTileService.storeHandle(id, handle);
      }

      await Promise.all(removedFiles.map(file => this.fileTileService.deleteHandle(file)));
    } catch (error) {
      console.error('Failed to persist file handles', error);
      const message = isQuotaExceededError(error)
        ? this.translation.t('common.tiles.files.storageFull')
        : this.translation.t('common.tiles.files.saveHandlesFailed');
      this.snackBar.open(message, undefined, { duration: 4000 });
      return;
    }

    const updated: TileSetting = {
      ...this.data.tile,
      label: title,
      payload: {
        ...this.data.tile.payload,
        title,
        icon: this.icon(),
        files
      }
    };

    this.dialogRef.close(updated);
  }

  getFileIcon(file: TileFileEntry): string {
    return getFileIcon(file.fileName, file.mimeType);
  }

  getFileDate(file: TileFileEntry): Date {
    return new Date(file.lastModified ?? file.addedAt);
  }

  private normalizeFiles(files?: TileFileEntry[]): TileFileEntry[] {
    return (files ?? [])
      .map((file, index) => ({
        id: file.id || this.createFileId(),
        fileName: (file.fileName ?? '').trim(),
        mimeType: file.mimeType,
        size: Number.isFinite(file.size) ? file.size : undefined,
        lastModified: Number.isFinite(file.lastModified) ? file.lastModified : undefined,
        addedAt: Number.isFinite(file.addedAt) ? file.addedAt : Date.now(),
        order: Number.isFinite(file.order) ? file.order : index
      }))
      .filter(file => file.fileName !== '')
      .sort((a, b) => a.order - b.order);
  }

  private createFileId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `file-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private commitDisplaySettings(): void {
    const title = this.titleControl.value.trim() || this.fallbackTitle;
    const updated: TileSetting = {
      ...this.data.tile,
      label: title,
      payload: {
        ...this.data.tile.payload,
        title,
        icon: this.icon()
      }
    };
    this.data.tile = updated;
    this.data.onTileCommit?.(updated);
  }
}
