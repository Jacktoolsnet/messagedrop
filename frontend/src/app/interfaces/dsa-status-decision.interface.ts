export interface DsaStatusDecision {
  id: string;
  noticeId: string;
  outcome: string;
  legalBasis?: string | null;
  tosBasis?: string | null;
  automatedUsed?: number;
  decidedBy?: string | null;
  decidedAt: number;
  statement?: string | null;
}
