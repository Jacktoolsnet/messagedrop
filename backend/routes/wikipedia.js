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
  } catch { return null; }
}

const base = normalizeBaseUrl(resolveBaseUrl(process.env.WIKIPEDIA_BASE_URL, process.env.WIKIPEDIA_PORT));
const client = base ? axios.create({
  baseURL: `${base}/wikipedia`, timeout: Number(process.env.WIKIPEDIA_PROXY_TIMEOUT_MS || 15000),
  validateStatus: () => true, headers: { Accept: 'application/json' }
}) : null;

router.get('/nearby', [metric.count('wikipedia.nearby', { when: 'always', timezone: 'utc', amount: 1 })], async (req, res, next) => {
  if (!client) {
    const error = apiError.serviceUnavailable();
    error.detail = 'WIKIPEDIA_BASE_URL is missing or invalid';
    return next(error);
  }
  try {
    const token = await signServiceJwt({ audience: process.env.SERVICE_JWT_AUDIENCE_WIKIPEDIA || 'service.wikipedia' });
    const upstream = await client.get('/nearby', {
      params: req.query,
      headers: {
        Authorization: `Bearer ${token}`,
        'x-forwarded-host': req.get('host'), 'x-forwarded-proto': req.protocol,
        'x-request-id': req.traceId
      }
    });
    if (upstream.headers['retry-after']) res.set('Retry-After', upstream.headers['retry-after']);
    return res.status(upstream.status).json(upstream.data);
  } catch (error) {
    if (!axios.isAxiosError(error)) return next(error);
    const timeout = error.code === 'ECONNABORTED';
    const apiErr = apiError.fromStatus(timeout ? 504 : 502);
    apiErr.detail = error.message;
    return next(apiErr);
  }
});

module.exports = router;
