import { DsaNoticeCategory } from './dsa-notice-category.interface';
import { DsaNoticeType } from './dsa-notice-type.interface';

export interface CreateDsaSignal {
    contentId: string;                 // interne ID des Posts/Pins
    contentType: DsaNoticeType;
    content: Record<string, unknown> | null;
    contentUrl?: string;               // optional (SPA kann leer sein)
    category: DsaNoticeCategory;
    reasonText: string;
}
