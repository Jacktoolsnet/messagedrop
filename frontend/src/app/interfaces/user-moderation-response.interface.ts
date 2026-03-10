export type UserModerationTarget = 'posting' | 'account';
export type UserModerationAppealStatus = 'open' | 'accepted' | 'rejected';

export interface UserModerationState {
  blocked: boolean;
  reason: string | null;
  blockedAt: number | null;
  blockedUntil: number | null;
  blockedBy: string | null;
}

export interface UserModerationAppeal {
  id: string;
  userId: string;
  target: UserModerationTarget;
  status: UserModerationAppealStatus;
  message: string;
  createdAt: number | null;
  resolvedAt: number | null;
  resolutionMessage: string | null;
  reviewer: string | null;
}

export interface UserModerationPayload {
  userId: string;
  posting: UserModerationState;
  account: UserModerationState;
}

export interface UserModerationResponse {
  status: number;
  moderation?: UserModerationPayload | null;
  appeals?: UserModerationAppeal[] | null;
  appeal?: UserModerationAppeal | null;
}
