import { Injectable, signal } from '@angular/core';
import { isQuotaExceededError } from '../utils/storage-error.util';

type CacheScope = 'images' | 'files';

type StorageWithDirectory = StorageManager & {
  getDirectory?: () => Promise<FileSystemDirectoryHandle>;
};

@Injectable({ providedIn: 'root' })
export class FileCacheService {
  readonly isSupportedSignal = signal<boolean>(this.detectSupport());

  isSupported(): boolean {
    const supported = this.detectSupport();
    if (supported !== this.isSupportedSignal()) {
      this.isSupportedSignal.set(supported);
    }
    return supported;
  }

  async getImageHandle(id: string, fileName?: string, mimeType?: string): Promise<FileSystemFileHandle | undefined> {
    return this.getHandle('images', id, fileName, mimeType);
  }

  async writeImageFile(
    id: string,
    file: Blob,
    fileName?: string,
    mimeType?: string,
    options?: { throwOnQuota?: boolean }
  ): Promise<FileSystemFileHandle | undefined> {
    return this.writeFile('images', id, file, fileName, mimeType, options);
  }

  async deleteImageFile(id: string, fileName?: string, mimeType?: string): Promise<void> {
    await this.deleteFile('images', id, fileName, mimeType);
  }

  async getTileHandle(id: string, fileName?: string, mimeType?: string): Promise<FileSystemFileHandle | undefined> {
    return this.getHandle('files', id, fileName, mimeType);
  }

  async writeTileFile(
    id: string,
    file: Blob,
    fileName?: string,
    mimeType?: string,
    options?: { throwOnQuota?: boolean }
  ): Promise<FileSystemFileHandle | undefined> {
    return this.writeFile('files', id, file, fileName, mimeType, options);
  }

  async deleteTileFile(id: string, fileName?: string, mimeType?: string): Promise<void> {
    await this.deleteFile('files', id, fileName, mimeType);
  }

  private async getHandle(
    scope: CacheScope,
    id: string,
    fileName?: string,
    mimeType?: string
  ): Promise<FileSystemFileHandle | undefined> {
    const directory = await this.getScopeDirectory(scope);
    if (!directory) {
      return undefined;
    }

    const cacheName = this.buildCacheFileName(id, fileName, mimeType);
    try {
      return await directory.getFileHandle(cacheName);
    } catch (error) {
      if (!this.isNotFoundError(error)) {
        console.warn('Failed to read cached file handle', error);
      }
      return undefined;
    }
  }

  private async writeFile(
    scope: CacheScope,
    id: string,
    file: Blob,
    fileName?: string,
    mimeType?: string,
    options?: { throwOnQuota?: boolean }
  ): Promise<FileSystemFileHandle | undefined> {
    const directory = await this.getScopeDirectory(scope);
    if (!directory) {
      return undefined;
    }

    const cacheName = this.buildCacheFileName(id, fileName, mimeType);
    try {
      const handle = await directory.getFileHandle(cacheName, { create: true });
      const writable = await handle.createWritable();
      await writable.write(file);
      await writable.close();
      return handle;
    } catch (error) {
      if (options?.throwOnQuota && isQuotaExceededError(error)) {
        throw error;
      }
      console.warn('Failed to cache file in app storage', error);
      return undefined;
    }
  }

  private async deleteFile(
    scope: CacheScope,
    id: string,
    fileName?: string,
    mimeType?: string
  ): Promise<void> {
    const directory = await this.getScopeDirectory(scope);
    if (!directory) {
      return;
    }

    const cacheName = this.buildCacheFileName(id, fileName, mimeType);
    try {
      await directory.removeEntry(cacheName);
    } catch (error) {
      if (!this.isNotFoundError(error)) {
        console.warn('Failed to delete cached file', error);
      }
    }
  }

  private async getScopeDirectory(scope: CacheScope): Promise<FileSystemDirectoryHandle | null> {
    if (typeof navigator === 'undefined') {
      return null;
    }

    const storage = navigator.storage as StorageWithDirectory | undefined;
    if (!storage?.getDirectory) {
      return null;
    }

    const root = await storage.getDirectory();
    const appDir = await root.getDirectoryHandle('messagedrop', { create: true });
    return appDir.getDirectoryHandle(scope, { create: true });
  }

  private buildCacheFileName(id: string, fileName?: string, mimeType?: string): string {
    const ext = this.extensionFromName(fileName) ?? this.extensionFromMime(mimeType);
    return ext ? `${id}.${ext}` : id;
  }

  private extensionFromName(fileName?: string): string | null {
    if (!fileName) {
      return null;
    }
    const trimmed = fileName.trim();
    const match = /\.([a-z0-9]+)$/i.exec(trimmed);
    return match ? match[1].toLowerCase() : null;
  }

  private extensionFromMime(mimeType?: string): string | null {
    if (!mimeType) {
      return null;
    }
    const match = mimeType.split('/')[1];
    return match ? match.replace(/[^a-z0-9]/gi, '').toLowerCase() : null;
  }

  private detectSupport(): boolean {
    if (typeof navigator === 'undefined') {
      return false;
    }
    const storage = navigator.storage as StorageWithDirectory | undefined;
    return typeof storage?.getDirectory === 'function';
  }

  private isNotFoundError(error: unknown): boolean {
    return (
      error instanceof DOMException ||
      (typeof error === 'object' && error !== null && 'name' in error)
    )
      ? (error as DOMException).name === 'NotFoundError'
      : false;
  }
}
