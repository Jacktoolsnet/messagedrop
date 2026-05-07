const MAX_PUBLIC_HASHTAGS = 8;
const MAX_LOCAL_HASHTAGS = 12;
const HASHTAG_PATTERN = /^[\p{L}\p{N}_]{2,32}$/u;

function normalizeSingleHashtag(raw) {
  if (raw === undefined || raw === null) {
    return null;
  }
  let value = String(raw).trim();
  if (!value) {
    return null;
  }
  value = value.replace(/^#+/, '');
  value = value.normalize('NFKC').trim().toLowerCase();
  if (!value) {
    return null;
  }
  if (!HASHTAG_PATTERN.test(value)) {
    return null;
  }
  return value;
}

function splitHashtagInput(input) {
  if (Array.isArray(input)) {
    return input
      .map((item) => String(item ?? '').trim())
      .flatMap((item) => item.split(/[\s,;]+/g))
      .filter(Boolean);
  }

  if (typeof input === 'string') {
    return input
      .split(/[\s,;]+/g)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (input === undefined || input === null) {
    return [];
  }

  return String(input)
    .split(/[\s,;]+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeHashtags(input, options = {}) {
  const max = Number.isFinite(options.max) ? Math.max(1, Math.floor(options.max)) : MAX_LOCAL_HASHTAGS;
  const tokens = splitHashtagInput(input);
  const tags = [];
  const invalidTokens = [];
  const seen = new Set();

  for (const token of tokens) {
    const normalized = normalizeSingleHashtag(token);
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

  const overflow = Math.max(0, tags.length - max);
  return {
    tags: tags.slice(0, max),
    invalidTokens,
    overflow
  };
}

function encodeHashtags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return '';
  }
  return `|${tags.join('|')}|`;
}

function decodeHashtags(value) {
  if (typeof value !== 'string') {
    return [];
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }
  if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
    return trimmed
      .slice(1, -1)
      .split('|')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
  }
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return normalizeHashtags(parsed, { max: MAX_LOCAL_HASHTAGS }).tags;
    }
  } catch {
    // ignore malformed legacy payload
  }
  return [];
}

function formatHashtagsForModeration(tags) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return '';
  }
  return tags.map((tag) => `#${tag}`).join(' ');
}

module.exports = {
  MAX_PUBLIC_HASHTAGS,
  MAX_LOCAL_HASHTAGS,
  HASHTAG_PATTERN,
  normalizeSingleHashtag,
  normalizeHashtags,
  encodeHashtags,
  decodeHashtags,
  formatHashtagsForModeration
};
