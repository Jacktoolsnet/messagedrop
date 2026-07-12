const axios = require('axios');

const queues = new Map();
const inFlight = new Map();
let pendingJobs = 0;
let upstreamBlockedUntil = 0;
const metrics = {
  upstreamRequests: 0,
  attributionApiFallbacks: 0,
  imageInfoFallbacks: 0,
  rejectedQueueJobs: 0
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function headers() {
  return {
    'User-Agent': process.env.WIKIPEDIA_USER_AGENT || 'MessageDrop-WikipediaBot/1.0 (https://messagedrop.de/; support@messagedrop.de)',
    Accept: 'application/json'
  };
}

function safeHttpsUrl(value, fallback = '') {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

function queueFor(language) {
  if (!queues.has(language)) queues.set(language, Promise.resolve());
  return queues.get(language);
}

function parseRetryAfterMs(value, now = Date.now()) {
  if (value === undefined || value === null || value === '') return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(String(value));
  return Number.isFinite(date) ? Math.max(0, date - now) : null;
}

function retryDelay(error, attempt) {
  const retryAfter = parseRetryAfterMs(error?.response?.headers?.['retry-after']);
  if (retryAfter !== null) return retryAfter;
  return Math.min(8000, 500 * (2 ** attempt)) + Math.floor(Math.random() * 250);
}

function isRetryable(error) {
  const status = error?.response?.status;
  const code = error?.response?.data?.error?.code;
  return status === 429 || status === 502 || status === 503 || status === 504 || code === 'maxlag' || code === 'ratelimited';
}

async function waitForUpstreamCooldown() {
  const remaining = upstreamBlockedUntil - Date.now();
  if (remaining > 0) await sleep(remaining);
}

async function wikipediaGet(url, config = {}) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await waitForUpstreamCooldown();
      metrics.upstreamRequests += 1;
      const response = await axios.get(url, config);
      if (response.data?.error) {
        const error = new Error(response.data.error.info || response.data.error.code);
        error.response = { status: response.status, headers: response.headers, data: response.data };
        error.status = response.data.error.code === 'maxlag' || response.data.error.code === 'ratelimited' ? 503 : 502;
        throw error;
      }
      return response;
    } catch (error) {
      lastError = error;
      const retryable = isRetryable(error);
      if (!retryable) {
        error.status = error.status || (error.response?.status >= 400 ? error.response.status : 502);
        throw error;
      }
      const delay = retryDelay(error, attempt);
      // Retry-After applies to this operator, not just to the current request.
      // Share the cooldown across all languages and queued Wikimedia jobs.
      upstreamBlockedUntil = Math.max(upstreamBlockedUntil, Date.now() + delay);
      const upstreamCode = error?.response?.data?.error?.code;
      if (error?.response?.status === 429 || upstreamCode === 'ratelimited' || upstreamCode === 'maxlag') {
        error.status = 503;
        error.errorCode = 'WIKIMEDIA_RATE_LIMIT';
        error.retryAfterSeconds = Math.max(1, Math.ceil(delay / 1000));
      }
      if (attempt === 2) {
        error.status = error.status || (error.response?.status >= 400 ? error.response.status : 502);
        throw error;
      }
      await waitForUpstreamCooldown();
    }
  }
  throw lastError;
}

