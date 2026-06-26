import { Location } from './location';

export interface SecretDropCryptoMetadata {
  version: number;
  algorithm: 'AES-GCM';
  kdf: 'PBKDF2';
  hash: 'SHA-256';
  iterations: number;
  salt: string;
  iv: string;
  authSalt: string;
}

export interface SecretDropEncryptedPayload {
  ciphertext: string;
}

export interface SecretDrop {
  uuid: string;
  userId?: string;
  location: Location;
  latitude?: number;
  longitude?: number;
  plusCode: string;
  discoveryPlusCode: string;
  hint: string;
  encryptedPayload?: SecretDropEncryptedPayload | string;
  crypto?: SecretDropCryptoMetadata | Record<string, unknown> | string | null;
  maxUnlocks: number | null;
  unlockCount: number;
  failedUnlockCount?: number;
  validFrom: number | null;
  validUntil: number | null;
  status: 'enabled' | 'disabled' | 'consumed' | 'deleted' | string;
  likes: number;
  dislikes: number;
  commentsNumber: number;
  createdAt: number;
  updatedAt?: number;
  lastUnlockedAt?: number | null;
  consumedAt?: number | null;
}

export interface SecretDropCreateRequest {
  userId: string;
  latitude: number;
  longitude: number;
  plusCode: string;
  discoveryPlusCode: string;
  hint: string;
  encryptedPayload: SecretDropEncryptedPayload;
  crypto: SecretDropCryptoMetadata;
  authVerifier: string;
  maxUnlocks: number | null;
  validFrom: number | null;
  validUntil: number | null;
}

export interface SecretDropCreateResponse {
  status: number;
  secretDrop: SecretDrop;
}

export interface SecretDropListResponse {
  status: number;
  rows: SecretDrop[];
}

export interface SecretDropStatsResponse {
  status: number;
  secretDrop: SecretDrop;
  stats: {
    unlockCount: number;
    failedUnlockCount: number;
    lastUnlockedAt: number | null;
    consumedAt: number | null;
    likes: number;
    dislikes: number;
    commentsNumber: number;
  };
}

export interface SecretDropDeleteResponse {
  status: number;
  deleted: boolean;
  uuid: string;
}
