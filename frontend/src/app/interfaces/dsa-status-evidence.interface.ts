export interface DsaStatusEvidence {
  id: string;
  type: string;
  url?: string | null;
  hash?: string | null;
  fileName?: string | null;
  addedAt: number;
}
