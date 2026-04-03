export interface StickerSourceLicense {
  tier?: string | null;
  attributionRequired?: boolean;
  label?: string | null;
}

export interface StickerSourceMetadata {
  provider: string;
  sourceUrl: string;
  canonicalUrl?: string | null;
  sourceSlug?: string | null;
  packName?: string | null;
  authorName?: string | null;
  authorUrl?: string | null;
  styleName?: string | null;
  stickerCount?: number | null;
  familyName?: string | null;
  familyId?: number | null;
  color?: string | null;
  colors?: string | null;
  shape?: string | null;
  tags?: string[];
  addedAt?: number | null;
  downloadFormats?: string[];
  license?: StickerSourceLicense | null;
  sourcePackId?: number | null;
  apiMatched?: boolean;
  apiWarning?: string | null;
  resolvedAt?: number | null;
}
