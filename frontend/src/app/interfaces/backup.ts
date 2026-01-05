import { Location } from './location';
import { IndexedDbBackup } from './indexed-db-backup';

export interface UserServerBackup {
  schemaVersion: number;
  createdAt: string;
  userId: string;
  tables: Record<string, unknown[]>;
}

export interface BackupLocalImage {
  id: string;
  fileName: string;
  mimeType: string;
  width: number;
  height: number;
  exifCaptureDate?: string;
  hasExifLocation?: boolean;
  location?: Location;
  timestamp: number;
  fileBase64?: string;
  fileMissingReason?: string;
}

export interface BackupMediaFile {
  id: string;
  mimeType: string;
  fileBase64?: string;
  fileMissingReason?: string;
}

export interface BackupPayload {
  schemaVersion: number;
  createdAt: string;
  userId: string;
  server: UserServerBackup;
  indexedDb: IndexedDbBackup;
  localImages?: BackupLocalImage[];
  mediaFiles?: BackupMediaFile[];
}

export interface BackupEnvelope {
  format: 'messagedrop-backup';
  version: number;
  createdAt: string;
  encrypted: boolean;
  payload: string;
  payloadEncoding: 'base64' | 'utf8';
  kdf?: {
    name: 'PBKDF2';
    salt: string;
    iterations: number;
    hash: 'SHA-256';
  };
  cipher?: {
    name: 'AES-GCM';
    iv: string;
  };
}
