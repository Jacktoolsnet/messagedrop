import { Location } from "./location";

export interface LocalDocument {
  id: string;
  handle: FileSystemFileHandle;
  fileName: string;
  mimeType?: string;
  size?: number;
  lastModified?: number;
  location: Location;
  timestamp: number;
}
