import { Location } from './location';
import { Multimedia } from './multimedia';

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
  discoveryZoomLevel?: number;
  hint: string;
  hintStyle?: string;
  message?: string;
  messageStyle?: string;
  multimedia?: Multimedia | null;
  /** Locally stored owner PIN. In production this lives inside the User-PIN encrypted IndexedDB store and is never sent to the backend. */
  localSecretPin?: string | null;
  visibility?: 'public' | 'contacts';
  creatorMode?: 'normal' | 'incognito';
  recipientUserIds?: string[];
  publishState?: 'published' | 'draft' | 'unpublished' | 'local_only' | 'dsa_locked';
  localOnly?: boolean;
  showOnMap?: boolean;
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
  dsaStatusToken?: string | null;
  dsaStatusTokenCreatedAt?: number | null;
  aiModerationDecision?: string | null;
  aiModerationScore?: number | null;
  aiModerationFlagged?: boolean | null;
  patternMatch?: boolean | null;
  aiModerationAt?: number | null;
  manualModerationDecision?: string | null;
  manualModerationReason?: string | null;
  manualModerationAt?: number | null;
  manualModerationBy?: string | null;
}


export interface SecretDropComment {
  uuid: string;
  secretDropUuid: string;
  userId: string;
  encryptedPayload: SecretDropEncryptedPayload | string;
  crypto: SecretDropCryptoMetadata | Record<string, unknown> | string | null;
  parentCommentUuid?: string | null;
  likes: number;
  dislikes: number;
  commentsNumber: number;
  translatedMessage?: string;
  createdAt: number;
  status: 'enabled' | 'deleted' | string;
}

export interface SecretDropCreateRequest {
  userId: string;
  latitude: number;
  longitude: number;
  plusCode: string;
  discoveryPlusCode: string;
  discoveryZoomLevel?: number;
  hint: string;
  hintStyle: string;
  encryptedPayload: SecretDropEncryptedPayload;
  crypto: SecretDropCryptoMetadata;
  authVerifier: string;
  maxUnlocks: number | null;
  validFrom: number | null;
  validUntil: number | null;
  visibility?: 'public' | 'contacts';
  creatorMode?: 'normal' | 'incognito';
  recipientUserIds?: string[];
  publishState?: 'published' | 'draft' | 'unpublished';
  showOnMap?: boolean;
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

export interface SecretDropUnlockResponse {
  status: number;
  secretDrop: SecretDrop;
}

export interface SecretDropDecryptedContent {
  message: string;
  multimedia: Multimedia | null;
  style: string;
}

export interface SecretDropUpdateResponse {
  status: number;
  secretDrop: SecretDrop;
}

export interface SecretDropCommentListResponse {
  status: number;
  rows: SecretDropComment[];
}

export interface SecretDropCommentCreateResponse {
  status: number;
  comment: SecretDropComment;
}

export interface SecretDropCommentUpdateResponse {
  status: number;
  comment: SecretDropComment;
}

export interface SecretDropCommentDeleteResponse {
  status: number;
  deleted: boolean;
  uuid: string;
}
