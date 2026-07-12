const axios = require('axios');

const queues = new Map();
const inFlight = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const userAgent = process.env.WIKIPEDIA_USER_AGENT || 'MessageDrop-WikipediaBot/1.0 (https://messagedrop.de/; support@messagedrop.de)';
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
        params, timeout, headers: { 'User-Agent': userAgent, Accept: 'application/json' }
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

module.exports = { fetchTile };
