export interface DsaTransparencySummary {
    period: string;                    // z. B. "2025-Q3" oder "2025-09"
    totalNotices: number;
    avgHandlingHours: number;          // Durchschnittliche Bearbeitungszeit
    outcomes: Record<string, number>;  // z. B. { REMOVE: 12, NO_ACTION: 7, DISABLE: 3 }
}