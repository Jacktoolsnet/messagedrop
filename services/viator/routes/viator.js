const express = require('express');
const axios = require('axios');
const security = require('../middleware/security');
const tableViatorCache = require('../db/tableViatorCache');

const router = express.Router();

const MAX_BODY_BYTES = 256 * 1024;
const MAX_QUERY_PARAMS = 40;
const MAX_STRING_LEN = 500;
const MAX_TOTAL_KEYS = 200;
const MAX_DEPTH = 4;

const DEFAULT_TIMEOUT_MS = 6000;

const CACHE_TTLS = {
  tags: 60 * 60 * 24, // 24h
  attractionsSearch: 60 * 60, // 1h
  attractionsDetail: 60 * 60 * 6, // 6h
  productsSearch: 60 * 15, // 15m
  productDetail: 60 * 60 * 6, // 6h
  availabilitySchedules: 60 * 30 // 30m
};

const ALLOWED_ENDPOINTS = [
  { method: 'GET', pattern: /^\/products\/tags$/, cacheTtl: CACHE_TTLS.tags },
  { method: 'GET', pattern: /^\/products\/search$/, cacheTtl: CACHE_TTLS.productsSearch },
  { method: 'POST', pattern: /^\/products\/search$/, cacheTtl: CACHE_TTLS.productsSearch },
  { method: 'GET', pattern: /^\/products\/[^/]+$/, cacheTtl: CACHE_TTLS.productDetail },
  { method: 'GET', pattern: /^\/attractions\/search$/, cacheTtl: CACHE_TTLS.attractionsSearch },
  { method: 'POST', pattern: /^\/attractions\/search$/, cacheTtl: CACHE_TTLS.attractionsSearch },
  { method: 'GET', pattern: /^\/attractions\/[^/]+$/, cacheTtl: CACHE_TTLS.attractionsDetail },
  { method: 'GET', pattern: /^\/availability\/schedules\/[^/]+$/, cacheTtl: CACHE_TTLS.availabilitySchedules }
];

function getEndpointConfig(method, path) {
  return ALLOWED_ENDPOINTS.find((entry) => entry.method === method && entry.pattern.test(path)) || null;
}

function normalizeBaseUrl(base) {
  if (!base) return null;
  const trimmed = String(base).trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (!parsed.hostname) {
      return null;
    }
  } catch {
    return null;
  }
  return withScheme;
}

function buildApiClient() {
  const baseUrl = normalizeBaseUrl(process.env.VIATOR_API_BASE_URL);
  if (!baseUrl) {
    return { client: null, error: 'VIATOR_API_BASE_URL is missing or invalid' };
  }
  const apiKey = process.env.VIATOR_API_KEY;
  if (!apiKey) {
    return { client: null, error: 'VIATOR_API_KEY is missing' };
  }
  const client = axios.create({
    baseURL: baseUrl,
    timeout: Number(process.env.VIATOR_API_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
    validateStatus: () => true,
    headers: {
      'content-type': 'application/json'
    }
  });
  return { client, error: null };
}

function sanitizeValue(value, depth, state) {
  if (state.totalKeys > MAX_TOTAL_KEYS) {
    return undefined;
  }
  if (depth > MAX_DEPTH) {
    return undefined;
  }
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LEN ? value.slice(0, MAX_STRING_LEN) : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length > MAX_TOTAL_KEYS) {
      value = value.slice(0, MAX_TOTAL_KEYS);
    }
    return value
      .map((entry) => sanitizeValue(entry, depth + 1, state))
      .filter((entry) => entry !== undefined);
  }
  if (typeof value === 'object') {
    const result = {};
    const entries = Object.entries(value);
    for (const [key, entryValue] of entries) {
      state.totalKeys += 1;
      if (state.totalKeys > MAX_TOTAL_KEYS) {
        break;
      }
      if (typeof key !== 'string') {
        continue;
      }
      const cleaned = sanitizeValue(entryValue, depth + 1, state);
      if (cleaned !== undefined) {
        result[key] = cleaned;
      }
    }
    return result;
  }
  return undefined;
}

