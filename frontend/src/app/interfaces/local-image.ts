import { Location } from "./location";

export interface LocalImage {
  id: string;
  handle: FileSystemFileHandle;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  exifCaptureDate?: string;
  hasExifLocation: boolean;
  location: Location;
  timestamp: number;
}
