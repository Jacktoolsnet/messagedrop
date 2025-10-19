export interface DsaStatusAppeal {
  id: string;
  filedBy: string;
  filedAt: number;
  arguments: string;
  outcome?: string | null;
  resolvedAt?: number | null;
  reviewer?: string | null;
}
