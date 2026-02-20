const express = require('express');
const axios = require('axios');
const security = require('../middleware/security');
const tableViatorCache = require('../db/tableViatorCache');
const tableViatorDestinations = require('../db/tableViatorDestinations');

const router = express.Router();

const MAX_BODY_BYTES = 256 * 1024;
const MAX_QUERY_PARAMS = 40;
const MAX_STRING_LEN = 500;
const MAX_TOTAL_KEYS = 200;
const MAX_DEPTH = 4;
const MAX_DESTINATION_IDS = 200;

const DEFAULT_TIMEOUT_MS = 30000;

function resolveTimeoutMs(rawValue, fallback) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.round(parsed);
}

const CACHE_TTLS = {
  tags: 60 * 60 * 24, // 24h
  attractionsSearch: 60 * 60, // 1h
  attractionsDetail: 60 * 60 * 6, // 6h
  productsSearch: 60 * 15, // 15m
  productDetail: 60 * 60 * 24, // 1d
  availabilitySchedules: 60 * 30, // 30m
  locationsBulk: 60 * 60 * 24 * 30, // 30d
  suppliers: 60 * 60 * 24 * 7 // 7d
};

const ALLOWED_ENDPOINTS = [
  { method: 'GET', pattern: /^\/products\/tags$/, cacheTtl: CACHE_TTLS.tags },
  { method: 'GET', pattern: /^\/products\/search$/, cacheTtl: CACHE_TTLS.productsSearch },
  { method: 'POST', pattern: /^\/products\/search$/, cacheTtl: CACHE_TTLS.productsSearch },
  { method: 'POST', pattern: /^\/search\/freetext$/, cacheTtl: CACHE_TTLS.productsSearch },
  { method: 'GET', pattern: /^\/products\/[^/]+$/, cacheTtl: CACHE_TTLS.productDetail },
  { method: 'GET', pattern: /^\/attractions\/search$/, cacheTtl: CACHE_TTLS.attractionsSearch },
  { method: 'POST', pattern: /^\/attractions\/search$/, cacheTtl: CACHE_TTLS.attractionsSearch },
  { method: 'GET', pattern: /^\/attractions\/[^/]+$/, cacheTtl: CACHE_TTLS.attractionsDetail },
  { method: 'GET', pattern: /^\/availability\/schedules\/[^/]+$/, cacheTtl: CACHE_TTLS.availabilitySchedules },
  { method: 'POST', pattern: /^\/locations\/bulk$/, cacheTtl: CACHE_TTLS.locationsBulk },
  { method: 'POST', pattern: /^\/suppliers\/search\/product-codes$/, cacheTtl: CACHE_TTLS.suppliers }
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
    timeout: resolveTimeoutMs(process.env.VIATOR_API_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
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

function normalizeSearchTerm(term) {
  if (term === null || term === undefined) return '';
  return String(term)
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cloneValue(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map((entry) => cloneValue(entry));
  }
  if (typeof value === 'object') {
    const copy = {};
    for (const [key, entry] of Object.entries(value)) {
      copy[key] = cloneValue(entry);
    }
    return copy;
  }
  return value;
}

function normalizeCacheInputs(query, body) {
  const normalizedQuery = cloneValue(query);
  if (normalizedQuery && typeof normalizedQuery === 'object' && normalizedQuery.searchTerm) {
    normalizedQuery.searchTerm = normalizeSearchTerm(normalizedQuery.searchTerm);
  }
  const normalizedBody = cloneValue(body);
  if (normalizedBody && typeof normalizedBody === 'object' && normalizedBody.searchTerm) {
    normalizedBody.searchTerm = normalizeSearchTerm(normalizedBody.searchTerm);
  }
  return { normalizedQuery, normalizedBody };
}

function buildCacheKey(method, path, query, body) {
  const { normalizedQuery, normalizedBody } = normalizeCacheInputs(query, body);
  const queryString = stableStringify(normalizedQuery);
  const bodyString = stableStringify(normalizedBody);
  return `${method}:${path}?${queryString}|${bodyString}`;
}

function extractForwardHeaders(req) {
  const acceptLanguage = normalizeAcceptLanguage(req.get('accept-language') || process.env.VIATOR_ACCEPT_LANGUAGE);
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

function extractRateLimitHeaders(headers) {
  if (!headers || typeof headers !== 'object') {
    return undefined;
  }
  const keys = [
    'x-ratelimit-limit',
    'x-ratelimit-remaining',
    'x-ratelimit-reset',
    'retry-after',
    'ratelimit-limit',
    'ratelimit-remaining',
    'ratelimit-reset'
  ];
  const result = {};
  for (const key of keys) {
    if (headers[key] !== undefined) {
      result[key] = headers[key];
    }
  }
  return Object.keys(result).length ? result : undefined;
}

function logTiming(logger, payload) {
  if (!logger?.info) return;
  logger.info('viator_upstream_timing', payload);
}

function normalizeAcceptLanguage(rawValue) {
  if (!rawValue) return null;
  const first = String(rawValue).split(',')[0]?.split(';')[0]?.trim().replace('_', '-');
  if (!first) return null;
  return /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(first) ? first : null;
}

function parseDestinationIds(value) {
  if (value === undefined || value === null) {
    return [];
  }
  const raw = Array.isArray(value) ? value.join(',') : String(value);
  const parts = raw.split(',').map((entry) => entry.trim()).filter(Boolean);
  const seen = new Set();
  const ids = [];
  for (const part of parts) {
    if (ids.length >= MAX_DESTINATION_IDS) break;
    const num = Number(part);
    if (!Number.isFinite(num)) continue;
    const intVal = Math.trunc(num);
    if (intVal <= 0 || seen.has(intVal)) continue;
    seen.add(intVal);
    ids.push(intVal);
  }
  return ids;
}

function safeJsonParse(value) {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
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

function normalizeDestinationTypes(input) {
  if (!input) return [];
  const raw = Array.isArray(input) ? input : String(input).split(',');
  return raw
    .map((entry) => String(entry).trim())
    .filter(Boolean);
}

async function getDestinationsByIds(db, destinationIds) {
  return new Promise((resolve, reject) => {
    tableViatorDestinations.getByIds(db, destinationIds, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

async function getAllDestinations(db, types) {
  return new Promise((resolve, reject) => {
    tableViatorDestinations.getAll(db, types, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(Array.isArray(rows) ? rows : []);
    });
  });
}

const PUBLIC_ENDPOINTS = [
  { method: 'GET', pattern: /^\/destinations$/ },
  { method: 'GET', pattern: /^\/destinations\/all$/ },
  { method: 'POST', pattern: /^\/products\/search$/ },
  { method: 'GET', pattern: /^\/products\/search$/ },
  { method: 'GET', pattern: /^\/products\/[^/]+$/ },
  { method: 'POST', pattern: /^\/search\/freetext$/ },
  { method: 'POST', pattern: /^\/locations\/bulk$/ },
  { method: 'GET', pattern: /^\/availability\/schedules\/[^/]+$/ },
  { method: 'POST', pattern: /^\/suppliers\/search\/product-codes$/ }
];

router.use((req, res, next) => {
  const isPublic = PUBLIC_ENDPOINTS.some((entry) => entry.method === req.method && entry.pattern.test(req.path));
  if (isPublic) {
    return next();
  }
  return security.checkToken(req, res, next);
});
router.use(express.json({ limit: MAX_BODY_BYTES }));

router.get('/destinations', async (req, res, next) => {
  const db = req.database?.db;
  if (!db) {
    return next(buildError(500, 'database_unavailable'));
  }
  const ids = parseDestinationIds(req.query?.ids);
  if (!ids.length) {
    return next(buildError(400, 'destination_ids_required'));
  }
  let rows = [];
  try {
    rows = await getDestinationsByIds(db, ids);
  } catch (err) {
    return next(buildError(500, 'db_error', err?.message || err));
  }
  const destinations = rows.map((row) => {
    const hasCenter = Number.isFinite(row.centerLat) && Number.isFinite(row.centerLng);
    return {
      destinationId: row.destinationId,
      name: row.name || undefined,
      type: row.type || undefined,
      parentDestinationId: row.parentDestinationId ?? undefined,
      lookupId: row.lookupId || undefined,
      destinationUrl: row.destinationUrl || undefined,
      defaultCurrencyCode: row.defaultCurrencyCode || undefined,
      timeZone: row.timeZone || undefined,
      iataCodes: safeJsonParse(row.iataCodes),
      countryCallingCode: row.countryCallingCode || undefined,
      languages: safeJsonParse(row.languages),
      plusCode: row.plusCode || undefined,
      center: hasCenter ? { latitude: row.centerLat, longitude: row.centerLng } : undefined
    };
  });
  return res.status(200).json({ destinations, totalCount: destinations.length });
});

router.get('/destinations/all', async (req, res, next) => {
  const db = req.database?.db;
  if (!db) {
    return next(buildError(500, 'database_unavailable'));
  }
  const types = normalizeDestinationTypes(req.query?.types);
  let rows = [];
  try {
    rows = await getAllDestinations(db, types);
  } catch (err) {
    return next(buildError(500, 'db_error', err?.message || err));
  }
  const destinations = rows.map((row) => {
    const hasCenter = Number.isFinite(row.centerLat) && Number.isFinite(row.centerLng);
    return {
      destinationId: row.destinationId,
      name: row.name || undefined,
      type: row.type || undefined,
      parentDestinationId: row.parentDestinationId ?? undefined,
      lookupId: row.lookupId || undefined,
      destinationUrl: row.destinationUrl || undefined,
      defaultCurrencyCode: row.defaultCurrencyCode || undefined,
      timeZone: row.timeZone || undefined,
      iataCodes: safeJsonParse(row.iataCodes),
      countryCallingCode: row.countryCallingCode || undefined,
      languages: safeJsonParse(row.languages),
      plusCode: row.plusCode || undefined,
      center: hasCenter ? { latitude: row.centerLat, longitude: row.centerLng } : undefined
    };
  });
  return res.status(200).json({ destinations, totalCount: destinations.length });
});

router.use(async (req, res, next) => {
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

  const startedAt = Date.now();
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
    const durationMs = Date.now() - startedAt;
    if (process.env.VIATOR_LOG_UPSTREAM_STATUS === 'true') {
      req.logger?.info?.('Viator upstream response', {
        method: req.method,
        path: req.path,
        status: upstream.status
      });
    }
    if (upstream.status >= 400) {
      req.logger?.warn?.('Viator upstream error response', {
        method: req.method,
        path: req.path,
        status: upstream.status,
        data: upstream.data
      });
    }
    logTiming(req.logger, {
      method: req.method,
      path: req.path,
      status: upstream.status,
      durationMs,
      rateLimit: extractRateLimitHeaders(upstream.headers)
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
    const durationMs = Date.now() - startedAt;
    const isTimeout = err?.code === 'ECONNABORTED' || String(err?.message || '').toLowerCase().includes('timeout');
    req.logger?.error?.('Viator upstream failed', {
      error: err?.message || err,
      timeout: isTimeout,
      durationMs
    });
    return next(buildError(502, 'viator_upstream_failed', err?.message || err));
  }
});

module.exports = router;
