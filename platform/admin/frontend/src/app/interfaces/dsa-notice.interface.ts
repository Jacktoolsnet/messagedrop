import { DsaNoticeStatus } from './dsa-notice-status.type';

export interface DsaNotice {
    id: string;
    contentId: string;
    contentUrl?: string | null;
    category?: string | null;
    reasonText?: string | null;
    reporterEmail?: string | null;
    reporterName?: string | null;
    truthAffirmation?: boolean | null;
    reportedContentType: string;
    reportedContent: string;
    status: DsaNoticeStatus;
    createdAt: number;
    updatedAt: number;
}