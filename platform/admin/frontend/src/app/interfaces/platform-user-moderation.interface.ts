export interface PlatformUserModerationState {
  blocked: boolean;
  reason: string | null;
  blockedAt: number | null;
  blockedUntil: number | null;
  blockedBy: string | null;
}

export interface PlatformUserModeration {
  userId: string;
  posting: PlatformUserModerationState;
  account: PlatformUserModerationState;
}

export type PlatformUserModerationAppealTarget = 'posting' | 'account';
export type PlatformUserModerationAppealStatus = 'open' | 'accepted' | 'rejected';

export interface PlatformUserModerationAppeal {
  id: string;
  userId: string;
  target: PlatformUserModerationAppealTarget;
  status: PlatformUserModerationAppealStatus;
  message: string;
  createdAt: number | null;
  resolvedAt: number | null;
  resolutionMessage: string | null;
  reviewer: string | null;
}

export interface PlatformUserSummary {
  signals: {
    total: number;
    open: number;
    dismissed: number;
  };
  notices: {
    total: number;
    open: number;
    decided: number;
  };
  decisions: {
    total: number;
    enforced: number;
  };
}

export interface PlatformUserModerationResponse {
  status: number;
  moderation: PlatformUserModeration;
  appeals?: PlatformUserModerationAppeal[];
  summary: PlatformUserSummary;
  appeal?: PlatformUserModerationAppeal;
}
