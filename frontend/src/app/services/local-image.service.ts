import { inject, Injectable, signal } from '@angular/core';
import { BoundingBox } from '../interfaces/bounding-box';
import { LocalImage } from '../interfaces/local-image';
import { Location } from '../interfaces/location';
import { User } from '../interfaces/user';
import { FileCacheService } from './file-cache.service';
import { GeolocationService } from './geolocation.service';
import { IndexedDbService } from './indexed-db.service';

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
export class LocalImageService {
  private imagesSignal = signal<LocalImage[]>([]);

  /** Zugriff auf die Images als Signal */
  getImagesSignal() {
    return this.imagesSignal.asReadonly();
  }

  private readonly indexedDbService = inject(IndexedDbService);
  private readonly geoLocationService = inject(GeolocationService);
  private readonly fileCacheService = inject(FileCacheService);
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

  async createImageEntries(fallbackLocation: Location): Promise<LocalImage[]> {
    if (!this.isSupported()) {
      this.lastErrorSignal.set(
        'File System Access API is not supported in this browser or context.',
      );
      return [];
    }

    this.lastErrorSignal.set(null);

    const picker = (window as FilePickerWindow).showOpenFilePicker;
    if (!picker) {
      this.lastErrorSignal.set(
        'File System Access API is not available in this environment.',
      );
      return [];
    }

    let handles: FileSystemFileHandle[] = [];

    try {
      handles = await picker({
        multiple: true,
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
    } catch (error) {
      if (this.isAbortError(error)) {
        return [];
      }
      console.error('Failed to open file picker', error);
      this.lastErrorSignal.set('Unable to open the file picker for images.');
      return [];
    }

    if (!handles.length) {
      this.lastErrorSignal.set('No file was selected.');
      return [];
    }

    const entries: LocalImage[] = [];
    for (const handle of handles) {
      const entry = await this.buildEntryFromHandle(handle, fallbackLocation);
      if (entry) {
        entries.push(entry);
      }
    }

    return entries;
  }

  private async buildEntryFromHandle(
    handle: FileSystemFileHandle,
    fallbackLocation: Location,
  ): Promise<LocalImage | null> {
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

    const id = crypto.randomUUID();
    const dimensions = await this.readImageDimensions(file);
    if (!dimensions) {
      return null;
    }

    const exifData = await this.parseExifMetadata(file);
    const exifCaptureDate: string | undefined = exifData?.captureDate;
    const exifLocation: Location | null = exifData?.location ?? null;

    const location = this.resolveLocation(exifLocation, fallbackLocation);
    const now = Date.now();

    const cachedHandle = await this.fileCacheService.writeImageFile(
      id,
      file,
      file.name,
      file.type,
      { throwOnQuota: true }
    );
    const entry: LocalImage = {
      id,
      handle: cachedHandle ?? handle,
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

    const cachedHandle = await this.fileCacheService.getImageHandle(entry.id, entry.fileName, entry.mimeType);
    if (cachedHandle && entry.handle !== cachedHandle) {
      entry.handle = cachedHandle;
      try {
        await this.indexedDbService.saveImage(entry);
      } catch (error) {
        console.warn('Failed to persist cached image handle', error);
      }
    }

    const resolvedHandle = cachedHandle ?? entry.handle;
    if (!resolvedHandle || typeof resolvedHandle.getFile !== 'function') {
      this.lastErrorSignal.set('Missing file handle for the image.');
      return Promise.reject(new Error('Missing file handle for the image.'));
    }

    if (!cachedHandle) {
      const hasPermission = await this.ensureReadPermission(resolvedHandle);
      if (!hasPermission) {
        return Promise.reject(new Error('Read permission not granted for image.'));
      }
    }

    try {
      const file = await resolvedHandle.getFile();
      const objectUrl = URL.createObjectURL(file);
      this.objectUrlCache.set(entry.id, objectUrl);
      if (!cachedHandle) {
        const updatedHandle = await this.fileCacheService.writeImageFile(entry.id, file, entry.fileName, entry.mimeType);
        if (updatedHandle) {
          entry.handle = updatedHandle;
          try {
            await this.indexedDbService.saveImage(entry);
          } catch (error) {
            console.warn('Failed to persist cached image handle', error);
          }
        }
      }
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

  private async parseExifMetadata(
    file: File,
  ): Promise<{ captureDate?: string; location?: Location } | null> {
    try {
      const { parse, gps } = await import("exifr");

      const data = await parse(file, { pick: ["DateTimeOriginal", "CreateDate"] });
      const dateValue = data?.DateTimeOriginal ?? data?.CreateDate;
      const captureDate =
        typeof dateValue === "string"
          ? dateValue
          : dateValue instanceof Date
            ? dateValue.toISOString()
            : undefined;

      const gpsData = await gps(file);
      const lat = typeof gpsData?.latitude === "number" ? gpsData.latitude : undefined;
      const lon = typeof gpsData?.longitude === "number" ? gpsData.longitude : undefined;
      const location =
        lat !== undefined &&
          lon !== undefined &&
          this.isValidGps({ lat, lon })
          ? {
            latitude: lat,
            longitude: lon,
            plusCode: this.geoLocationService.getPlusCode(lat, lon),
          }
          : undefined;

      if (captureDate || location) {
        return { captureDate, location };
      }
    } catch (error) {
      console.warn("EXIF parse via exifr failed", error);
    }

    if (file.lastModified) {
      return { captureDate: new Date(file.lastModified).toISOString() };
    }

    return null;
  }

  private isValidGps(gps: { lat: number; lon: number }): boolean {
    return (
      Number.isFinite(gps.lat) &&
      Number.isFinite(gps.lon) &&
      gps.lat >= -90 &&
      gps.lat <= 90 &&
      gps.lon >= -180 &&
      gps.lon <= 180
    );
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

  async getImagesInBoundingBox(boundingBox: BoundingBox): Promise<LocalImage[]> {
    const localImageEntry = await this.indexedDbService.getImagesInBoundingBox(boundingBox);
    this.imagesSignal.set(localImageEntry);
    return localImageEntry;
  }

  async deleteImage(image: LocalImage): Promise<void> {
    await this.indexedDbService.deleteImage(image.id);
    await this.fileCacheService.deleteImageFile(image.id, image.fileName, image.mimeType);
    this.imagesSignal.update(images => images.filter(n => n.id !== image.id));
  }

  navigateToNoteLocation(user: User, image: LocalImage): void {
    const url = `https://www.google.com/maps/dir/${encodeURIComponent(user.location.plusCode)}/${encodeURIComponent(image.location.plusCode)}`;
    window.open(url, '_blank');
  }
}
