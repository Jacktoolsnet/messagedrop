export const MAX_PUBLIC_HASHTAGS = 8;
export const HASHTAG_PATTERN = /^[\p{L}\p{N}_]{2,32}$/u;

export interface HashtagParseResult {
  tags: string[];
  invalidTokens: string[];
  overflow: number;
}

export function normalizeHashtagToken(raw: unknown): string | null {
  if (raw === undefined || raw === null) {
    return null;
  }

  let value = String(raw).trim();
  if (!value) {
    return null;
  }

  value = value.replace(/^#+/, '');
  value = value.normalize('NFKC').trim().toLowerCase();

  if (!value || !HASHTAG_PATTERN.test(value)) {
    return null;
  }

  return value;
}

export function splitHashtagInput(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input
      .map((item) => String(item ?? '').trim())
      .flatMap((item) => item.split(/[\s,;]+/g))
      .map((token) => token.trim())
      .filter(Boolean);
  }

  if (typeof input === 'string') {
    return input
      .split(/[\s,;]+/g)
      .map((token) => token.trim())
      .filter(Boolean);
  }

  if (input === undefined || input === null) {
    return [];
  }

  return String(input)
    .split(/[\s,;]+/g)
    .map((token) => token.trim())
    .filter(Boolean);
}

export function normalizeHashtags(input: unknown, max = MAX_PUBLIC_HASHTAGS): HashtagParseResult {
  const normalizedMax = Number.isFinite(max) ? Math.max(1, Math.floor(max)) : MAX_PUBLIC_HASHTAGS;
  const tokens = splitHashtagInput(input);
  const tags: string[] = [];
  const invalidTokens: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const normalized = normalizeHashtagToken(token);
    if (!normalized) {
      invalidTokens.push(token);
      continue;
    }

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    tags.push(normalized);
  }

  return {
    tags: tags.slice(0, normalizedMax),
    invalidTokens,
    overflow: Math.max(0, tags.length - normalizedMax)
  };
}
