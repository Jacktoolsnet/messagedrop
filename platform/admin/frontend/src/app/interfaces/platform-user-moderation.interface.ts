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
  summary: PlatformUserSummary;
}

