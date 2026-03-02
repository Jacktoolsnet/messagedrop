export interface DsaAppeal {
    id: string;
    decisionId: string;
    noticeId: string;
    noticeStatus: string | null;
    noticeContentId: string | null;
    noticeCategory: string | null;
    noticeReason: string | null;
    noticeContentType: string | null;
    decisionOutcome: string | null;
    decisionDecidedAt: number | null;
    filedBy: string;
    filedAt: number;
    arguments: string;
    outcome: string | null;
    resolvedAt: number | null;
    reviewer: string | null;
}
