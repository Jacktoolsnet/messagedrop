import { DsaNoticeCategory } from "./dsa-notice-category.interface";
import { DsaNoticeType } from "./dsa-notice-type.interface";

export interface DsaReportDialogData {
    contentId: string;
    content: string;
    contentType: DsaNoticeType;
    contentUrl?: string | null;
    category?: DsaNoticeCategory;
    reasonText?: string;
    email?: string | null;
    name?: string | null;
    truthAffirmation?: boolean | null;
}