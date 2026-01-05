import { Injectable, inject } from '@angular/core';
import { FileCacheService } from './file-cache.service';

type StoredImageKind = 'avatar' | 'background';

@Injectable({ providedIn: 'root' })
export class AvatarStorageService {
  private readonly fileCacheService = inject(FileCacheService);
  private readonly objectUrlCache = new Map<string, string>();
  private readonly mimeType = 'image/jpeg';

  isSupported(): boolean {
    return this.fileCacheService.isSupported();
  }

  async saveImageFromDataUrl(
    kind: StoredImageKind,
    dataUrl: string,
    existingId?: string
  ): Promise<{ id: string; url: string } | null> {
    if (!this.isSupported()) {
      return null;
    }

    const id = existingId ?? `${kind}-${crypto.randomUUID()}`;
    const blob = this.dataUrlToBlob(dataUrl);
    const handle = await this.fileCacheService.writeImageFile(id, blob, undefined, this.mimeType);
    if (!handle) {
      return null;
    }
    const url = this.createObjectUrl(id, blob);
    return { id, url };
  }

  async saveImageFromBase64(
    kind: StoredImageKind,
    base64: string,
    existingId?: string
  ): Promise<{ id: string; url: string } | null> {
    const dataUrl = this.ensureDataUrl(base64);
    return this.saveImageFromDataUrl(kind, dataUrl, existingId);
  }

  async getImageUrl(id?: string | null): Promise<string | null> {
    if (!id || !this.isSupported()) {
      return null;
    }
    const cached = this.objectUrlCache.get(id);
    if (cached) {
      return cached;
    }

    const handle = await this.fileCacheService.getImageHandle(id, undefined, this.mimeType);
    if (!handle) {
      return null;
    }
    const file = await handle.getFile();
    return this.createObjectUrl(id, file);
  }

  async getImageBase64(id?: string | null): Promise<string | null> {
    if (!id || !this.isSupported()) {
      return null;
    }
    const handle = await this.fileCacheService.getImageHandle(id, undefined, this.mimeType);
    if (!handle) {
      return null;
    }
    const file = await handle.getFile();
    return this.fileToDataUrl(file);
  }

  async deleteImage(id?: string | null): Promise<void> {
    if (!id || !this.isSupported()) {
      return;
    }
    await this.fileCacheService.deleteImageFile(id, undefined, this.mimeType);
    this.revokeObjectUrl(id);
  }

  private createObjectUrl(id: string, blob: Blob): string {
    this.revokeObjectUrl(id);
    const url = URL.createObjectURL(blob);
    this.objectUrlCache.set(id, url);
    return url;
  }

  private revokeObjectUrl(id: string): void {
    const cached = this.objectUrlCache.get(id);
    if (cached) {
      URL.revokeObjectURL(cached);
      this.objectUrlCache.delete(id);
    }
  }

  private dataUrlToBlob(dataUrl: string): Blob {
    const [header, base64] = dataUrl.split(',');
    const mimeMatch = header?.match(/data:(.*?);base64/);
    const mimeType = mimeMatch?.[1] || this.mimeType;
    const binary = atob(base64 || '');
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }

  private ensureDataUrl(base64: string): string {
    if (base64.startsWith('data:')) {
      return base64;
    }
    return `data:${this.mimeType};base64,${base64}`;
  }

  private fileToDataUrl(file: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
