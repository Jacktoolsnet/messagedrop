export interface ReportedLocation {
  latitude?: number | null;
  longitude?: number | null;
  plusCode?: string | null;
}

export interface ReportedMultimedia {
  type?: string | null;
  contentId?: string | null;
  sourceUrl?: string | null;
  url?: string | null;
  title?: string | null;
  description?: string | null;
  oembed?: {
    html?: string | null;
  } | null;
}

export interface ReportedContentPayload {
  id?: string | number | null;
  uuid?: string | null;
  message?: string | null;
  messageStyle?: string | null;
  hint?: string | null;
  hintStyle?: string | null;
  hashtags?: string[] | null;
  userId?: string | null;
  aiModerationDecision?: string | null;
  aiModerationScore?: number | null;
  aiModerationFlagged?: boolean | number | null;
  aiModerationAt?: number | null;
  patternMatch?: boolean | number | null;
  patternMatchAt?: number | null;
  manualModerationDecision?: string | null;
  manualModerationReason?: string | null;
  manualModerationAt?: number | null;
  manualModerationBy?: string | null;
  location?: ReportedLocation | null;
  latitude?: number | null;
  longitude?: number | null;
  plusCode?: string | null;
  discoveryPlusCode?: string | null;
  discoveryZoomLevel?: number | null;
  visibility?: string | null;
  creatorMode?: string | null;
  maxUnlocks?: number | null;
  unlockCount?: number | null;
  failedUnlockCount?: number | null;
  validFrom?: number | null;
  validUntil?: number | null;
  status?: string | null;
  likes?: number | null;
  dislikes?: number | null;
  commentsNumber?: number | null;
  createdAt?: number | null;
  updatedAt?: number | null;
  lastUnlockedAt?: number | null;
  consumedAt?: number | null;
  reportedAfterUnlock?: boolean | null;
  multimedia?: ReportedMultimedia | null;
}
