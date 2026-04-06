import { PublicMessageRow } from './public-message-row';

export interface OwnerMessageRow extends PublicMessageRow {
  deleteDateTime?: number | null;
  aiModerationDecision?: string | null;
  aiModerationScore?: number | null;
  aiModerationFlagged?: number | boolean | null;
  aiModerationAt?: number | null;
  patternMatch?: number | boolean | null;
  patternMatchAt?: number | null;
  manualModerationDecision?: string | null;
  manualModerationReason?: string | null;
  manualModerationAt?: number | null;
  manualModerationBy?: string | null;
  dsaStatusToken?: string | null;
  likedByUser?: boolean;
  dislikedByUser?: boolean;
}
