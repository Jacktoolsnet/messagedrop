const crypto = require('crypto');
const express = require('express');
const axios = require('axios');
const { requireServiceJwt } = require('../utils/serviceJwt');
const { validateRouteRequest, normalizeLocale } = require('../validation');

function createTripGoRouter({ client, regionsCache, routeCache, inFlight, metrics, maxInFlight }) {
  const router = express.Router();
  router.use(requireServiceJwt);

  router.get('/health', async (_req, res, next) => {
    metrics.health = (metrics.health || 0) + 1;
    try {
      const upstream = await client.health();
      return res.status(upstream.status).json(upstream.data);
    } catch (error) {
      return next(upstreamError(error));
    }
  });

  router.get('/regions', async (req, res, next) => {
    metrics.regions = (metrics.regions || 0) + 1;
    const locale = normalizeLocale(req.query.locale || preferredLocale(req.get('accept-language')) || 'de');
    if (!locale) return res.status(400).json({ error: 'invalid_regions_locale' });
    const key = `regions:${locale}`;
    const cached = regionsCache.get(key);
    if (cached !== undefined) return res.status(200).json({ ...cached, cache: 'hit' });
    try {
      const upstream = await coalesce(inFlight, key, maxInFlight, () => client.regions(locale));
      const payload = { status: upstream.status, data: upstream.data };
      regionsCache.set(key, payload);
      return res.status(upstream.status).json({ ...payload, cache: 'miss' });
    } catch (error) {
      return next(upstreamError(error));
    }
  });

  router.post('/routes', async (req, res, next) => {
    metrics.routes = (metrics.routes || 0) + 1;
    const validated = validateRouteRequest(req.body);
    if (!validated.ok) return res.status(400).json({ error: validated.message });
    const key = routeKey(validated.value);
    const cached = routeCache.get(key);
    if (cached !== undefined) return res.status(200).json({ ...cached, cache: 'hit' });
    try {
      const upstream = await coalesce(inFlight, `route:${key}`, maxInFlight, () => client.routes(validated.value));
      const payload = { status: upstream.status, data: upstream.data };
      routeCache.set(key, payload);
      return res.status(upstream.status).json({ ...payload, cache: 'miss' });
    } catch (error) {
      return next(upstreamError(error));
    }
  });

  router.get('/metrics', (_req, res) => res.status(200).json({
    status: 200,
    inFlight: inFlight.size,
    regionsCache: regionsCache.snapshot(),
    routeCache: routeCache.snapshot(),
    requests: { ...metrics }
  }));

  return router;
}

async function coalesce(inFlight, key, maxInFlight, factory) {
  const existing = inFlight.get(key);
  if (existing) return existing;
  if (inFlight.size >= maxInFlight) {
    const error = new Error('tripgo_service_busy');
    error.status = 503;
    error.retryAfterSeconds = 1;
    throw error;
  }
  const promise = factory();
  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

function routeKey(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function upstreamError(error) {
  if (!axios.isAxiosError(error)) return error;
  const normalized = new Error('tripgo_upstream_error');
  normalized.status = error.code === 'ECONNABORTED' ? 504 : (error.response?.status || 502);
  // Never attach request headers here: they contain the TripGo API key.
  normalized.detail = error.response?.data || error.message;
  const retryAfter = Number(error.response?.headers?.['retry-after']);
  if (Number.isFinite(retryAfter) && retryAfter > 0) normalized.retryAfterSeconds = retryAfter;
  return normalized;
}

function preferredLocale(header) {
  return typeof header === 'string' ? header.split(',')[0]?.split(';')[0]?.trim() : null;
}

module.exports = { createTripGoRouter, coalesce, routeKey };
