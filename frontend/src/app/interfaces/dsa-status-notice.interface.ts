export interface DsaStatusNotice {
  id: string;
  contentId: string;
  contentUrl?: string | null;
  category?: string | null;
  reasonText?: string | null;
  reporterEmail?: string | null;
  reporterName?: string | null;
  truthAffirmation?: number | null;
  reportedContentType: string;
  reportedContent: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}
