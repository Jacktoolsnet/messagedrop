export interface DsaStatusAuditEntry {
  id: string;
  action: string;
  actor: string;
  createdAt: number;
  details?: unknown;
}
