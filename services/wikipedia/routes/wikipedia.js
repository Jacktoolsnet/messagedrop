const express = require('express');
const tableCache = require('../db/tableWikipediaTileCache');
const { fetchTile, fetchAttribution, getMetrics } = require('../clients/wikimedia-client');
const { MAX_LATITUDE, tilesForBounds } = require('../utils/tiles');
const { requireServiceJwt } = require('../utils/serviceJwt');

const router = express.Router();
router.use(requireServiceJwt);
const cacheMetrics = { hits: 0, misses: 0, stale: 0, attributionHits: 0, attributionMisses: 0 };

const dbGet = (db, key) => new Promise((resolve, reject) => tableCache.get(db, key, (error, row) => error ? reject(error) : resolve(row)));
const dbSet = (db, key, value) => new Promise((resolve, reject) => tableCache.set(db, key, value, (error) => error ? reject(error) : resolve()));

function numberParam(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePayload(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function ageMs(row) {
  const timestamp = new Date(row?.fetchedAt || row?.fetchedat || 0).getTime();
  return Number.isFinite(timestamp) ? Date.now() - timestamp : Number.POSITIVE_INFINITY;
}

async function refreshTile(db, language, tile, key, logger) {
  const articles = await fetchTile(language, key, tile.bounds);
  await dbSet(db, key, articles);
  logger?.info?.('Wikipedia tile refreshed', { key, resultCount: articles.length });
  return articles;
}

async function resolveTile(db, language, tile, logger) {
  // v2 invalidates the former generator-based cache, which could contain only
  // the first 20 GeoSearch entries in dense city tiles.
  const key = `${language}:z${tile.zoom}:x${tile.x}:y${tile.y}:v2`;
  const freshMs = Number(process.env.WIKIPEDIA_CACHE_FRESH_MS || 24 * 60 * 60 * 1000);
  const staleMs = Number(process.env.WIKIPEDIA_CACHE_STALE_MS || 7 * 24 * 60 * 60 * 1000);
  const cached = await dbGet(db, key);
  if (cached && ageMs(cached) <= freshMs) {
    cacheMetrics.hits += 1;
    return { articles: parsePayload(cached.payload), cache: 'hit' };
  }
  if (cached && ageMs(cached) <= staleMs) {
    cacheMetrics.stale += 1;
    refreshTile(db, language, tile, key, logger).catch((error) => logger?.warn?.('Wikipedia background refresh failed', { key, error: error.message }));
    return { articles: parsePayload(cached.payload), cache: 'stale' };
  }
  cacheMetrics.misses += 1;
  return { articles: await refreshTile(db, language, tile, key, logger), cache: 'miss' };
}

router.get('/nearby', async (req, res, next) => {
  const bounds = {
    north: numberParam(req.query.north), south: numberParam(req.query.south),
    east: numberParam(req.query.east), west: numberParam(req.query.west)
  };
  const zoom = numberParam(req.query.zoom);
  const language = String(req.query.language || 'de').toLowerCase();
  const requestedLimit = Number(req.query.limit || 100);
  const minZoom = Number(process.env.WIKIPEDIA_MIN_ZOOM || 14);
  if (!/^[a-z]{2,3}$/.test(language) || Object.values(bounds).some((value) => value === null)
      || bounds.north <= bounds.south || bounds.north > MAX_LATITUDE || bounds.south < -MAX_LATITUDE
      || bounds.east > 180 || bounds.west < -180 || zoom === null || zoom < minZoom || zoom > 24) {
    return res.status(400).json({ errorCode: 'BAD_REQUEST', message: 'invalid_wikipedia_viewport', error: 'invalid_wikipedia_viewport' });
  }
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 500) {
    return res.status(400).json({ errorCode: 'BAD_REQUEST', message: 'invalid_limit', error: 'invalid_limit' });
  }
  try {
    const dataZoom = Number(process.env.WIKIPEDIA_CACHE_TILE_ZOOM || 14);
    const maxTiles = Number(process.env.WIKIPEDIA_MAX_TILES_PER_REQUEST || 64);
    const tiles = tilesForBounds(bounds, dataZoom, maxTiles);
    const resolved = await Promise.all(tiles.map((tile) => resolveTile(req.database.db, language, tile, req.logger)));
    const unique = new Map();
    for (const result of resolved) {
      for (const article of result.articles || []) {
        if (article.latitude <= bounds.north && article.latitude >= bounds.south
            && article.longitude >= bounds.west && article.longitude <= bounds.east) {
          unique.set(`${language}:${article.pageId}`, article);
        }
      }
    }
    const limit = requestedLimit;
    const articles = Array.from(unique.values()).slice(0, limit);
    return res.status(200).json({
      status: 200, language, articles,
      cache: { stale: resolved.some((entry) => entry.cache === 'stale'), tiles: resolved.map((entry) => entry.cache) },
      attribution: {
        provider: 'Wikipedia', url: `https://${language}.wikipedia.org/`,
        textLicense: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/'
      }
    });
  } catch (error) {
    if (error.message === 'viewport_too_large' || error.message === 'antimeridian_not_supported') {
      return res.status(400).json({ errorCode: 'BAD_REQUEST', message: error.message, error: error.message });
    }
    return next(error);
  }
});

router.get('/attribution', async (req, res, next) => {
  const language = String(req.query.language || '').toLowerCase();
  const title = String(req.query.title || '').trim();
  const imageTitle = String(req.query.imageTitle || '').trim() || null;
  const needsSummary = String(req.query.needsSummary || '').toLowerCase() === 'true';
  const pageId = Number(req.query.pageId);
  if (!/^[a-z]{2,3}$/.test(language) || !title || title.length > 500 || (imageTitle && imageTitle.length > 500)
      || !Number.isInteger(pageId) || pageId <= 0) {
    return res.status(400).json({ errorCode: 'BAD_REQUEST', message: 'invalid_attribution_request', error: 'invalid_attribution_request' });
  }
  try {
    // v4 uses attribution scoped to the exact displayed pageimage.
    const key = `attribution:${language}:${pageId}:${imageTitle || 'no-image'}:${needsSummary ? 'summary' : 'no-summary'}:v4`;
    const cached = await dbGet(req.database.db, key);
    const cachedPayload = cached ? parsePayload(cached.payload) : null;
    const ttl = cachedPayload?.image?.resolved !== false
      ? Number(process.env.WIKIPEDIA_ATTRIBUTION_CACHE_MS || 7 * 24 * 60 * 60 * 1000)
      : Number(process.env.WIKIPEDIA_ATTRIBUTION_NEGATIVE_CACHE_MS || 6 * 60 * 60 * 1000);
    if (cached && ageMs(cached) <= ttl) {
      cacheMetrics.attributionHits += 1;
      return res.status(200).json({ status: 200, ...cachedPayload, cache: 'hit' });
    }
    cacheMetrics.attributionMisses += 1;
    const attribution = await fetchAttribution(language, title, imageTitle, needsSummary);
    await dbSet(req.database.db, key, attribution);
    return res.status(200).json({ status: 200, ...attribution, cache: 'miss' });
  } catch (error) {
    return next(error);
  }
});

router.get('/metrics', (_req, res) => res.status(200).json({
  status: 200,
  cache: { ...cacheMetrics },
  upstream: getMetrics()
}));

module.exports = router;
