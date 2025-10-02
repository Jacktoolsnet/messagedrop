import { DsaNoticeType } from "./dsa-notice-type.interface";
import { Message } from "./message";

export interface DigitalServicesActReportDialogData {
    reportedContent: Message;
    reportedContentType: DsaNoticeType;
    reportedContentUrl?: string | null;
    reporterEmail?: string | null;
    reporterName?: string | null;
}