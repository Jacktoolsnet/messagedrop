import { PublicMessage } from "./public-message.interface";

export interface PublicMessageDetailData {
    source: 'signal' | 'notice';
    // Optional: ID des Signals, falls Quelle 'signal' ist
    signalId?: string;
    reportedContent: string | PublicMessage; // JSON-String aus DB ODER bereits geparst
    contentUrl?: string | null;
    category?: string | null;
    reasonText?: string | null;
    createdAt?: number; // aus Signal/Notice-Row
    status?: string | null; // v.a. bei Notice
}
