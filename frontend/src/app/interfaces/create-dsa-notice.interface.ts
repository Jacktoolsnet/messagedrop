import { DsaNoticeCategory } from './dsa-notice-category.interface';

export interface CreateDsaNotice {
    contentUuid: string;                 // interne ID des Posts/Pins
    contentUrl?: string;               // optional (SPA kann leer sein)
    category: DsaNoticeCategory;
    reasonText: string;                // kurze, nachvollziehbare Begründung
    reporterEmail: string;             // Kontakt für Rückfragen/Ergebnis
    reporterName?: string;             // optional
    truthAffirmation: boolean;            // Bestätigung "nach bestem Wissen"
}