export interface DsaSignal {
    id: string;
    contentId: string;
    contentUrl?: string | null;
    category?: string | null;
    reasonText?: string | null;
    reportedContentType: string;
    reportedContent: string; // JSON string
    createdAt: number;
}