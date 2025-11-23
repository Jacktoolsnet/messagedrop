import { inject, Injectable, signal } from '@angular/core';
import { BoundingBox } from '../interfaces/bounding-box';
import { LocalImage } from '../interfaces/local-image';
import { Location } from '../interfaces/location';
import { IndexedDbService } from './indexed-db.service';

type FilePickerWindow = typeof window & {
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: Array<{
      description?: string;
      accept: Record<string, string[]>;
    }>;
    excludeAcceptAllOption?: boolean;
  }) => Promise<FileSystemFileHandle[]>;
};

@Injectable({ providedIn: 'root' })
export class LocalImageService {
  private imagesSignal = signal<LocalImage[]>([]);

  /** Zugriff auf die Images als Signal */
  getImagesSignal() {
    return this.imagesSignal.asReadonly();
  }

  private readonly indexedDbService = inject(IndexedDbService);
  readonly isSupportedSignal = signal<boolean>(this.detectSupport());
  readonly lastErrorSignal = signal<string | null>(null);

  private readonly objectUrlCache = new Map<string, string>();

  isSupported(): boolean {
    const supported = this.detectSupport();
    if (supported !== this.isSupportedSignal()) {
      this.isSupportedSignal.set(supported);
    }
    return supported;
  }

  async createImageEntryForOwner(fallbackLocation: Location,
  ): Promise<LocalImage | null> {
    if (!this.isSupported()) {
      this.lastErrorSignal.set(
        'File System Access API is not supported in this browser or context.',
      );
      return null;
    }

    this.lastErrorSignal.set(null);

    const picker = (window as FilePickerWindow).showOpenFilePicker;
    if (!picker) {
      this.lastErrorSignal.set(
        'File System Access API is not available in this environment.',
      );
      return null;
    }

    let handle: FileSystemFileHandle | undefined;

    try {
      const handles = await picker({
        multiple: false,
        excludeAcceptAllOption: true,
        types: [
          {
            description: 'Images',
            accept: {
              'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
            },
          },
        ],
      });
      handle = handles?.[0];
    } catch (error) {
      if (this.isAbortError(error)) {
        return null;
      }
      console.error('Failed to open file picker', error);
      this.lastErrorSignal.set('Unable to open the file picker for images.');
      return null;
    }

    if (!handle) {
      this.lastErrorSignal.set('No file was selected.');
      return null;
    }

    const hasPermission = await this.ensureReadPermission(handle);
    if (!hasPermission) {
      return null;
    }

    let file: File;
    try {
      file = await handle.getFile();
    } catch (error) {
      console.error('Failed to read file from handle', error);
      this.lastErrorSignal.set('Unable to read the selected image file.');
      return null;
    }

    const dimensions = await this.readImageDimensions(file);
    if (!dimensions) {
      return null;
    }

    // TODO: Parse EXIF metadata for capture date and GPS location.
    const exifCaptureDate: string | undefined = undefined;
    const exifLocation: Location | null = null;

    const location = this.resolveLocation(exifLocation, fallbackLocation);
    const now = Date.now();

    const entry: LocalImage = {
      id: crypto.randomUUID(),
      handle,
      fileName: file.name,
      mimeType: file.type,
      width: dimensions.width,
      height: dimensions.height,
      exifCaptureDate,
      hasExifLocation: exifLocation !== null,
      location,
      timestamp: now
    };

    return entry;
  }

  async getImageUrl(entry: LocalImage): Promise<string> {
    const cached = this.objectUrlCache.get(entry.id);
    if (cached) {
      return cached;
    }

    const hasPermission = await this.ensureReadPermission(entry.handle);
    if (!hasPermission) {
      return Promise.reject(new Error('Read permission not granted for image.'));
    }

    try {
      const file = await entry.handle.getFile();
      const objectUrl = URL.createObjectURL(file);
      this.objectUrlCache.set(entry.id, objectUrl);
      return objectUrl;
    } catch (error) {
      console.error('Failed to create object URL for image', error);
      this.lastErrorSignal.set('Unable to read the image file.');
      return Promise.reject(
        error instanceof Error ? error : new Error('Unable to read the image file.'),
      );
    }
  }

  revokeImageUrl(entry: LocalImage): void {
    const cached = this.objectUrlCache.get(entry.id);
    if (!cached) {
      return;
    }

    URL.revokeObjectURL(cached);
    this.objectUrlCache.delete(entry.id);
  }

  revokeAllImageUrls(): void {
    for (const url of this.objectUrlCache.values()) {
      URL.revokeObjectURL(url);
    }
    this.objectUrlCache.clear();
  }

  private resolveLocation(exifLocation: Location | null, fallbackLocation: Location): Location {
    if (exifLocation) {
      return exifLocation;
    } else {
      return fallbackLocation;
    }
  }

  private async ensureReadPermission(handle: FileSystemFileHandle): Promise<boolean> {
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

  private async readImageDimensions(
    file: File,
  ): Promise<{ width: number; height: number } | null> {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.src = objectUrl;

    try {
      await image.decode();
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      return { width, height };
    } catch (error) {
      console.error('Failed to decode image for dimensions', error);
      this.lastErrorSignal.set('Unable to read the selected image file.');
      return null;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
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

  async getimagesInBoundingBox(boundingBox: BoundingBox): Promise<LocalImage[]> {
    const localImageEntry = await this.indexedDbService.getImagesInBoundingBox(boundingBox);
    this.imagesSignal.set(localImageEntry);
    return localImageEntry;
  }
}
