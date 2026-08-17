const dns = require('node:dns');
const https = require('node:https');
const net = require('node:net');

const DEFAULT_MAX_BYTES = 256 * 1024;
const DEFAULT_TIMEOUT_MS = 8000;

function createWebsiteMetadataClient({
  timeoutMs = Number(process.env.GEODATA_WEBSITE_METADATA_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  maxBytes = Number(process.env.GEODATA_WEBSITE_METADATA_MAX_BYTES || DEFAULT_MAX_BYTES),
  maxRedirects = Number(process.env.GEODATA_WEBSITE_METADATA_MAX_REDIRECTS || 3),
  userAgent = process.env.GEODATA_USER_AGENT || 'MessageDrop-Geodata-Service/1.0',
  lookup = dns.promises.lookup
} = {}) {
  const options = {
    timeoutMs: positiveInteger(timeoutMs, DEFAULT_TIMEOUT_MS),
    maxBytes: positiveInteger(maxBytes, DEFAULT_MAX_BYTES),
    maxRedirects: nonNegativeInteger(maxRedirects, 3),
    userAgent,
    lookup
  };
  return {
    fetch: async (value) => {
      try {
        const url = validateWebsiteUrl(value);
        const response = await fetchHtmlHead(url, options);
        return {
          ...parseWebsiteMetadata(response.html, response.url),
          fetchedAt: new Date().toISOString()
        };
      } catch (error) {
        if (error?.status) throw error;
        const wrapped = clientError('website_metadata_upstream_error', 502, {
          networkCode: error?.code || null
        });
        wrapped.cause = error;
        throw wrapped;
      }
    }
  };
}

async function fetchHtmlHead(url, options, redirectCount = 0) {
  const addresses = await options.lookup(hostnameValue(url), { all: true, verbatim: true });
  const resolved = Array.isArray(addresses) ? addresses : [addresses];
  if (resolved.length === 0 || resolved.some(({ address }) => !isPublicIp(address))) {
    throw clientError('website_metadata_private_address', 400);
  }
  const pinned = resolved[0];

  return new Promise((resolve, reject) => {
    let settled = false;
    const request = https.request(url, {
      method: 'GET',
      timeout: options.timeoutMs,
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9',
        'User-Agent': options.userAgent
      },
      lookup: (_hostname, lookupOptions, callback) => {
        // Newer Node versions may request all addresses for automatic family
        // selection. The callback shape is different in that mode.
        if (lookupOptions?.all) {
          callback(null, resolved.map(({ address, family }) => ({ address, family })));
          return;
        }
        callback(null, pinned.address, pinned.family);
      }
    }, (response) => {
      const status = response.statusCode || 502;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        if (redirectCount >= options.maxRedirects) {
          rejectOnce(clientError('website_metadata_too_many_redirects', 502));
          return;
        }
        let target;
        try {
          target = validateWebsiteUrl(new URL(response.headers.location, url).toString());
        } catch (error) {
          rejectOnce(error);
          return;
        }
        fetchHtmlHead(target, options, redirectCount + 1).then(resolveOnce, rejectOnce);
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        rejectOnce(clientError('website_metadata_http_error', status >= 500 ? 502 : status, {
          httpStatus: status,
          retryAfterMs: parseRetryAfter(response.headers['retry-after'])
        }));
        return;
      }
      const contentType = String(response.headers['content-type'] || '').toLowerCase();
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        response.resume();
        rejectOnce(clientError('website_metadata_not_html', 415));
        return;
      }

      const chunks = [];
      let bytes = 0;
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        if (settled) return;
        bytes += Buffer.byteLength(chunk);
        if (bytes > options.maxBytes) {
          response.destroy();
          rejectOnce(clientError('website_metadata_head_too_large', 413));
          return;
        }
        chunks.push(chunk);
        const html = chunks.join('');
        const end = html.search(/<\/head\s*>/iu);
        if (end !== -1) {
          response.destroy();
          resolveOnce({ html: html.slice(0, end + 7), url: url.toString() });
        }
      });
      response.on('end', () => resolveOnce({ html: chunks.join(''), url: url.toString() }));
      response.on('error', rejectOnce);
    });
    request.on('timeout', () => request.destroy(clientError('website_metadata_timeout', 504)));
    request.on('error', rejectOnce);
    request.end();

    function resolveOnce(value) {
      if (settled) return;
      settled = true;
      resolve(value);
    }
    function rejectOnce(error) {
      if (settled) return;
      settled = true;
      reject(error);
    }
  });
}

