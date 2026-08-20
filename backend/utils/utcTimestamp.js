function normalizeUtcTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const trimmed = value.trim();
  const hasTimezone = /(?:z|[+-]\d{2}:\d{2})$/i.test(trimmed);
  const looksLikeIsoDateTime = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed);
  const candidate = !hasTimezone && looksLikeIsoDateTime
    ? `${trimmed.replace(' ', 'T')}Z`
    : trimmed;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function createUtcTimestamp() {
  return new Date().toISOString();
}

module.exports = { createUtcTimestamp, normalizeUtcTimestamp };
