const axios = require('axios');
const http = require('node:http');
const https = require('node:https');

const DEFAULT_BASE_URLS = Object.freeze([
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter'
]);

function createOverpassClient({
  baseURL,
  baseURLs,
  timeout = Number(process.env.OVERPASS_API_TIMEOUT_MS || 20000),
  maxResponseBytes = Number(process.env.OVERPASS_MAX_RESPONSE_BYTES || 10 * 1024 * 1024),
  ipFamily = Number(process.env.OVERPASS_IP_FAMILY || 4)
} = {}) {
  const configuredUrls = baseURLs
    || process.env.OVERPASS_API_BASE_URLS
    || baseURL
    || process.env.OVERPASS_API_BASE_URL;
  const normalizedBaseUrls = normalizeBaseUrls(configuredUrls);
  const normalizedTimeout = positiveInteger(timeout, 20000);
  const normalizedMaxBytes = positiveInteger(maxResponseBytes, 10 * 1024 * 1024);
  const normalizedIpFamily = [0, 4, 6].includes(ipFamily) ? ipFamily : 4;
  const agentOptions = { keepAlive: true, ...(normalizedIpFamily ? { family: normalizedIpFamily } : {}) };
  const httpAgent = new http.Agent(agentOptions);
  const httpsAgent = new https.Agent(agentOptions);
  const clients = normalizedBaseUrls.map((normalizedBaseUrl) => axios.create({
    baseURL: normalizedBaseUrl,
    timeout: normalizedTimeout,
    maxContentLength: normalizedMaxBytes,
    maxBodyLength: 1024 * 1024,
    httpAgent,
    httpsAgent,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': process.env.OVERPASS_USER_AGENT || 'MessageDrop-Overpass-Service/1.0'
    }
  }));

  async function query(queryText) {
    if (typeof queryText !== 'string' || !queryText.trim()) throw new Error('overpass_query_required');
    const body = new URLSearchParams({ data: queryText }).toString();
    let lastError;
    const attempts = [];
    for (const client of clients) {
      try {
        return unwrap(await client.post('', body));
      } catch (error) {
        lastError = error;
        attempts.push(`${new URL(client.defaults.baseURL).hostname}: ${upstreamErrorLabel(error)}`);
        if (!isRetryableUpstreamError(error)) throw error;
      }
    }
    if (lastError) lastError.message = `All Overpass instances failed (${attempts.join('; ')})`;
    throw lastError;
  }

  return {
    query,
    health: () => query('[out:json][timeout:5];node(1);out ids 1;')
  };
}

function normalizeBaseUrls(value) {
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : DEFAULT_BASE_URLS;
  const normalized = values.map((item) => normalizeBaseUrl(String(item).trim()));
  if (!normalized.length) throw new Error('At least one Overpass API base URL is required');
  return [...new Set(normalized)];
}

function normalizeBaseUrl(value) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && parsed.protocol === 'http:')) {
    throw new Error('OVERPASS_API_BASE_URL must use HTTPS');
  }
  if (!parsed.hostname) throw new Error('OVERPASS_API_BASE_URL is invalid');
  return parsed.toString();
}

function isRetryableUpstreamError(error) {
  if (!axios.isAxiosError(error)) return false;
  if (!error.response) return true;
  return [429, 502, 503, 504].includes(error.response.status);
}

function upstreamErrorLabel(error) {
  return error?.response?.status
    ? `HTTP ${error.response.status}`
    : error?.code || error?.message || 'unknown error';
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function unwrap(response) {
  return { data: response.data, status: response.status, headers: response.headers };
}

module.exports = {
  DEFAULT_BASE_URLS,
  createOverpassClient,
  isRetryableUpstreamError,
  normalizeBaseUrl,
  normalizeBaseUrls,
  upstreamErrorLabel
};
