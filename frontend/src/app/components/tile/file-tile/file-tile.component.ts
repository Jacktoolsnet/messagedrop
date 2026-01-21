import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, inject, signal } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslocoPipe } from '@jsverse/transloco';
import { Contact } from '../../../interfaces/contact';
import { Place } from '../../../interfaces/place';
import { TileFileEntry, TileSetting } from '../../../interfaces/tile-settings';
import { ContactService } from '../../../services/contact.service';
import { PlaceService } from '../../../services/place.service';
import { TileFileService } from '../../../services/tile-file.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { getFileIcon } from '../../../utils/file-icon.util';
import { FileTileEditComponent } from './file-tile-edit/file-tile-edit.component';

@Component({
  selector: 'app-file-tile',
  standalone: true,
  imports: [MatIcon, DatePipe, TranslocoPipe],
  templateUrl: './file-tile.component.html',
  styleUrl: './file-tile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FileTileComponent implements OnChanges {
  @Input() tile!: TileSetting;
  @Input() place?: Place;
  @Input() contact?: Contact;

  private readonly dialog = inject(MatDialog);
  private readonly placeService = inject(PlaceService);
  private readonly contactService = inject(ContactService);
  private readonly fileTileService = inject(TileFileService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translation = inject(TranslationHelperService);

  readonly currentTile = signal<TileSetting | null>(null);

  ngOnChanges(): void {
    this.currentTile.set(this.tile);
  }

  get title(): string {
    const tile = this.currentTile();
    const fallback = this.translation.t('common.tileTypes.files');
    return tile?.payload?.title?.trim() || tile?.label || fallback;
  }

  get icon(): string {
    return this.currentTile()?.payload?.icon || 'attach_file';
  }

  get files(): TileFileEntry[] {
    const items = this.currentTile()?.payload?.files ?? [];
    return [...items]
      .map((file, index) => ({
        ...file,
        fileName: (file.fileName ?? '').trim(),
        order: Number.isFinite(file.order) ? file.order : index,
        addedAt: Number.isFinite(file.addedAt) ? file.addedAt : Date.now()
      }))
      .filter(file => file.fileName !== '')
      .sort((a, b) => a.order - b.order);
  }

  get hasFiles(): boolean {
    return this.files.length > 0;
  }

  openEditor(): void {
    const tile = this.currentTile();
    if (!tile) return;

    const dialogRef = this.dialog.open(FileTileEditComponent, {
      width: '560px',
      maxWidth: '95vw',
      maxHeight: '98vh',
      data: { tile },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((updated?: TileSetting) => {
      if (!updated) return;
      this.applyTileUpdate(updated);
    });
  }

  async openFile(file: TileFileEntry, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      await this.fileTileService.openFile(file);
    } catch {
      const message = this.fileTileService.lastErrorSignal() ?? this.translation.t('common.tiles.files.openFailed');
      this.snackBar.open(message, undefined, { duration: 4000 });
    }
  }

  getFileIcon(file: TileFileEntry): string {
    return getFileIcon(file.fileName, file.mimeType);
  }

  getFileDate(file: TileFileEntry): Date {
    return new Date(file.lastModified ?? file.addedAt);
  }

  private applyTileUpdate(updated: TileSetting): void {
    if (this.place) {
      const tiles = (this.place.tileSettings ?? []).map(t => t.id === updated.id ? { ...t, ...updated } : t);
      const updatedPlace = { ...this.place, tileSettings: tiles };
      this.place = updatedPlace;
      this.currentTile.set(updated);
      this.placeService.saveAdditionalPlaceInfos(updatedPlace);
    } else if (this.contact) {
      const tiles = (this.contact.tileSettings ?? []).map(t => t.id === updated.id ? { ...t, ...updated } : t);
      this.contact = { ...this.contact, tileSettings: tiles };
      this.currentTile.set(updated);
      this.contactService.saveContactTileSettings(this.contact);
      this.contactService.refreshContact(this.contact.id);
    }
    this.cdr.markForCheck();
  }
}
