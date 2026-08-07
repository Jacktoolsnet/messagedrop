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

const base = normalizeBaseUrl(resolveBaseUrl(process.env.TRIPGO_BASE_URL, process.env.TRIPGO_PORT));
const client = base ? axios.create({
  baseURL: `${base}/tripgo`,
  timeout: Number(process.env.TRIPGO_PROXY_TIMEOUT_MS || 20000),
  validateStatus: () => true,
  headers: { Accept: 'application/json' }
}) : null;

async function forward(req, res, next, { method, path, data, params }) {
  if (!client) {
    const error = apiError.serviceUnavailable();
    error.detail = 'TRIPGO_BASE_URL is missing or invalid';
    return next(error);
  }
  try {
    const token = await signServiceJwt({
      audience: process.env.SERVICE_JWT_AUDIENCE_TRIPGO || 'service.tripgo'
    });
    const upstream = await client.request({
      method,
      url: path,
      data,
      params,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-request-id': req.traceId,
        'accept-language': req.get('accept-language') || undefined
      }
    });
    if (upstream.headers['retry-after']) {
      res.set('Retry-After', upstream.headers['retry-after']);
    }
    return res.status(upstream.status).json(upstream.data);
  } catch (error) {
    if (!axios.isAxiosError(error)) return next(error);
    const apiErr = apiError.fromStatus(error.code === 'ECONNABORTED' ? 504 : 502);
    apiErr.detail = error.message;
    return next(apiErr);
  }
}

router.get('/health', [metric.count('tripgo.health', { when: 'always', timezone: 'utc', amount: 1 })],
  (req, res, next) => forward(req, res, next, { method: 'get', path: '/health' }));

router.get('/regions', [metric.count('tripgo.regions', { when: 'always', timezone: 'utc', amount: 1 })],
  (req, res, next) => forward(req, res, next, { method: 'get', path: '/regions', params: req.query }));

router.get('/region-info', [metric.count('tripgo.regionInfo', { when: 'always', timezone: 'utc', amount: 1 })],
  (req, res, next) => forward(req, res, next, { method: 'get', path: '/region-info', params: req.query }));

router.get('/operators', [metric.count('tripgo.operators', { when: 'always', timezone: 'utc', amount: 1 })],
  (req, res, next) => forward(req, res, next, { method: 'get', path: '/operators', params: req.query }));

router.post('/locations', [
  express.json({ type: 'application/json', limit: '16kb' }),
  metric.count('tripgo.locations', { when: 'always', timezone: 'utc', amount: 1 })
], (req, res, next) => forward(req, res, next, { method: 'post', path: '/locations', data: req.body }));

router.post('/routes', [
  express.json({ type: 'application/json', limit: '16kb' }),
  metric.count('tripgo.routes', { when: 'always', timezone: 'utc', amount: 1 })
], (req, res, next) => forward(req, res, next, { method: 'post', path: '/routes', data: req.body }));

router.post('/departures', [
  express.json({ type: 'application/json', limit: '16kb' }),
  metric.count('tripgo.departures', { when: 'always', timezone: 'utc', amount: 1 })
], (req, res, next) => forward(req, res, next, { method: 'post', path: '/departures', data: req.body }));

router.post('/service', [
  express.json({ type: 'application/json', limit: '16kb' }),
  metric.count('tripgo.services', { when: 'always', timezone: 'utc', amount: 1 })
], (req, res, next) => forward(req, res, next, { method: 'post', path: '/service', data: req.body }));

router.post('/latest', [
  express.json({ type: 'application/json', limit: '16kb' }),
  metric.count('tripgo.latest', { when: 'always', timezone: 'utc', amount: 1 })
], (req, res, next) => forward(req, res, next, { method: 'post', path: '/latest', data: req.body }));

module.exports = router;
