export interface PowLogEntry {
  id: string;
  source: string;
  scope: string;
  path: string;
  method: string;
  ip?: string | null;
  userAgent?: string | null;
  reason?: string | null;
  difficulty?: number | null;
  requiredUntil?: number | null;
  createdAt: number;
}