function sanitizePayload(value) {
  const state = { totalKeys: 0 };
  return sanitizeValue(value, 0, state);
}

function sanitizeQuery(query) {
  const cleaned = {};
  let count = 0;
  for (const [key, value] of Object.entries(query || {})) {
    if (count >= MAX_QUERY_PARAMS) break;
    if (typeof key !== 'string') continue;
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      cleaned[key] = value
        .map((entry) => String(entry).slice(0, MAX_STRING_LEN))
        .slice(0, MAX_TOTAL_KEYS);
    } else {
      cleaned[key] = String(value).slice(0, MAX_STRING_LEN);
    }
    count += 1;
  }
  return cleaned;
}

function stableStringify(value) {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  const parts = keys.map((key) => `"${key}":${stableStringify(value[key])}`);
  return `{${parts.join(',')}}`;
}

function buildCacheKey(method, path, query, body) {
  const queryString = stableStringify(query);
  const bodyString = stableStringify(body);
  return `${method}:${path}?${queryString}|${bodyString}`;
}

function extractForwardHeaders(req) {
  const acceptLanguage = req.get('accept-language');
  return acceptLanguage ? { 'accept-language': acceptLanguage } : {};
}

function buildError(status, message, detail) {
  const err = new Error(message);
  err.status = status;
  err.error = message;
  if (detail) {
    err.detail = detail;
  }
  return err;
}

async function getCachedResponse(db, cacheKey) {
  return new Promise((resolve, reject) => {
    tableViatorCache.getCache(db, cacheKey, (err, row) => {
      if (err) return reject(err);
      if (!row) return resolve(null);
      resolve(row);
    });
  });
}

async function setCachedResponse(db, cacheKey, payload, status, headers, ttlSeconds, logger) {
  return new Promise((resolve) => {
    tableViatorCache.setCache(
      db,
      cacheKey,
      payload,
      status,
      headers,
      ttlSeconds,
      (err) => {
        if (err) {
          logger?.warn?.('Failed to write viator cache', { cacheKey, error: err?.message || err });
        }
        resolve();
      }
    );
  });
}

router.use(security.checkToken);
router.use(express.json({ limit: MAX_BODY_BYTES }));

router.all('/*', async (req, res, next) => {
  const endpoint = getEndpointConfig(req.method, req.path);
  if (!endpoint) {
    return next(buildError(403, 'endpoint_not_allowed'));
  }

  const db = req.database?.db;
  if (!db) {
    return next(buildError(500, 'database_unavailable'));
  }

  const { client, error } = buildApiClient();
  if (!client) {
    return next(buildError(503, 'viator_unavailable', error));
  }

  const sanitizedQuery = sanitizeQuery(req.query);
  const sanitizedBody = req.method === 'POST' ? sanitizePayload(req.body || {}) : undefined;

  const cacheKey = buildCacheKey(req.method, req.path, sanitizedQuery, sanitizedBody);

  if (endpoint.cacheTtl) {
    try {
      const cached = await getCachedResponse(db, cacheKey);
      if (cached) {
        const payload = cached.payload ? JSON.parse(cached.payload) : null;
        return res.status(cached.status || 200).json(payload);
      }
    } catch (err) {
      req.logger?.warn?.('Failed to read viator cache', { cacheKey, error: err?.message || err });
    }
  }

  try {
    const upstream = await client.request({
      method: req.method,
      url: req.path,
      params: sanitizedQuery,
      data: sanitizedBody,
      headers: {
        'exp-api-key': process.env.VIATOR_API_KEY,
        Accept: 'application/json;version=2.0',
        ...extractForwardHeaders(req)
      }
    });

    if (endpoint.cacheTtl && upstream.status >= 200 && upstream.status < 300) {
      await setCachedResponse(
        db,
        cacheKey,
        JSON.stringify(upstream.data ?? null),
        upstream.status,
        '{}',
        endpoint.cacheTtl,
        req.logger
      );
    }

    return res.status(upstream.status).json(upstream.data);
  } catch (err) {
    req.logger?.error?.('Viator upstream failed', { error: err?.message || err });
    return next(buildError(502, 'viator_upstream_failed', err?.message || err));
  }
});

module.exports = router;
