const crypto = require('crypto');
const express = require('express');
const axios = require('axios');
const { requireServiceJwt } = require('../utils/serviceJwt');
const {
  validateRouteRequest, validateServiceRequest, validateLatestRequest, validateRegionRequest,
  validateLocationsRequest, validateDeparturesRequest, normalizeLocale
} = require('../validation');
const { normalizeRoutingResponse, normalizeServiceResponse, normalizeLatestResponse } = require('../normalizer');
const { cellIDsForBounds, normalizeLocationsResponse, resolveRegion } = require('../locations');
const { normalizeDeparturesResponse } = require('../departures');

function createTripGoRouter({
  client, regionsCache, routeCache, serviceCache, locationsCache, inFlight, metrics, maxInFlight
}) {
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

  router.get('/region-info', async (req, res, next) => {
    metrics.regionInfo = (metrics.regionInfo || 0) + 1;
    const validated = validateRegionRequest({
      region: req.query.region,
      locale: req.query.locale || preferredLocale(req.get('accept-language')) || 'en'
    });
    if (!validated.ok) return res.status(400).json({ error: validated.message });
    const key = `region-info:${validated.value.locale}:${validated.value.region}`;
    const cached = regionsCache.get(key);
    if (cached !== undefined) return res.status(200).json({ ...cached, cache: 'hit' });
    try {
      const upstream = await coalesce(inFlight, key, maxInFlight, () => client.regionInfo(validated.value));
      const payload = { status: upstream.status, data: upstream.data };
      regionsCache.set(key, payload);
      return res.status(upstream.status).json({ ...payload, cache: 'miss' });
    } catch (error) {
      return next(upstreamError(error));
    }
  });

  router.get('/operators', async (req, res, next) => {
    metrics.operators = (metrics.operators || 0) + 1;
    const validated = validateRegionRequest({
      region: req.query.region,
      locale: req.query.locale || preferredLocale(req.get('accept-language')) || 'en',
      onlyRealTime: req.query.onlyRealTime,
      full: req.query.full
    });
    if (!validated.ok) return res.status(400).json({ error: validated.message });
    const key = `operators:${routeKey(validated.value)}`;
    const cached = regionsCache.get(key);
    if (cached !== undefined) return res.status(200).json({ ...cached, cache: 'hit' });
    try {
      const upstream = await coalesce(inFlight, key, maxInFlight, () => client.operators(validated.value));
      const payload = { status: upstream.status, data: upstream.data };
      regionsCache.set(key, payload);
      return res.status(upstream.status).json({ ...payload, cache: 'miss' });
    } catch (error) {
      return next(upstreamError(error));
    }
  });

  router.post('/locations', async (req, res, next) => {
    metrics.locations = (metrics.locations || 0) + 1;
    const validated = validateLocationsRequest(req.body);
    if (!validated.ok) return res.status(400).json({ error: validated.message });
    try {
      const regionsKey = `regions:${validated.value.locale}`;
      let regions = regionsCache.get(regionsKey);
      if (regions === undefined) {
        const upstreamRegions = await coalesce(inFlight, regionsKey, maxInFlight,
          () => client.regions(validated.value.locale));
        regions = { status: upstreamRegions.status, data: upstreamRegions.data };
        regionsCache.set(regionsKey, regions);
      }
      const region = resolveRegion(regions.data, validated.value.bounds);
      if (!region) {
        return res.status(200).json({
          status: 200,
          data: { region: null, stops: [] },
          cache: 'miss'
        });
      }
      const cellIDs = cellIDsForBounds(validated.value.bounds);
      const maxCells = Number(process.env.TRIPGO_LOCATIONS_MAX_CELLS || 64);
      if (cellIDs.length > maxCells) {
        return res.status(400).json({ error: 'locations_viewport_too_large' });
      }
      const key = routeKey({
        region,
        locale: validated.value.locale,
        cellIDs,
        bounds: validated.value.bounds
      });
      const cached = locationsCache?.get(key);
      if (cached !== undefined) return res.status(200).json({ ...cached, cache: 'hit' });
      const upstream = await coalesce(inFlight, `locations:${key}`, maxInFlight,
        () => client.locations({
          region,
          levels: [1, 2],
          cellIDs,
          locale: validated.value.locale,
          includeChildren: true,
          includeRoutes: true
        }));
      const payload = {
        status: upstream.status,
        data: normalizeLocationsResponse(upstream.data, region, validated.value.bounds)
      };
      locationsCache?.set(key, payload);
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
      const payload = {
        status: upstream.status,
        data: normalizeRoutingResponse(upstream.data, {
          maxRoutes: Number(process.env.TRIPGO_MAX_ROUTE_OPTIONS || 12),
          routesPerGroup: Number(process.env.TRIPGO_ROUTE_OPTIONS_PER_GROUP || 2)
        })
      };
      routeCache.set(key, payload);
      return res.status(upstream.status).json({ ...payload, cache: 'miss' });
    } catch (error) {
      return next(upstreamError(error));
    }
  });

  router.post('/departures', async (req, res, next) => {
    metrics.departures = (metrics.departures || 0) + 1;
    const validated = validateDeparturesRequest(req.body);
    if (!validated.ok) return res.status(400).json({ error: validated.message });
    const key = routeKey(validated.value);
    const cached = serviceCache?.get(`departures:${key}`);
    if (cached !== undefined) return res.status(200).json({ ...cached, cache: 'hit' });
    try {
      const upstream = await coalesce(inFlight, `departures:${key}`, maxInFlight,
        () => fetchDeparturesForStops(client, validated.value));
      const payload = {
        status: upstream.status,
        data: normalizeDeparturesResponse(upstream.data, validated.value.region)
      };
      serviceCache?.set(`departures:${key}`, payload);
      return res.status(upstream.status).json({ ...payload, cache: 'miss' });
    } catch (error) {
      return next(upstreamError(error));
    }
  });

  router.post('/service', async (req, res, next) => {
    metrics.services = (metrics.services || 0) + 1;
    const validated = validateServiceRequest(req.body);
    if (!validated.ok) return res.status(400).json({ error: validated.message });
    const key = routeKey(validated.value);
    const cached = serviceCache?.get(key);
    if (cached !== undefined) return res.status(200).json({ ...cached, cache: 'hit' });
    try {
      const upstream = await coalesce(inFlight, `service:${key}`, maxInFlight, () => client.service(validated.value));
      const payload = {
        status: upstream.status,
        data: normalizeServiceResponse(upstream.data, validated.value)
      };
      serviceCache?.set(key, payload);
      return res.status(upstream.status).json({ ...payload, cache: 'miss' });
    } catch (error) {
      return next(upstreamError(error));
    }
  });

  router.post('/latest', async (req, res, next) => {
    metrics.latest = (metrics.latest || 0) + 1;
    const validated = validateLatestRequest(req.body);
    if (!validated.ok) return res.status(400).json({ error: validated.message });
    const key = routeKey(validated.value);
    const cached = serviceCache?.get(`latest:${key}`);
    if (cached !== undefined) return res.status(200).json({ ...cached, cache: 'hit' });
    try {
      const upstream = await coalesce(inFlight, `latest:${key}`, maxInFlight, () => client.latest(validated.value));
      const payload = {
        status: upstream.status,
        data: normalizeLatestResponse(upstream.data, validated.value)
      };
      serviceCache?.set(`latest:${key}`, payload);
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
    serviceCache: serviceCache?.snapshot(),
    locationsCache: locationsCache?.snapshot(),
    requests: { ...metrics }
  }));

  return router;
}

async function fetchDeparturesForStops(client, query) {
  if (query.stopCodes.length === 1) return client.departures(query);
  const results = await Promise.allSettled(query.stopCodes.map((stopCode) => client.departures({
    ...query,
    stopCodes: [stopCode]
  })));
  const successful = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
  if (successful.length === 0) throw results[0].reason;
  return {
    status: successful[0].status,
    headers: successful[0].headers,
    data: {
      embarkationStops: successful.flatMap((result) => result.data?.embarkationStops || []),
      parentInfo: successful.flatMap((result) => result.data?.parentInfo || []),
      alerts: successful.flatMap((result) => result.data?.alerts || [])
    }
  };
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

module.exports = { createTripGoRouter, coalesce, fetchDeparturesForStops, routeKey };