async function requestTile(language, bounds) {
  const timeout = Number(process.env.WIKIPEDIA_UPSTREAM_TIMEOUT_MS || 10000);
  const params = {
    action: 'query', format: 'json', formatversion: 2, maxlag: 5, generator: 'geosearch',
    ggsbbox: `${bounds.north}|${bounds.west}|${bounds.south}|${bounds.east}`,
    // TextExtracts returns at most 20 extracts per response. Keep GeoSearch batches
    // at the same size so every returned page can receive a summary.
    ggsprimary: 'primary', ggslimit: Math.min(20, Number(process.env.WIKIPEDIA_TILE_RESULT_LIMIT || 20)),
    prop: 'coordinates|pageimages|extracts|pageterms|info', piprop: 'thumbnail|name',
    pithumbsize: Number(process.env.WIKIPEDIA_THUMBNAIL_SIZE || 240),
    exintro: 1, explaintext: 1, exlimit: 'max', exchars: Number(process.env.WIKIPEDIA_EXTRACT_CHARS || 280),
    wbptterms: 'description',
    inprop: 'url', redirects: 1
  };
  const articles = new Map();
  let continuation = {};
  const resultLimit = Math.min(500, Number(process.env.WIKIPEDIA_MAX_RESULTS_PER_TILE || 500));
  while (articles.size < resultLimit) {
    const response = await wikipediaGet(`https://${language}.wikipedia.org/w/api.php`, {
      params: { ...params, ...continuation }, timeout, headers: headers()
    });
    for (const page of response.data?.query?.pages || []) {
      const fallbackArticleUrl = `https://${language}.wikipedia.org/?curid=${page.pageid}`;
      const thumbnailUrl = safeHttpsUrl(page.thumbnail?.source);
      const article = {
        pageId: page.pageid,
        title: page.title,
        latitude: page.coordinates?.[0]?.lat,
        longitude: page.coordinates?.[0]?.lon,
        summary: page.extract || page.terms?.description?.[0] || '',
        thumbnail: thumbnailUrl ? { url: thumbnailUrl, width: page.thumbnail.width, height: page.thumbnail.height } : null,
        imageTitle: page.pageimage || null,
        articleUrl: safeHttpsUrl(page.fullurl, fallbackArticleUrl)
      };
      if (Number.isFinite(article.latitude) && Number.isFinite(article.longitude)) articles.set(article.pageId, article);
    }
    if (!response.data?.continue || articles.size >= resultLimit) break;
    continuation = response.data.continue;
    await sleep(Number(process.env.WIKIPEDIA_REQUEST_INTERVAL_MS || 150));
  }
  return Array.from(articles.values()).slice(0, resultLimit);
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function metadataValue(metadata, key) {
  return stripHtml(metadata?.[key]?.value || '');
}

function findSignalValue(value, keys, depth = 0) {
  if (!value || depth > 8) return '';
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findSignalValue(item, keys, depth + 1);
      if (found) return found;
    }
    return '';
  }
  if (typeof value !== 'object') return '';
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) return stripHtml(candidate);
  }
  for (const candidate of Object.values(value)) {
    const found = findSignalValue(candidate, keys, depth + 1);
    if (found) return found;
  }
  return '';
}

async function fetchImageInfo(language, imageTitle) {
  if (!imageTitle) return null;
  const title = imageTitle.startsWith('File:') ? imageTitle : `File:${imageTitle}`;
  const params = {
    action: 'query', format: 'json', formatversion: 2, maxlag: 5, titles: title,
    prop: 'imageinfo', iiprop: 'url|extmetadata'
  };
  for (const host of ['commons.wikimedia.org', `${language}.wikipedia.org`]) {
    try {
      const response = await wikipediaGet(`https://${host}/w/api.php`, {
        params, timeout: Number(process.env.WIKIPEDIA_UPSTREAM_TIMEOUT_MS || 10000), headers: headers()
      });
      const info = response.data?.query?.pages?.[0]?.imageinfo?.[0];
      if (!info) continue;
      const meta = info.extmetadata || {};
      const license = metadataValue(meta, 'LicenseShortName') || metadataValue(meta, 'UsageTerms');
      const licenseUrl = metadataValue(meta, 'LicenseUrl');
      const creator = metadataValue(meta, 'Artist');
      const credit = metadataValue(meta, 'Credit');
      const attributionRequired = metadataValue(meta, 'AttributionRequired').toLowerCase() !== 'false';
      const sourceUrl = safeHttpsUrl(info.descriptionurl);
      if (!license || !sourceUrl) continue;
      if (attributionRequired && !creator && !credit) continue;
      return {
        resolved: true,
        creator,
        credit,
        license,
        licenseUrl: safeHttpsUrl(licenseUrl),
        sourceUrl,
        attributionRequired
      };
    } catch {
      // Try the local Wikipedia file repository after Commons.
    }
  }
  return null;
}

async function fetchRestSummary(language, title) {
  try {
    const response = await wikipediaGet(
      `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`,
      { timeout: Number(process.env.WIKIPEDIA_UPSTREAM_TIMEOUT_MS || 10000), headers: headers() }
    );
    return stripHtml(response.data?.extract || response.data?.description || '').slice(0, Number(process.env.WIKIPEDIA_EXTRACT_CHARS || 280));
  } catch {
    return '';
  }
}

