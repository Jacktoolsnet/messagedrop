const axios = require('axios');

const queues = new Map();
const inFlight = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function headers() {
  return {
    'User-Agent': process.env.WIKIPEDIA_USER_AGENT || 'MessageDrop-WikipediaBot/1.0 (https://messagedrop.de/; support@messagedrop.de)',
    Accept: 'application/json'
  };
}

function queueFor(language) {
  if (!queues.has(language)) queues.set(language, Promise.resolve());
  return queues.get(language);
}

function retryDelay(error, attempt) {
  const retryAfter = Number(error?.response?.headers?.['retry-after']);
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return retryAfter * 1000;
  return Math.min(8000, 500 * (2 ** attempt)) + Math.floor(Math.random() * 250);
}

function isRetryable(error) {
  const status = error?.response?.status;
  const code = error?.response?.data?.error?.code;
  return status === 429 || status === 502 || status === 503 || status === 504 || code === 'maxlag' || code === 'ratelimited';
}

async function requestTile(language, bounds) {
  const timeout = Number(process.env.WIKIPEDIA_UPSTREAM_TIMEOUT_MS || 10000);
  const params = {
    action: 'query', format: 'json', formatversion: 2, generator: 'geosearch',
    ggsbbox: `${bounds.north}|${bounds.west}|${bounds.south}|${bounds.east}`,
    ggsprimary: 'primary', ggslimit: Number(process.env.WIKIPEDIA_TILE_RESULT_LIMIT || 100),
    prop: 'coordinates|pageimages|extracts|info', piprop: 'thumbnail',
    pithumbsize: Number(process.env.WIKIPEDIA_THUMBNAIL_SIZE || 240),
    exintro: 1, explaintext: 1, exchars: Number(process.env.WIKIPEDIA_EXTRACT_CHARS || 280),
    inprop: 'url', redirects: 1
  };
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await axios.get(`https://${language}.wikipedia.org/w/api.php`, {
        params, timeout, headers: headers()
      });
      if (response.data?.error) {
        const error = new Error(response.data.error.info || response.data.error.code);
        error.response = { status: response.status, headers: response.headers, data: response.data };
        error.status = response.data.error.code === 'maxlag' || response.data.error.code === 'ratelimited' ? 503 : 502;
        throw error;
      }
      return (response.data?.query?.pages || []).map((page) => ({
        pageId: page.pageid,
        title: page.title,
        latitude: page.coordinates?.[0]?.lat,
        longitude: page.coordinates?.[0]?.lon,
        summary: page.extract || '',
        thumbnail: page.thumbnail ? { url: page.thumbnail.source, width: page.thumbnail.width, height: page.thumbnail.height } : null,
        imageTitle: page.pageimage || null,
        articleUrl: page.fullurl || `https://${language}.wikipedia.org/?curid=${page.pageid}`
      })).filter((page) => Number.isFinite(page.latitude) && Number.isFinite(page.longitude));
    } catch (error) {
      lastError = error;
      if (!isRetryable(error) || attempt === 2) {
        error.status = error.status || (error.response?.status >= 400 ? error.response.status : 502);
        throw error;
      }
      await sleep(retryDelay(error, attempt));
    }
  }
  throw lastError;
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
    action: 'query', format: 'json', formatversion: 2, titles: title,
    prop: 'imageinfo', iiprop: 'url|extmetadata'
  };
  for (const host of ['commons.wikimedia.org', `${language}.wikipedia.org`]) {
    try {
      const response = await axios.get(`https://${host}/w/api.php`, {
        params, timeout: Number(process.env.WIKIPEDIA_UPSTREAM_TIMEOUT_MS || 10000), headers: headers()
      });
      const info = response.data?.query?.pages?.[0]?.imageinfo?.[0];
      if (!info) continue;
      const meta = info.extmetadata || {};
      const license = metadataValue(meta, 'LicenseShortName') || metadataValue(meta, 'UsageTerms');
      const licenseUrl = metadataValue(meta, 'LicenseUrl');
      const creator = metadataValue(meta, 'Artist');
      if (!license || !info.descriptionurl) continue;
      return {
        resolved: true,
        creator,
        credit: metadataValue(meta, 'Credit'),
        license,
        licenseUrl,
        sourceUrl: info.descriptionurl,
        attributionRequired: metadataValue(meta, 'AttributionRequired').toLowerCase() !== 'false'
      };
    } catch {
      // Try the local Wikipedia file repository after Commons.
    }
  }
  return null;
}

