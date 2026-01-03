import { inject, Injectable, signal } from '@angular/core';
import { BoundingBox } from '../interfaces/bounding-box';
import { LocalDocument } from '../interfaces/local-document';
import { Location } from '../interfaces/location';
import { TileFileEntry } from '../interfaces/tile-settings';
import { User } from '../interfaces/user';
import { FileCacheService } from './file-cache.service';
import { IndexedDbService } from './indexed-db.service';
import { TileFileService } from './tile-file.service';

@Injectable({ providedIn: 'root' })
export class LocalDocumentService {
  private documentsSignal = signal<LocalDocument[]>([]);

  /** Zugriff auf die Dokumente als Signal */
  getDocumentsSignal() {
    return this.documentsSignal.asReadonly();
  }

  private readonly indexedDbService = inject(IndexedDbService);
  private readonly tileFileService = inject(TileFileService);
  private readonly fileCacheService = inject(FileCacheService);
  readonly isSupportedSignal = signal<boolean>(this.tileFileService.isSupported());
  readonly lastErrorSignal = signal<string | null>(null);

  isSupported(): boolean {
    const supported = this.tileFileService.isSupported();
    if (supported !== this.isSupportedSignal()) {
      this.isSupportedSignal.set(supported);
    }
    return supported;
  }

  async createDocumentEntries(location: Location): Promise<LocalDocument[]> {
    if (!this.isSupported()) {
      this.lastErrorSignal.set('File System Access API is not supported in this browser or context.');
      return [];
    }

    this.lastErrorSignal.set(null);
    const picked = await this.tileFileService.pickFiles();
    if (!picked.length) {
      this.lastErrorSignal.set(this.tileFileService.lastErrorSignal());
      return [];
    }

    return picked.map(({ entry, handle }) => ({
      id: entry.id,
      handle,
      fileName: entry.fileName,
      mimeType: entry.mimeType,
      size: entry.size,
      lastModified: entry.lastModified,
      location,
      timestamp: entry.addedAt || Date.now()
    }));
  }

  async openDocument(document: LocalDocument): Promise<void> {
    const entry: TileFileEntry = {
      id: document.id,
      fileName: document.fileName,
      mimeType: document.mimeType,
      size: document.size,
      lastModified: document.lastModified,
      addedAt: document.timestamp,
      order: 0
    };
    this.lastErrorSignal.set(null);
    try {
      await this.tileFileService.openFile(entry, document.handle);
    } catch (error) {
      this.lastErrorSignal.set(this.tileFileService.lastErrorSignal());
      throw error;
    }
  }

  async saveDocument(document: LocalDocument): Promise<string> {
    return this.indexedDbService.saveDocument(document);
  }

  async getDocumentsInBoundingBox(boundingBox: BoundingBox): Promise<LocalDocument[]> {
    const docs = await this.indexedDbService.getDocumentsInBoundingBox(boundingBox);
    this.documentsSignal.set(docs);
    return docs;
  }

  async deleteDocument(document: LocalDocument): Promise<void> {
    await this.indexedDbService.deleteDocument(document.id);
    await this.fileCacheService.deleteTileFile(document.id, document.fileName, document.mimeType);
    this.documentsSignal.update(docs => docs.filter(item => item.id !== document.id));
  }

  navigateToDocumentLocation(user: User, document: LocalDocument): void {
    const url = `https://www.google.com/maps/dir/${encodeURIComponent(user.location.plusCode)}/${encodeURIComponent(document.location.plusCode)}`;
    window.open(url, '_blank');
  }
}
