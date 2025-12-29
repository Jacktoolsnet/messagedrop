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
  message?: string | null;
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
  multimedia?: ReportedMultimedia | null;
}
