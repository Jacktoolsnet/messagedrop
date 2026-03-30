import { AvatarAttribution } from './avatar-attribution';

export interface ContactProfileExchangeRequestResponse {
  status: number;
  exchangeId: string;
  exchangeStatus: 'pending' | 'approved' | 'declined';
  alreadyExists: boolean;
}

export interface ContactProfileExchangeInboxEntry {
  id: string;
  requesterUserId: string;
  requesterContactId: string;
  requesterHint: string;
  requesterEncryptionPublicKey: string;
  createdAt: number;
  expiresAt: number;
}

export interface ContactProfileExchangeInboxResponse {
  status: number;
  rows: ContactProfileExchangeInboxEntry[];
}

export interface ContactProfileExchangeRespondResponse {
  status: number;
  exchangeId: string;
  exchangeStatus: 'approved' | 'declined';
}

export interface ContactProfileExchangeResponseEntry {
  id: string;
  requesterContactId: string;
  recipientUserId: string;
  status: 'approved' | 'declined';
  encryptedProfilePayload: string;
  responseSignature: string;
  createdAt: number;
  decidedAt: number | null;
  expiresAt: number;
}

export interface ContactProfileExchangeResponsesResponse {
  status: number;
  rows: ContactProfileExchangeResponseEntry[];
}

export interface ContactProfileExchangeAckResponse {
  status: number;
  deleted: number;
}

export interface SharedContactProfilePayload {
  name: string;
  base64Avatar: string;
  avatarAttribution?: AvatarAttribution;
}
