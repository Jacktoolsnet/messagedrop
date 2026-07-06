export type DsaReportedContentType = 'public message' | 'secret drop';

export function normalizeDsaReportedContentType(value: string | null | undefined): DsaReportedContentType {
  const normalized = String(value || 'public message').trim().toLowerCase();
  return normalized === 'secret drop' ? 'secret drop' : 'public message';
}

export function isSecretDropContentType(value: string | null | undefined): boolean {
  return normalizeDsaReportedContentType(value) === 'secret drop';
}
