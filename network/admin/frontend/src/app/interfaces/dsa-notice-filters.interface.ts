import { DsaNoticeStatus } from './dsa-notice-status.type';

export type DsaNoticeRange = '24h' | '7d' | '30d' | 'all';

export type DsaNoticeSort =
    | 'createdAt_desc'
    | 'createdAt_asc'
    | 'updatedAt_desc'
    | 'updatedAt_asc';

export interface DsaNoticeFilters {
    status?: DsaNoticeStatus | DsaNoticeStatus[];
    contentId?: string;
    reportedContentType?: string;
    category?: string;
    q?: string;
    range?: DsaNoticeRange;
    limit?: number;
    offset?: number;
    sort?: DsaNoticeSort;
}