export type ImageLocationSource = 'exif' | 'entity' | 'manual';

export interface ImageLocation {
  lat: number;
  lon: number;
  source: ImageLocationSource;
  plusCode?: string;
}

export interface LocalImageEntry {
  id: string;
  ownerId: string;
  handle: FileSystemFileHandle;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  exifCaptureDate?: string;
  hasExifLocation: boolean;
  location: ImageLocation | null;
  timestamp: number;
}
