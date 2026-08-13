const crypto = require('crypto');
const express = require('express');
const axios = require('axios');
const { requireServiceJwt } = require('../utils/serviceJwt');
const { validateNearbyRequest } = require('../validation');
const { buildNearbyQuery } = require('../query-builder');
const { normalizeOverpassResponse } = require('../normalizer');
const { categoryNames } = require('../categories');

function createOverpassRouter({ client, cache, inFlight, metrics, maxInFlight, logger = console }) {
  const router = express.Router();
  router.use(requireServiceJwt);

  router.get('/health', async (_req, res, next) => {
    metrics.health = (metrics.health || 0) + 1;
    try {
      const upstream = await client.health();
      return res.status(200).json({ status: 200, upstreamStatus: upstream.status });
    } catch (error) {
      return next(upstreamError(error));
    }
  });

  router.get('/categories', (_req, res) => {
    metrics.categories = (metrics.categories || 0) + 1;
    return res.status(200).json({ status: 200, categories: categoryNames() });
  });

  router.post('/nearby', async (req, res, next) => {
    metrics.nearby = (metrics.nearby || 0) + 1;
    const validated = validateNearbyRequest(req.body);
    if (!validated.ok) return res.status(400).json({ error: validated.message });
    const key = requestKey(validated.value);
    const cached = cache.get(key);
    if (cached !== undefined) return res.status(200).json({ ...cached, cache: 'hit' });

    try {
      const payload = await coalesce(inFlight, key, maxInFlight, async () => {
        const query = buildNearbyQuery(validated.value);
        const upstream = await client.query(query);
        const pois = normalizeOverpassResponse(upstream.data, validated.value.categories);
        const result = {
          status: 200,
          pois,
          count: pois.length,
          attribution: {
            provider: 'OpenStreetMap',
            text: '© OpenStreetMap contributors',
            url: 'https://www.openstreetmap.org/copyright',
            license: 'ODbL 1.0'
          },
          source: {
            timestamp: upstream.data?.osm3s?.timestamp_osm_base || null,
            copyright: upstream.data?.osm3s?.copyright || null
          }
        };
        cache.set(key, result);
        return result;
      });
      return res.status(200).json({ ...payload, cache: 'miss' });
    } catch (error) {
      logger?.warn?.('Overpass nearby request failed', { key, error: error.message });
      return next(upstreamError(error));
    }
  });

  router.get('/metrics', (_req, res) => res.status(200).json({
    status: 200,
    inFlight: inFlight.size,
    cache: cache.snapshot(),
    requests: { ...metrics }
  }));

  return router;
}

async function coalesce(inFlight, key, maxInFlight, factory) {
  const existing = inFlight.get(key);
  if (existing) return existing;
  if (inFlight.size >= maxInFlight) {
    const error = new Error('overpass_service_busy');
    error.status = 503;
    error.retryAfterSeconds = 2;
    throw error;
  }
  const promise = Promise.resolve().then(factory);
  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

function requestKey(value) {
  return `nearby:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function upstreamError(error) {
  if (!axios.isAxiosError(error)) return error;
  const normalized = new Error('overpass_upstream_error');
  normalized.status = error.code === 'ECONNABORTED' ? 504 : (error.response?.status || 502);
  normalized.detail = error.response?.data || error.message;
  const retryAfter = Number(error.response?.headers?.['retry-after']);
  if (Number.isFinite(retryAfter) && retryAfter > 0) normalized.retryAfterSeconds = retryAfter;
  return normalized;
}

module.exports = { createOverpassRouter, coalesce, requestKey, upstreamError };