async function requestAttribution(language, title, imageTitle, needsSummary = false) {
  let signals = null;
  try {
    const response = await wikipediaGet(
      `https://${language}.wikipedia.org/w/rest.php/attribution/v0-beta/pages/${encodeURIComponent(title.replace(/ /g, '_'))}/signals`,
      { timeout: Number(process.env.WIKIPEDIA_UPSTREAM_TIMEOUT_MS || 10000), headers: headers() }
    );
    signals = response.data || null;
  } catch {
    metrics.attributionApiFallbacks += 1;
    // The beta API is optional. Stable Action API metadata is used as fallback.
  }

  const articleUrl = `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const signalArticleSource = safeHttpsUrl(findSignalValue(signals, ['source_url', 'page_url']));
  const signalArticleLicense = safeHttpsUrl(findSignalValue(signals, ['license_url']));
  const article = {
    provider: findSignalValue(signals, ['provider_name', 'project_name']) || 'Wikipedia',
    sourceUrl: signalArticleSource || articleUrl,
    license: findSignalValue(signals, ['license_name', 'license_short_name']) || 'CC BY-SA 4.0',
    licenseUrl: signalArticleLicense || 'https://creativecommons.org/licenses/by-sa/4.0/',
    creator: findSignalValue(signals, ['creator_name', 'author_name', 'attribution_text']) || 'Wikipedia contributors',
    source: signals ? 'attribution-api' : 'terms-fallback'
  };

  let image = null;
  if (imageTitle) {
    const signalLicense = findSignalValue(signals, ['media_license_name', 'image_license_name']);
    const signalSourceUrl = findSignalValue(signals, ['media_source_url', 'image_source_url', 'file_description_url']);
    const signalCreator = findSignalValue(signals, ['media_creator_name', 'image_creator_name']);
    const signalCredit = findSignalValue(signals, ['media_credit', 'image_credit']);
    const safeSignalSourceUrl = safeHttpsUrl(signalSourceUrl);
    if (signalLicense && safeSignalSourceUrl && (signalCreator || signalCredit)) {
      image = {
        resolved: true,
        creator: signalCreator,
        credit: signalCredit,
        license: signalLicense,
        licenseUrl: safeHttpsUrl(findSignalValue(signals, ['media_license_url', 'image_license_url'])),
        sourceUrl: safeSignalSourceUrl,
        attributionRequired: true,
        source: 'attribution-api'
      };
    } else {
      metrics.imageInfoFallbacks += 1;
      const fallback = await fetchImageInfo(language, imageTitle);
      image = fallback ? { ...fallback, source: 'imageinfo' } : { resolved: false, source: 'unresolved' };
    }
  }
  const summary = needsSummary ? await fetchRestSummary(language, title) : '';
  return { article, image, summary };
}

function enqueue(language, key, taskFactory) {
  if (inFlight.has(key)) return inFlight.get(key);
  const maxPending = Number(process.env.WIKIPEDIA_MAX_PENDING_UPSTREAM_JOBS || 100);
  if (pendingJobs >= maxPending) {
    metrics.rejectedQueueJobs += 1;
    const error = new Error('Wikipedia upstream queue overloaded');
    error.status = 503;
    return Promise.reject(error);
  }
  pendingJobs += 1;
  // Wikimedia rate limits apply to the service/operator as a whole. Serialize
  // jobs globally instead of allowing one concurrent stream per language.
  const previous = queueFor('global');
  const task = previous.catch(() => undefined).then(async () => {
    await sleep(Number(process.env.WIKIPEDIA_REQUEST_INTERVAL_MS || 150));
    return taskFactory();
  });
  queues.set('global', task.catch(() => undefined));
  inFlight.set(key, task);
  return task.finally(() => {
    pendingJobs = Math.max(0, pendingJobs - 1);
    inFlight.delete(key);
  });
}

function fetchAttribution(language, title, imageTitle, needsSummary = false) {
  const key = `attribution:${language}:${title}:${imageTitle || ''}:${needsSummary ? 'summary' : 'no-summary'}`;
  return enqueue(language, key, () => requestAttribution(language, title, imageTitle, needsSummary));
}

function fetchTile(language, cacheKey, bounds) {
  const key = `${language}:${cacheKey}`;
  return enqueue(language, key, () => requestTile(language, bounds));
}

function getMetrics() {
  return {
    ...metrics,
    pendingJobs,
    inFlight: inFlight.size,
    upstreamCooldownMs: Math.max(0, upstreamBlockedUntil - Date.now())
  };
}

module.exports = { fetchTile, fetchAttribution, getMetrics, safeHttpsUrl, parseRetryAfterMs };
