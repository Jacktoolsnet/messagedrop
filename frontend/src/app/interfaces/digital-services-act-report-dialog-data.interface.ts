import { Message } from "./message";

export interface DigitalServicesActReportDialogData {
    reportedMessage: Message;
    reportedContentUrl?: string | null;
    reporterEmail?: string | null;
    reporterName?: string | null;
}