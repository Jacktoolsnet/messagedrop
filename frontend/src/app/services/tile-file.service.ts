import { inject, Injectable, signal } from '@angular/core';
import { IndexedDbService } from './indexed-db.service';
import { TileFileEntry } from '../interfaces/tile-settings';

type FilePickerWindow = typeof window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: {
      description?: string;
      accept: Record<string, string[]>;
    }[];
    excludeAcceptAllOption?: boolean;
  }) => Promise<FileSystemFileHandle[]>;
};

@Injectable({ providedIn: 'root' })
export class TileFileService {
  private readonly indexedDbService = inject(IndexedDbService);
  readonly isSupportedSignal = signal<boolean>(this.detectSupport());
  readonly lastErrorSignal = signal<string | null>(null);

  isSupported(): boolean {
    const supported = this.detectSupport();
    if (supported !== this.isSupportedSignal()) {
      this.isSupportedSignal.set(supported);
    }
    return supported;
  }

  async pickFiles(): Promise<Array<{ entry: TileFileEntry; handle: FileSystemFileHandle }>> {
    if (!this.isSupported()) {
      this.lastErrorSignal.set('File System Access API is not supported in this browser or context.');
      return [];
    }

    this.lastErrorSignal.set(null);

    const picker = (window as FilePickerWindow).showOpenFilePicker;
    if (!picker) {
      this.lastErrorSignal.set('File System Access API is not available in this environment.');
      return [];
    }

    let handles: FileSystemFileHandle[] = [];

    try {
      handles = await picker({
        multiple: true,
        excludeAcceptAllOption: false
      });
    } catch (error) {
      if (this.isAbortError(error)) {
        return [];
      }
      console.error('Failed to open file picker', error);
      this.lastErrorSignal.set('Unable to open the file picker for files.');
      return [];
    }

    if (!handles.length) {
      this.lastErrorSignal.set('No file was selected.');
      return [];
    }

    const entries: Array<{ entry: TileFileEntry; handle: FileSystemFileHandle }> = [];
    for (const handle of handles) {
      const entry = await this.buildEntryFromHandle(handle);
      if (entry) {
        entries.push({ entry, handle });
      }
    }

    return entries;
  }

  async storeHandle(id: string, handle: FileSystemFileHandle): Promise<void> {
    await this.indexedDbService.setFileHandle(id, handle);
  }

  async deleteHandle(id: string): Promise<void> {
    await this.indexedDbService.deleteFileHandle(id);
  }

  async getHandle(id: string): Promise<FileSystemFileHandle | undefined> {
    return this.indexedDbService.getFileHandle(id);
  }

  async openFile(entry: TileFileEntry, handle?: FileSystemFileHandle): Promise<void> {
    const resolvedHandle = handle ?? (await this.getHandle(entry.id));
    if (!resolvedHandle || typeof resolvedHandle.getFile !== 'function') {
      this.lastErrorSignal.set('Missing file handle for the selected file.');
      throw new Error('Missing file handle.');
    }

    const hasPermission = await this.ensureReadPermission(resolvedHandle);
    if (!hasPermission) {
      throw new Error('Read permission not granted for file.');
    }

    try {
      const file = await resolvedHandle.getFile();
      const url = URL.createObjectURL(file);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      console.error('Failed to open file', error);
      this.lastErrorSignal.set('Unable to open the selected file.');
      throw error instanceof Error ? error : new Error('Unable to open the selected file.');
    }
  }

  private async buildEntryFromHandle(handle: FileSystemFileHandle): Promise<TileFileEntry | null> {
    const hasPermission = await this.ensureReadPermission(handle);
    if (!hasPermission) {
      return null;
    }

    let file: File;
    try {
      file = await handle.getFile();
    } catch (error) {
      console.error('Failed to read file from handle', error);
      this.lastErrorSignal.set('Unable to read the selected file.');
      return null;
    }

    const now = Date.now();

    return {
      id: this.createFileId(),
      fileName: file.name,
      mimeType: file.type,
      size: file.size,
      lastModified: file.lastModified || undefined,
      addedAt: now,
      order: 0
    };
  }

  private async ensureReadPermission(handle: FileSystemFileHandle): Promise<boolean> {
    if (!handle || typeof handle.queryPermission !== 'function' || typeof handle.requestPermission !== 'function') {
      this.lastErrorSignal.set('Invalid file handle; cannot request permission.');
      return false;
    }

    try {
      const status = await handle.queryPermission({ mode: 'read' });
      if (status === 'granted') {
        return true;
      }

      const requested = await handle.requestPermission({ mode: 'read' });
      if (requested !== 'granted') {
        this.lastErrorSignal.set('Read permission is required to access the selected file.');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Permission check failed', error);
      this.lastErrorSignal.set('Unable to obtain read permission for the selected file.');
      return false;
    }
  }

  private createFileId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return `file-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  private detectSupport(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const fsWindow = window as FilePickerWindow;
    return !!fsWindow.showOpenFilePicker && window.isSecureContext === true;
  }

  private isAbortError(error: unknown): boolean {
    return (
      error instanceof DOMException ||
      (typeof error === 'object' && error !== null && 'name' in error)
    )
      ? (error as DOMException).name === 'AbortError'
      : false;
  }
}
