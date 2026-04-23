export type CertificateHealthStatus = 'ok' | 'warning' | 'critical' | 'expired' | 'error';
export type CertificateHealthWorstStatus = CertificateHealthStatus | 'none';

export interface CertificateHealthTarget {
  targetKey: string;
  label: string;
  source: string;
  host: string;
  port: number;
  origin: string;
  status: CertificateHealthStatus;
  statusMessage: string | null;
  authorizationError: string | null;
  subject: string | null;
  subjectAltName: string | null;
  issuer: string | null;
  validFrom: number | null;
  validTo: number | null;
  daysRemaining: number | null;
  lastCheckedAt: number | null;
  updatedAt: number | null;
}

export interface CertificateHealthSummary {
  enabled: boolean;
  configuredTargets: number;
  total: number;
  ok: number;
  warning: number;
  critical: number;
  expired: number;
  error: number;
  worstStatus: CertificateHealthWorstStatus;
  lastCheckedAt: number | null;
}

export interface CertificateHealthOverviewResponse {
  status: number;
  summary: CertificateHealthSummary;
  targets: CertificateHealthTarget[];
}
