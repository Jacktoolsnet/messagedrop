import { DsaNoticeCategory } from './dsa-notice-category.interface';
import { DsaNoticeType } from './dsa-notice-type.interface';

export interface CreateDsaNotice {
    contentId: string;                 // interne ID des Posts/Pins
    contentType: DsaNoticeType;
    content: Record<string, unknown> | null;
    contentUrl?: string;               // optional (SPA kann leer sein)
    category: DsaNoticeCategory;
    reasonText: string;                // kurze, nachvollziehbare Begründung
    email: string;             // Kontakt für Rückfragen/Ergebnis
    name?: string;             // optional
    truthAffirmation: boolean;         // Bestätigung "nach bestem Wissen"
}
