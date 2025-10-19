export interface DsaStatusSignal {
  id: string;
  contentId: string;
  contentUrl?: string | null;
  category?: string | null;
  reasonText?: string | null;
  reportedContentType: string;
  reportedContent: string;
  createdAt: number;
}
