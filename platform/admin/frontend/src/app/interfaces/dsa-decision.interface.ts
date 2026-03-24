export interface DsaDecision {
    id: string;
    noticeId: string;
    outcome: 'NO_ACTION' | 'REMOVE_CONTENT' | 'RESTRICT' | 'FORWARD_TO_AUTHORITY' | 'OTHER';
    legalBasis?: string | null;
    legalBasisEn?: string | null;
    tosBasis?: string | null;
    tosBasisEn?: string | null;
    automatedUsed: boolean;
    decidedBy: string;
    decidedAt: number;
    statement?: string | null;
    statementEn?: string | null;
}
