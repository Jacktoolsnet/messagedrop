import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, Input, OnChanges, effect, inject, signal } from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { MatIcon } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';
import { BoundingBox } from '../../../interfaces/bounding-box';
import { Contact } from '../../../interfaces/contact';
import { LocalDocument } from '../../../interfaces/local-document';
import { Place } from '../../../interfaces/place';
import { TileFileEntry, TileSetting } from '../../../interfaces/tile-settings';
import { ContactService } from '../../../services/contact.service';
import { LocalDocumentService } from '../../../services/local-document.service';
import { PlaceService } from '../../../services/place.service';
import { TileFileService } from '../../../services/tile-file.service';
import { TranslationHelperService } from '../../../services/translation-helper.service';
import { getFileIcon } from '../../../utils/file-icon.util';
import { FileTileEditComponent } from './file-tile-edit/file-tile-edit.component';
import { DisplayMessageService } from '../../../services/display-message.service';

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
  private readonly localDocumentService = inject(LocalDocumentService);
  private readonly snackBar = inject(DisplayMessageService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly translation = inject(TranslationHelperService);

  readonly currentTile = signal<TileSetting | null>(null);
  readonly localPlaceDocuments = signal<LocalDocument[]>([]);

  private lastTileStateKey = '';
  private lastLocalDocumentLoadKey = '';

  constructor() {
    effect(() => {
      this.localDocumentService.getDocumentsSignal()();
      this.refreshLocalPlaceDocumentsFromSignal();
    });
  }

  ngOnChanges(): void {
    const tileStateKey = this.getTileStateKey();
    if (tileStateKey !== this.lastTileStateKey) {
      this.lastTileStateKey = tileStateKey;
      this.currentTile.set(this.tile);
    }

    const localDocumentLoadKey = this.getLocalDocumentLoadKey();
    if (localDocumentLoadKey !== this.lastLocalDocumentLoadKey) {
      this.lastLocalDocumentLoadKey = localDocumentLoadKey;
      void this.loadLocalPlaceDocuments();
    }
  }

  private getTileStateKey(): string {
    const payload = this.tile?.payload;
    return JSON.stringify({
      id: this.tile?.id,
      type: this.tile?.type,
      label: this.tile?.label,
      title: payload?.title,
      icon: payload?.icon,
      files: this.place ? [] : payload?.files
    });
  }

  private getLocalDocumentLoadKey(): string {
    const boundingBox = this.place?.boundingBox;
    if (!boundingBox) {
      return 'none';
    }

    return `${this.place?.id ?? ''}:${boundingBox.latMin}:${boundingBox.latMax}:${boundingBox.lonMin}:${boundingBox.lonMax}`;
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
    const tileFiles = this.normalizeFileEntries(this.currentTile()?.payload?.files);
    const localFiles = this.localPlaceDocuments().map((document, index) => this.localDocumentToTileEntry(document, index));
    return this.mergeFileEntries(tileFiles, localFiles);
  }

  get hasFiles(): boolean {
    return this.files.length > 0;
  }

  openEditor(): void {
    const tile = this.currentTile();
    if (!tile) return;

    const tileForEditor: TileSetting = this.contact
      ? {
        ...tile,
        payload: {
          ...tile.payload,
          files: this.files
        }
      }
      : tile;

    const dialogRef = this.dialog.open(FileTileEditComponent, {
      width: '560px',
      maxWidth: '95vw',
      maxHeight: '98vh',
      data: {
        tile: tileForEditor,
        location: this.place?.location,
        onTileCommit: (updated: TileSetting) => this.applyTileUpdate(updated)
      },
      hasBackdrop: true,
      backdropClass: 'dialog-backdrop',
      disableClose: false,
    });

    dialogRef.afterClosed().subscribe((updated?: TileSetting) => {
      if (!updated) return;
      this.applyTileUpdate(updated);
    });
  }

  async openFile(file: TileFileEntry, event: Event): Promise<void> {
    event.stopPropagation();
    try {
      const localDocument = this.localPlaceDocuments().find((document) => document.id === file.id);
      if (localDocument) {
        await this.localDocumentService.openDocument(localDocument);
      } else {
        await this.fileTileService.openFile(file);
      }
    } catch {
      const message = this.localDocumentService.lastErrorSignal()
        ?? this.fileTileService.lastErrorSignal()
        ?? this.translation.t('common.tiles.files.openFailed');
      this.snackBar.open(message, undefined, { duration: 4000 });
    }
  }

  getFileIcon(file: TileFileEntry): string {
    return getFileIcon(file.fileName, file.mimeType);
  }

  getFileDate(file: TileFileEntry): Date {
    return new Date(file.lastModified ?? file.addedAt);
  }

  private async loadLocalPlaceDocuments(): Promise<void> {
    const boundingBox = this.place?.boundingBox;
    if (!boundingBox) {
      this.localPlaceDocuments.set([]);
      return;
    }

    const documents = await this.localDocumentService.getDocumentsInBoundingBox(boundingBox);
    this.localPlaceDocuments.set(documents);
  }

  private refreshLocalPlaceDocumentsFromSignal(): void {
    const boundingBox = this.place?.boundingBox;
    if (!boundingBox) {
      this.localPlaceDocuments.set([]);
      return;
    }

    this.localPlaceDocuments.set(
      this.localDocumentService.getDocumentsSignal()()
        .filter((document) => this.isInBoundingBox(document.location.latitude, document.location.longitude, boundingBox))
        .sort((a, b) => b.timestamp - a.timestamp)
    );
  }

  private normalizeFileEntries(files?: TileFileEntry[]): TileFileEntry[] {
    return (files ?? [])
      .map((file, index) => ({
        ...file,
        fileName: (file.fileName ?? '').trim(),
        order: Number.isFinite(file.order) ? file.order : index,
        addedAt: Number.isFinite(file.addedAt) ? file.addedAt : Date.now()
      }))
      .filter(file => file.fileName !== '')
      .sort((a, b) => a.order - b.order);
  }

  private mergeFileEntries(tileFiles: TileFileEntry[], localFiles: TileFileEntry[]): TileFileEntry[] {
    const seen = new Set<string>();
    return [...localFiles, ...tileFiles]
      .filter((file) => {
        if (!file.id || seen.has(file.id)) {
          return false;
        }
        seen.add(file.id);
        return true;
      })
      .map((file, index) => ({ ...file, order: index }));
  }

  private localDocumentToTileEntry(document: LocalDocument, index: number): TileFileEntry {
    return {
      id: document.id,
      fileName: document.fileName,
      mimeType: document.mimeType,
      size: document.size,
      lastModified: document.lastModified,
      addedAt: document.timestamp,
      order: index
    };
  }

  private isInBoundingBox(latitude: number, longitude: number, boundingBox: BoundingBox): boolean {
    const latMin = Math.min(boundingBox.latMin, boundingBox.latMax);
    const latMax = Math.max(boundingBox.latMin, boundingBox.latMax);
    const lon = this.normalizeLongitude(longitude);
    const lonMin = this.normalizeLongitude(boundingBox.lonMin);
    const lonMax = this.normalizeLongitude(boundingBox.lonMax);

    return latitude >= latMin
      && latitude <= latMax
      && (lonMin <= lonMax ? lon >= lonMin && lon <= lonMax : lon >= lonMin || lon <= lonMax);
  }

  private normalizeLongitude(longitude: number): number {
    return ((longitude + 180) % 360 + 360) % 360 - 180;
  }

  private applyTileUpdate(updated: TileSetting): void {
    if (this.place) {
      const tiles = this.upsertTile(this.place.tileSettings, updated);
      const updatedPlace = { ...this.place, tileSettings: tiles };
      this.place = updatedPlace;
      this.currentTile.set(updated);
      this.placeService.saveAdditionalPlaceInfos(updatedPlace);
    } else if (this.contact) {
      const tiles = this.upsertTile(this.contact.tileSettings, updated);
      this.contact = { ...this.contact, tileSettings: tiles };
      this.currentTile.set(updated);
      this.contactService.saveContactTileSettings(this.contact);
      this.contactService.refreshContact(this.contact.id);
    }
    this.cdr.markForCheck();
  }

  private upsertTile(tileSettings: TileSetting[] | undefined, updated: TileSetting): TileSetting[] {
    const tiles = tileSettings ?? [];
    const matchedById = tiles.some((tile) => tile.id === updated.id);
    if (matchedById) {
      return tiles.map((tile) => tile.id === updated.id ? { ...tile, ...updated } : tile);
    }

    const matchedByType = tiles.some((tile) => tile.type === updated.type);
    if (matchedByType) {
      return tiles.map((tile) => tile.type === updated.type ? { ...tile, ...updated, id: tile.id } : tile);
    }

    return [...tiles, updated].map((tile, index) => ({ ...tile, order: Number.isFinite(tile.order) ? tile.order : index }));
  }
}
