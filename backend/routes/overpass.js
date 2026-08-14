const express = require('express');
const axios = require('axios');
const { signServiceJwt } = require('../utils/serviceJwt');
const { resolveBaseUrl } = require('../utils/adminLogForwarder');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');

const router = express.Router();

function normalizeBaseUrl(base) {
  if (!base) return null;
  const value = String(base).trim().replace(/\/+$/, '');
  const withScheme = /^https?:\/\//i.test(value) ? value : `http://${value}`;
  try {
    const url = new URL(withScheme);
    return url.hostname ? withScheme : null;
  } catch {
    return null;
  }
}

const base = normalizeBaseUrl(resolveBaseUrl(process.env.OVERPASS_BASE_URL, process.env.OVERPASS_PORT));
const adminBase = normalizeBaseUrl(resolveBaseUrl(process.env.ADMIN_BASE_URL, process.env.ADMIN_PORT));
const client = base ? axios.create({
  baseURL: `${base}/overpass`,
  timeout: Number(process.env.OVERPASS_PROXY_TIMEOUT_MS || 25000),
  validateStatus: () => true,
  headers: { Accept: 'application/json' }
}) : null;
let availabilityCache = null;

async function forward(req, res, next, { method, path, data }) {
  if (!client) {
    const error = apiError.serviceUnavailable();
    error.detail = 'OVERPASS_BASE_URL is missing or invalid';
    return next(error);
  }
  try {
    const token = await signServiceJwt({
      audience: process.env.SERVICE_JWT_AUDIENCE_OVERPASS || 'service.overpass'
    });
    const upstream = await client.request({
      method,
      url: path,
      data,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-request-id': req.traceId
      }
    });
    if (upstream.headers['retry-after']) res.set('Retry-After', upstream.headers['retry-after']);
    return res.status(upstream.status).json(upstream.data);
  } catch (error) {
    if (!axios.isAxiosError(error)) return next(error);
    const apiErr = apiError.fromStatus(error.code === 'ECONNABORTED' ? 504 : 502);
    apiErr.detail = error.message;
    return next(apiErr);
  }
}

router.get('/health', [metric.count('overpass.health', { when: 'always', timezone: 'utc', amount: 1 })],
  (req, res, next) => forward(req, res, next, { method: 'get', path: '/health' }));

router.get('/categories', [metric.count('overpass.categories', { when: 'always', timezone: 'utc', amount: 1 })],
  (req, res, next) => forward(req, res, next, { method: 'get', path: '/categories' }));

router.get('/availability', [metric.count('overpass.availability', { when: 'always', timezone: 'utc', amount: 1 })],
  async (req, res, next) => {
    if (!adminBase) {
      const error = apiError.serviceUnavailable();
      error.detail = 'ADMIN_BASE_URL is missing or invalid';
      return next(error);
    }
    if (availabilityCache?.expiresAt > Date.now()) {
      return res.status(200).json(availabilityCache.payload);
    }
    try {
      const token = await signServiceJwt({
        audience: process.env.SERVICE_JWT_AUDIENCE_ADMIN || 'service.admin-backend'
      });
      const upstream = await axios.get(`${adminBase}/overpass-import/active-categories`, {
        timeout: Number(process.env.ADMIN_PROXY_TIMEOUT_MS || 5000),
        validateStatus: () => true,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'x-request-id': req.traceId }
      });
      if (upstream.status >= 200 && upstream.status < 300) {
        const cacheMs = Math.max(0, Number(process.env.OVERPASS_AVAILABILITY_CACHE_MS || 0));
        availabilityCache = cacheMs > 0
          ? { payload: upstream.data, expiresAt: Date.now() + cacheMs }
          : null;
      }
      return res.status(upstream.status).json(upstream.data);
    } catch (error) {
      if (!axios.isAxiosError(error)) return next(error);
      const apiErr = apiError.fromStatus(error.code === 'ECONNABORTED' ? 504 : 502);
      apiErr.detail = error.message;
      return next(apiErr);
    }
  });

router.post('/nearby', [
  express.json({ type: 'application/json', limit: '16kb' }),
  metric.count('overpass.nearby', { when: 'always', timezone: 'utc', amount: 1 })
], (req, res, next) => forward(req, res, next, { method: 'post', path: '/nearby', data: req.body }));

router.post('/website-metadata', [
  express.json({ type: 'application/json', limit: '4kb' }),
  metric.count('overpass.websiteMetadata', { when: 'always', timezone: 'utc', amount: 1 })
], (req, res, next) => forward(req, res, next, {
  method: 'post', path: '/website-metadata', data: req.body
}));

module.exports = router;
