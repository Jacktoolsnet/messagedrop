const axios = require('axios');

const FLATICON_API_BASE_URL = 'https://api.flaticon.com/v3';
const FLATICON_WEB_BASE_URL = 'https://www.flaticon.com';
const DEFAULT_TIMEOUT_MS = 12000;

let cachedAccessToken = null;
let cachedAccessTokenExpiresAt = 0;

function normalizeTimeout(rawValue, fallback = DEFAULT_TIMEOUT_MS) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.round(parsed);
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function stripHtml(value) {
  return normalizeString(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeHtmlEntities(value) {
  return normalizeString(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x2F;/gi, '/');
}

function normalizeComparable(value) {
  return decodeHtmlEntities(stripHtml(value))
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/stickers?\s+pack/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeFlaticonUrl(rawUrl) {
  const trimmed = normalizeString(rawUrl);
  if (!trimmed) {
    return null;
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  if (!/(\.|^)flaticon\.com$/i.test(parsed.hostname)) {
    return null;
  }
  if (!/\/stickers-pack\//i.test(parsed.pathname)) {
    return null;
  }
  parsed.hash = '';
  parsed.search = '';
  return parsed.toString().replace(/\/+$/, '');
}

function buildHttpClient() {
  return axios.create({
    timeout: normalizeTimeout(process.env.FLATICON_HTTP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    validateStatus: () => true,
    headers: {
      'user-agent': 'Messagedrop Sticker Service/1.0',
      accept: 'text/html,application/json;q=0.9,*/*;q=0.8'
    }
  });
}

function extractTagContent(html, tagName) {
  const match = String(html || '').match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return decodeHtmlEntities(stripHtml(match?.[1] || ''));
}

function extractMetaContent(html, attrName, attrValue) {
  const pattern = new RegExp(`<meta[^>]+${attrName}=["']${attrValue}["'][^>]+content=["']([^"']+)["'][^>]*>`, 'i');
  const direct = String(html || '').match(pattern);
  if (direct?.[1]) {
    return decodeHtmlEntities(direct[1]);
  }
  const reversedPattern = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+${attrName}=["']${attrValue}["'][^>]*>`, 'i');
  const reversed = String(html || '').match(reversedPattern);
  return decodeHtmlEntities(reversed?.[1] || '');
}

function extractCanonicalUrl(html) {
  const match = String(html || '').match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)
    || String(html || '').match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i);
  return normalizeString(match?.[1]);
}

function extractAuthorUrl(html) {
  const patterns = [
    /<a[^>]+href=["']([^"']*\/authors\/[^"']+)["'][^>]*>\s*<[^>]*>\s*<\/[^>]*>\s*([^<]+)\s*<\/a>/i,
    /<a[^>]+href=["']([^"']*\/authors\/[^"']+)["'][^>]*>([^<]+)<\/a>/i
  ];
  for (const pattern of patterns) {
    const match = String(html || '').match(pattern);
    if (match?.[1]) {
      return {
        url: match[1].startsWith('http') ? match[1] : `${FLATICON_WEB_BASE_URL}${match[1]}`,
        name: decodeHtmlEntities(stripHtml(match[2] || ''))
      };
    }
  }
  return { url: '', name: '' };
}

function extractStickerCount(html) {
  const text = decodeHtmlEntities(stripHtml(html));
  const match = text.match(/\b(\d{1,4})\s+stickers?\b/i);
  return match ? Number.parseInt(match[1], 10) : null;
}

function extractDownloadFormats(html) {
  const text = String(html || '').toUpperCase();
  const formats = [];
  for (const format of ['SVG', 'EPS', 'PNG', 'PSD']) {
    if (text.includes(format)) {
      formats.push(format.toLowerCase());
    }
  }
  return formats;
}

function extractLicenseInfo(html, text) {
  const source = `${html || ''} ${text || ''}`;
  const premium = /premium flaticon license/i.test(source);
  const attributionRequired = /attribution is required|you must attribute the author/i.test(source);
  return {
    tier: premium ? 'premium' : 'free',
    attributionRequired,
    label: premium ? 'Premium Flaticon License' : 'Flaticon License'
  };
}

function extractPackSlug(sourceUrl) {
  const normalized = normalizeFlaticonUrl(sourceUrl);
  if (!normalized) {
    return '';
  }
  try {
    const parsed = new URL(normalized);
    const match = parsed.pathname.match(/\/stickers-pack\/([^/?#]+)/i);
    return normalizeString(match?.[1]).toLowerCase();
  } catch {
    return '';
  }
}

function extractPackIdCandidates(html, sourceUrl) {
  const candidates = new Set();
  const slug = extractPackSlug(sourceUrl);
  if (slug) {
    const trailing = slug.match(/(\d{3,})$/);
    if (trailing?.[1]) {
      candidates.add(Number.parseInt(trailing[1], 10));
    }
  }

  const patterns = [
    /["']pack(?:Id|_id)["']\s*:\s*["']?(\d{3,})["']?/gi,
    /["']id["']\s*:\s*["']?(\d{3,})["']?/gi,
    /\/stickers-pack\/[^"'<>]+-(\d{3,})/gi
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(String(html || ''))) !== null) {
      const value = Number.parseInt(match[1], 10);
      if (Number.isFinite(value)) {
        candidates.add(value);
      }
    }
  }
  return Array.from(candidates).slice(0, 10);
}

function extractPageMetadata(html, sourceUrl) {
  const title = extractTagContent(html, 'title');
  const ogTitle = extractMetaContent(html, 'property', 'og:title');
  const description = extractMetaContent(html, 'property', 'og:description') || extractMetaContent(html, 'name', 'description');
  const canonicalUrl = extractCanonicalUrl(html) || sourceUrl;
  const author = extractAuthorUrl(html);
  const text = decodeHtmlEntities(stripHtml(html));
  const packName = normalizeString(ogTitle || title)
    .replace(/\s*[|-]\s*.*$/, '')
    .replace(/\s+stickers?\s+pack$/i, ' stickers pack')
    .trim();
  const styleMatch = text.match(/Style:\s*([A-Za-z0-9 .-]{2,120})/i);

  return {
    provider: 'flaticon',
    sourceUrl,
    canonicalUrl,
    sourceSlug: extractPackSlug(sourceUrl),
    pageTitle: title || ogTitle,
    packName: packName || extractPackSlug(sourceUrl).replace(/-/g, ' '),
    pageDescription: description || '',
    authorName: author.name || '',
    authorUrl: author.url || '',
    styleName: decodeHtmlEntities(normalizeString(styleMatch?.[1] || '')),
    stickerCount: extractStickerCount(text),
    downloadFormats: extractDownloadFormats(text),
    license: extractLicenseInfo(html, text),
    packIdCandidates: extractPackIdCandidates(html, sourceUrl)
  };
}

async function authenticateFlaticonApi(client) {
  const now = Date.now();
  if (cachedAccessToken && cachedAccessTokenExpiresAt > now + 30_000) {
    return cachedAccessToken;
  }

  const apiKey = normalizeString(process.env.FLATICON_API_KEY);
  if (!apiKey) {
    return null;
  }

  const form = new FormData();
  form.set('apiKey', apiKey);
  const response = await client.post(`${FLATICON_API_BASE_URL}/app/authentication`, form, {
    headers: {
      accept: 'application/json'
    }
  });

  if (response.status >= 400) {
    throw new Error(`flaticon_auth_failed_${response.status}`);
  }

  const token = normalizeString(
    response.data?.data?.token
    || response.data?.token
    || response.data?.data?.access_token
    || response.data?.access_token
  );
  if (!token) {
    throw new Error('flaticon_auth_token_missing');
  }
  cachedAccessToken = token;
  cachedAccessTokenExpiresAt = Date.now() + (23 * 60 * 60 * 1000);
  return token;
}

function pickSearchQueries(pageMetadata) {
  const queries = new Set();
  const packName = normalizeString(pageMetadata.packName)
    .replace(/\s+stickers?\s+pack$/i, '')
    .trim();
  if (packName) {
    queries.add(packName);
  }
  const slug = normalizeString(pageMetadata.sourceSlug)
    .replace(/-\d+$/i, '')
    .replace(/-/g, ' ')
    .trim();
  if (slug) {
    queries.add(slug);
  }
  return Array.from(queries).slice(0, 3);
}

function sanitizeApiPack(pack) {
  if (!pack || typeof pack !== 'object') {
    return null;
  }
  return {
    id: Number(pack.id) || null,
    description: normalizeString(pack.description),
    teamName: normalizeString(pack.team_name),
    familyName: normalizeString(pack.family_name),
    familyId: Number(pack.family_id) || null,
    packItems: Number(pack.pack_items) || null,
    tags: normalizeString(pack.tags)
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .slice(0, 100),
    color: normalizeString(pack.color),
    colors: normalizeString(pack.colors),
    shape: normalizeString(pack.shape),
    added: Number(pack.added) || null,
    equivalents: Number(pack.equivalents) || null
  };
}

function scoreApiPack(pack, pageMetadata) {
  let score = 0;
  const normalizedApiName = normalizeComparable(pack.description);
  const normalizedPageName = normalizeComparable(pageMetadata.packName);
  const normalizedAuthor = normalizeComparable(pageMetadata.authorName);
  const normalizedTeam = normalizeComparable(pack.teamName);

  if (normalizedApiName && normalizedPageName) {
    if (normalizedApiName === normalizedPageName) {
      score += 80;
    } else if (normalizedApiName.includes(normalizedPageName) || normalizedPageName.includes(normalizedApiName)) {
      score += 40;
    }
  }

  if (normalizedAuthor && normalizedTeam) {
    if (normalizedAuthor === normalizedTeam) {
      score += 40;
    } else if (normalizedTeam.includes(normalizedAuthor) || normalizedAuthor.includes(normalizedTeam)) {
      score += 20;
    }
  }

  if (pageMetadata.stickerCount && pack.packItems && pageMetadata.stickerCount === pack.packItems) {
    score += 15;
  }

  if (pageMetadata.sourceSlug) {
    const slugParts = pageMetadata.sourceSlug.replace(/-/g, ' ');
    if (normalizedApiName.includes(normalizeComparable(slugParts))) {
      score += 10;
    }
  }

  return score;
}

async function fetchPackById(client, token, packId) {
  const response = await client.get(`${FLATICON_API_BASE_URL}/item/pack/${encodeURIComponent(String(packId))}`, {
    params: { iconType: 'sticker' },
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${token}`
    }
  });

  if (response.status >= 400) {
    return null;
  }

  return sanitizeApiPack(response.data?.data);
}

async function searchPack(client, token, pageMetadata) {
  const queries = pickSearchQueries(pageMetadata);
  let best = null;
  let bestScore = -1;

  for (const query of queries) {
    const response = await client.get(`${FLATICON_API_BASE_URL}/search/packs`, {
      params: {
        q: query,
        iconType: 'sticker',
        limit: 50
      },
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${token}`
      }
    });

    if (response.status >= 400) {
      continue;
    }

    const rows = Array.isArray(response.data?.data) ? response.data.data : [];
    for (const row of rows) {
      const candidate = sanitizeApiPack(row);
      if (!candidate) {
        continue;
      }
      const score = scoreApiPack(candidate, pageMetadata);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }

    if (bestScore >= 120) {
      break;
    }
  }

  return best;
}

function buildMetadataResult(pageMetadata, apiPack) {
  const metadata = {
    provider: 'flaticon',
    sourceUrl: pageMetadata.sourceUrl,
    canonicalUrl: pageMetadata.canonicalUrl || pageMetadata.sourceUrl,
    sourceSlug: pageMetadata.sourceSlug,
    packName: normalizeString(apiPack?.description || pageMetadata.packName),
    authorName: normalizeString(pageMetadata.authorName || apiPack?.teamName),
    authorUrl: normalizeString(pageMetadata.authorUrl),
    styleName: normalizeString(pageMetadata.styleName),
    stickerCount: apiPack?.packItems || pageMetadata.stickerCount || null,
    familyName: normalizeString(apiPack?.familyName),
    familyId: apiPack?.familyId || null,
    color: normalizeString(apiPack?.color),
    colors: normalizeString(apiPack?.colors),
    shape: normalizeString(apiPack?.shape),
    tags: Array.isArray(apiPack?.tags) ? apiPack.tags : [],
    addedAt: apiPack?.added || null,
    downloadFormats: Array.isArray(pageMetadata.downloadFormats) ? pageMetadata.downloadFormats : [],
    license: pageMetadata.license || null,
    sourcePackId: apiPack?.id || null,
    apiMatched: Boolean(apiPack?.id),
    resolvedAt: Date.now()
  };

  return {
    metadata,
    suggested: {
      name: metadata.packName || 'Sticker pack',
      sourceProvider: 'flaticon',
      sourceReference: metadata.sourceUrl,
      licenseNote: metadata.license?.label
        ? `${metadata.license.label}${metadata.license.attributionRequired ? ' · attribution required' : ''}`
        : ''
    }
  };
}

async function resolveFlaticonPackMetadata(sourceUrl) {
  const normalizedUrl = normalizeFlaticonUrl(sourceUrl);
  if (!normalizedUrl) {
    const error = new Error('invalid_flaticon_url');
    error.status = 400;
    throw error;
  }

  const client = buildHttpClient();
  const pageResponse = await client.get(normalizedUrl);
  if (pageResponse.status >= 400) {
    const error = new Error('flaticon_page_unavailable');
    error.status = pageResponse.status === 404 ? 404 : 502;
    throw error;
  }

  const pageMetadata = extractPageMetadata(pageResponse.data, normalizedUrl);
  let apiPack = null;
  let apiError = null;

  try {
    const token = await authenticateFlaticonApi(client);
    if (token) {
      for (const candidateId of pageMetadata.packIdCandidates) {
        apiPack = await fetchPackById(client, token, candidateId);
        if (apiPack) {
          break;
        }
      }
      if (!apiPack) {
        apiPack = await searchPack(client, token, pageMetadata);
      }
    }
  } catch (error) {
    apiError = error instanceof Error ? error.message : String(error);
  }

  const result = buildMetadataResult(pageMetadata, apiPack);
  if (apiError) {
    result.metadata.apiWarning = apiError;
  }
  return result;
}

module.exports = {
  normalizeFlaticonUrl,
  resolveFlaticonPackMetadata
};
