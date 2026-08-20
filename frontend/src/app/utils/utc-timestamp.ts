/** Normalizes legacy UTC timestamps without a zone suffix to an ISO UTC instant. */
export function normalizeUtcTimestamp(value: string): string {
  const trimmed = value.trim();
  const hasTimezone = /(?:z|[+-]\d{2}:\d{2})$/i.test(trimmed);
  const looksLikeIsoDateTime = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed);
  const candidate = !hasTimezone && looksLikeIsoDateTime
    ? `${trimmed.replace(' ', 'T')}Z`
    : trimmed;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}
