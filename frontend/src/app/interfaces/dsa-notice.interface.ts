import { DsaNoticeCategory } from './dsa-notice-category.interface';
import { DsaNoticeStatus } from './dsa-notice-status.interface';

export interface DsaNotice {
    id: string;                        // Server-seitige Ticket-ID
    contentId: string;
    contentUrl?: string;
    category: DsaNoticeCategory;
    reasonText: string;
    reporterEmail: string;
    reporterName?: string;
    createdAt: string;                 // ISO-8601
    status: DsaNoticeStatus;
}