function parseWebsiteMetadata(html, sourceUrl) {
  const htmlTag = String(html || '').match(/<html\b([^>]*)>/iu);
  const htmlAttributes = parseAttributes(htmlTag?.[1] || '');
  const head = String(html || '').match(/<head\b([^>]*)>([\s\S]*?)(?:<\/head\s*>|$)/iu);
  const headAttributes = parseAttributes(head?.[1] || '');
  const content = head?.[2] || '';
  const meta = new Map();
  for (const match of content.matchAll(/<meta\b((?:"[^"]*"|'[^']*'|[^'">])*)>/giu)) {
    const attributes = parseAttributes(match[1]);
    const key = String(attributes.property || attributes.name || '').trim().toLowerCase();
    if (key && typeof attributes.content === 'string' && !meta.has(key)) {
      meta.set(key, cleanText(attributes.content));
    }
  }
  const links = [...content.matchAll(/<link\b((?:"[^"]*"|'[^']*'|[^'">])*)>/giu)]
    .map((match) => parseAttributes(match[1]));
  const titleMatch = content.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/iu);
  const structuredData = [];
  for (const match of content.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/giu)) {
    const attributes = parseAttributes(match[1]);
    if (String(attributes.type || '').toLowerCase() !== 'application/ld+json') continue;
    try {
      structuredData.push(JSON.parse(match[2]));
    } catch {
      // Invalid publisher-provided JSON-LD is ignored rather than failing the request.
    }
    if (structuredData.length >= 10) break;
  }

  const canonical = linkByRel(links, 'canonical');
  const favicon = linkByRel(links, 'icon') || linkByRel(links, 'shortcut icon');
  const title = firstText(meta.get('og:title'), meta.get('twitter:title'), cleanText(titleMatch?.[1]));
  const description = firstText(meta.get('og:description'), meta.get('twitter:description'), meta.get('description'));
  const image = firstText(meta.get('og:image'), meta.get('twitter:image'));
  return compact({
    url: sourceUrl,
    canonicalUrl: resolveReference(canonical, sourceUrl),
    language: firstText(htmlAttributes.lang, headAttributes.lang, meta.get('content-language'), meta.get('og:locale')),
    title,
    description,
    image: resolveReference(image, sourceUrl),
    favicon: resolveReference(favicon, sourceUrl),
    siteName: meta.get('og:site_name') || null,
    type: meta.get('og:type') || null,
    openGraph: prefixedMetadata(meta, 'og:'),
    twitterCard: prefixedMetadata(meta, 'twitter:'),
    structuredData: structuredData.length > 0 ? structuredData : null
  });
}

function validateWebsiteUrl(value) {
  let url;
  try {
    url = new URL(String(value || ''));
  } catch {
    throw clientError('invalid_website_url', 400);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw clientError('invalid_website_url', 400);
  }
  const hostname = hostnameValue(url);
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw clientError('invalid_website_url', 400);
  }
  if (net.isIP(hostname) && !isPublicIp(hostname)) throw clientError('website_metadata_private_address', 400);
  url.hash = '';
  return url;
}

function hostnameValue(url) {
  return url.hostname.toLowerCase().replace(/^\[|\]$/gu, '').replace(/\.$/u, '');
}

function isPublicIp(value) {
  const family = net.isIP(value);
  if (family === 4) {
    const [a, b] = value.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 0)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19)));
  }
  if (family === 6) {
    const normalized = value.toLowerCase();
    const mappedIpv4 = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/u)?.[1];
    if (mappedIpv4) return isPublicIp(mappedIpv4);
    return !(normalized === '::' || normalized === '::1'
      || normalized.startsWith('fc') || normalized.startsWith('fd')
      || /^fe[89ab]/u.test(normalized)
      || normalized.startsWith('ff')
      || normalized.startsWith('2001:db8:'));
  }
  return false;
}

function parseAttributes(value) {
  const attributes = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/gu;
  for (const match of String(value || '').matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

function prefixedMetadata(meta, prefix) {
  const result = {};
  for (const [key, value] of meta.entries()) {
    if (key.startsWith(prefix)) result[key.slice(prefix.length)] = value;
  }
  return Object.keys(result).length > 0 ? result : null;
}

function linkByRel(links, relation) {
  return links.find((attributes) => String(attributes.rel || '').toLowerCase().split(/\s+/u).includes(relation))?.href || null;
}

function resolveReference(value, base) {
  if (!value) return null;
  try {
    return new URL(value, base).toString();
  } catch {
    return null;
  }
}

function cleanText(value) {
  if (typeof value !== 'string') return null;
  const text = decodeEntities(value.replace(/<[^>]*>/gu, ' ')).replace(/\s+/gu, ' ').trim();
  return text || null;
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&quot;/giu, '"').replace(/&#39;|&apos;/giu, "'")
    .replace(/&lt;/giu, '<').replace(/&gt;/giu, '>').replace(/&amp;/giu, '&')
    .replace(/&#(\d+);/gu, (match, code) => decodeCodePoint(match, Number(code)))
    .replace(/&#x([\da-f]+);/giu, (match, code) => decodeCodePoint(match, Number.parseInt(code, 16)));
}

function decodeCodePoint(fallback, value) {
  return Number.isInteger(value) && value >= 0 && value <= 0x10FFFF
    ? String.fromCodePoint(value)
    : fallback;
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined));
}

function firstText(...values) {
  return values.find((value) => typeof value === 'string' && value.trim())?.trim() || null;
}

function positiveInteger(value, fallback) {
  return Number.isInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback;
}

function nonNegativeInteger(value, fallback) {
  return Number.isInteger(Number(value)) && Number(value) >= 0 ? Number(value) : fallback;
}

function parseRetryAfter(value, now = Date.now()) {
  if (Array.isArray(value)) value = value[0];
  if (typeof value !== 'string' || !value.trim()) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp > now ? timestamp - now : null;
}

function clientError(message, status, details = {}) {
  const error = new Error(message);
  error.status = status;
  error.errorCode = message;
  Object.assign(error, details);
  return error;
}

module.exports = {
  createWebsiteMetadataClient,
  parseWebsiteMetadata,
  parseRetryAfter,
  validateWebsiteUrl,
  isPublicIp
};
