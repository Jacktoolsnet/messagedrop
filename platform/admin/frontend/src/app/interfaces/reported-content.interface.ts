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
  location?: ReportedLocation | null;
  multimedia?: ReportedMultimedia | null;
}