async function requestAttribution(language, title, imageTitle) {
  let signals = null;
  try {
    const response = await axios.get(
      `https://${language}.wikipedia.org/w/rest.php/attribution/v0-beta/pages/${encodeURIComponent(title.replace(/ /g, '_'))}/signals`,
      { timeout: Number(process.env.WIKIPEDIA_UPSTREAM_TIMEOUT_MS || 10000), headers: headers() }
    );
    signals = response.data || null;
  } catch {
    // The beta API is optional. Stable Action API metadata is used as fallback.
  }

  const articleUrl = `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
  const article = {
    provider: findSignalValue(signals, ['provider_name', 'project_name']) || 'Wikipedia',
    sourceUrl: findSignalValue(signals, ['source_url', 'page_url']) || articleUrl,
    license: findSignalValue(signals, ['license_name', 'license_short_name']) || 'CC BY-SA 4.0',
    licenseUrl: findSignalValue(signals, ['license_url']) || 'https://creativecommons.org/licenses/by-sa/4.0/',
    creator: findSignalValue(signals, ['creator_name', 'author_name', 'attribution_text']) || 'Wikipedia contributors',
    source: signals ? 'attribution-api' : 'terms-fallback'
  };

  let image = null;
  if (imageTitle) {
    const signalLicense = findSignalValue(signals, ['media_license_name', 'image_license_name']);
    const signalSourceUrl = findSignalValue(signals, ['media_source_url', 'image_source_url', 'file_description_url']);
    if (signalLicense && signalSourceUrl) {
      image = {
        resolved: true,
        creator: findSignalValue(signals, ['media_creator_name', 'image_creator_name']),
        credit: findSignalValue(signals, ['media_credit', 'image_credit']),
        license: signalLicense,
        licenseUrl: findSignalValue(signals, ['media_license_url', 'image_license_url']),
        sourceUrl: signalSourceUrl,
        attributionRequired: true,
        source: 'attribution-api'
      };
    } else {
      const fallback = await fetchImageInfo(language, imageTitle);
      image = fallback ? { ...fallback, source: 'imageinfo' } : { resolved: false, source: 'unresolved' };
    }
  }
  return { article, image };
}

function fetchAttribution(language, title, imageTitle) {
  const key = `attribution:${language}:${title}:${imageTitle || ''}`;
  if (inFlight.has(key)) return inFlight.get(key);
  const previous = queueFor(language);
  const task = previous.catch(() => undefined).then(async () => {
    await sleep(Number(process.env.WIKIPEDIA_REQUEST_INTERVAL_MS || 150));
    return requestAttribution(language, title, imageTitle);
  });
  queues.set(language, task.catch(() => undefined));
  inFlight.set(key, task);
  return task.finally(() => inFlight.delete(key));
}

function fetchTile(language, cacheKey, bounds) {
  const key = `${language}:${cacheKey}`;
  if (inFlight.has(key)) return inFlight.get(key);
  const previous = queueFor(language);
  const task = previous.catch(() => undefined).then(async () => {
    await sleep(Number(process.env.WIKIPEDIA_REQUEST_INTERVAL_MS || 150));
    return requestTile(language, bounds);
  });
  queues.set(language, task.catch(() => undefined));
  inFlight.set(key, task);
  return task.finally(() => inFlight.delete(key));
}

module.exports = { fetchTile, fetchAttribution };
