export interface DsaDecision {
    id: string;
    noticeId: string;
    outcome: 'NO_ACTION' | 'REMOVE_CONTENT' | 'RESTRICT' | 'OTHER';
    legalBasis?: string | null;
    tosBasis?: string | null;
    automatedUsed: boolean;
    decidedBy: string;
    decidedAt: number;
    statement?: string | null;
}