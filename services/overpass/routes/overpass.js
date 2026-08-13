const crypto = require('crypto');
const express = require('express');
const axios = require('axios');
const { requireServiceJwt } = require('../utils/serviceJwt');
const { validateNearbyRequest } = require('../validation');
const { buildNearbyQuery } = require('../query-builder');
const { normalizeOverpassResponse } = require('../normalizer');
const { categoryNames, categoryCatalog } = require('../categories');

function createOverpassRouter({
  client, metadataClient, cache, persistentCache,
  refreshAfterMs = 24 * 60 * 60 * 1000,
  cacheTtlMs = 7 * 24 * 60 * 60 * 1000,
  staleIfErrorMs = 30 * 24 * 60 * 60 * 1000,
  inFlight, metrics, maxInFlight, logger = console
}) {
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
    return res.status(200).json({ status: 200, categories: categoryNames(), catalog: categoryCatalog() });
  });

  router.post('/nearby', async (req, res, next) => {
    metrics.nearby = (metrics.nearby || 0) + 1;
    const validated = validateNearbyRequest(req.body);
    if (!validated.ok) return res.status(400).json({ error: validated.message });
    const key = requestKey(validated.value);
    const cached = cache.get(key);
    if (cached !== undefined) return res.status(200).json({ ...cached, cache: 'hit' });

    try {
      const fetchAndCache = async () => {
        const query = buildNearbyQuery(validated.value);
        const upstream = await client.query(query);
        const pois = normalizeOverpassResponse(
          upstream.data,
          validated.value.categories,
          validated.value.subcategories
        );
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
        await persistentCache?.set(key, result);
        return result;
      };

      const persisted = await persistentCache?.get(key);
      if (persisted && persisted.ageMs <= cacheTtlMs) {
        cache.set(key, persisted.payload);
        if (persisted.ageMs <= refreshAfterMs) {
          return res.status(200).json({ ...persisted.payload, cache: 'database' });
        }
        refreshInBackground({ key, fetchAndCache, inFlight, maxInFlight, logger });
        return res.status(200).json({ ...persisted.payload, cache: 'stale' });
      }

      try {
        const payload = await coalesce(inFlight, key, maxInFlight, fetchAndCache);
        return res.status(200).json({ ...payload, cache: 'miss' });
      } catch (error) {
        if (persisted && persisted.ageMs <= staleIfErrorMs) {
          cache.set(key, persisted.payload);
          return res.status(200).json({ ...persisted.payload, cache: 'stale-if-error' });
        }
        throw error;
      }
    } catch (error) {
      logger?.warn?.('Overpass nearby request failed', { key, error: error.message });
      return next(upstreamError(error));
    }
  });

  router.post('/website-metadata', async (req, res, next) => {
    metrics.websiteMetadata = (metrics.websiteMetadata || 0) + 1;
    if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)
        || typeof req.body.url !== 'string' || !req.body.url.trim()) {
      return res.status(400).json({ error: 'invalid_website_metadata_request' });
    }
    let normalizedUrl;
    try {
      normalizedUrl = new URL(req.body.url).toString();
    } catch {
      return res.status(400).json({ error: 'invalid_website_url' });
    }
    const key = metadataRequestKey(normalizedUrl);
    const cached = cache.get(key);
    if (cached !== undefined) return res.status(200).json({ ...cached, cache: 'hit' });

    const fetchAndCache = async () => {
      const metadata = await metadataClient.fetch(normalizedUrl);
      const result = { status: 200, metadata };
      cache.set(key, result);
      await persistentCache?.set(key, result);
      return result;
    };

    try {
      const persisted = await persistentCache?.get(key);
      if (persisted && persisted.ageMs <= cacheTtlMs) {
        cache.set(key, persisted.payload);
        if (persisted.ageMs <= refreshAfterMs) {
          return res.status(200).json({ ...persisted.payload, cache: 'database' });
        }
        refreshInBackground({ key, fetchAndCache, inFlight, maxInFlight, logger });
        return res.status(200).json({ ...persisted.payload, cache: 'stale' });
      }
      try {
        const payload = await coalesce(inFlight, key, maxInFlight, fetchAndCache);
        return res.status(200).json({ ...payload, cache: 'miss' });
      } catch (error) {
        if (persisted && persisted.ageMs <= staleIfErrorMs) {
          cache.set(key, persisted.payload);
          return res.status(200).json({ ...persisted.payload, cache: 'stale-if-error' });
        }
        throw error;
      }
    } catch (error) {
      logger?.warn?.('Website metadata request failed', { url: normalizedUrl, error: error.message });
      return next(error);
    }
  });

  router.get('/metrics', (_req, res) => res.status(200).json({
    status: 200,
    inFlight: inFlight.size,
    cache: cache.snapshot(),
    persistentCache: persistentCache?.snapshot(),
    requests: { ...metrics }
  }));

  return router;
}

function refreshInBackground({ key, fetchAndCache, inFlight, maxInFlight, logger }) {
  void coalesce(inFlight, key, maxInFlight, fetchAndCache)
    .catch((error) => logger?.warn?.('Overpass cache background refresh failed', {
      key,
      error: error.message
    }));
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

function metadataRequestKey(url) {
  return `website-metadata:${crypto.createHash('sha256').update(url).digest('hex')}`;
}

function upstreamError(error) {
  if (!axios.isAxiosError(error)) return error;
  const normalized = new Error('overpass_upstream_error');
  normalized.status = error.code === 'ECONNABORTED' ? 504 : (error.response?.status || 502);
  normalized.detail = error.response?.data || error.message || error.code || 'Overpass upstream request failed';
  const retryAfter = Number(error.response?.headers?.['retry-after']);
  if (Number.isFinite(retryAfter) && retryAfter > 0) normalized.retryAfterSeconds = retryAfter;
  return normalized;
}

module.exports = {
  createOverpassRouter, coalesce, refreshInBackground, requestKey, metadataRequestKey, upstreamError
};
