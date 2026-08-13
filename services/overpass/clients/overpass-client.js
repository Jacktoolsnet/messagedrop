const axios = require('axios');

const DEFAULT_BASE_URL = 'https://overpass-api.de/api/interpreter';

function createOverpassClient({
  baseURL = process.env.OVERPASS_API_BASE_URL || DEFAULT_BASE_URL,
  timeout = Number(process.env.OVERPASS_API_TIMEOUT_MS || 20000),
  maxResponseBytes = Number(process.env.OVERPASS_MAX_RESPONSE_BYTES || 10 * 1024 * 1024)
} = {}) {
  const normalizedBaseUrl = normalizeBaseUrl(baseURL);
  const normalizedTimeout = positiveInteger(timeout, 20000);
  const normalizedMaxBytes = positiveInteger(maxResponseBytes, 10 * 1024 * 1024);
  const http = axios.create({
    baseURL: normalizedBaseUrl,
    timeout: normalizedTimeout,
    maxContentLength: normalizedMaxBytes,
    maxBodyLength: 1024 * 1024,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': process.env.OVERPASS_USER_AGENT || 'MessageDrop-Overpass-Service/1.0'
    }
  });

  async function query(queryText) {
    if (typeof queryText !== 'string' || !queryText.trim()) throw new Error('overpass_query_required');
    const body = new URLSearchParams({ data: queryText });
    const response = await http.post('', body.toString());
    return unwrap(response);
  }

  return {
    query,
    health: () => query('[out:json][timeout:5];node(1);out ids 1;')
  };
}

function normalizeBaseUrl(value) {
  const parsed = new URL(String(value || DEFAULT_BASE_URL));
  if (parsed.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && parsed.protocol === 'http:')) {
    throw new Error('OVERPASS_API_BASE_URL must use HTTPS');
  }
  if (!parsed.hostname) throw new Error('OVERPASS_API_BASE_URL is invalid');
  return parsed.toString();
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function unwrap(response) {
  return { data: response.data, status: response.status, headers: response.headers };
}

module.exports = { createOverpassClient, normalizeBaseUrl };
