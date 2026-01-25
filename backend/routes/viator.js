// routes/viator.proxy.js
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { signServiceJwt } = require('../utils/serviceJwt');
const { resolveBaseUrl } = require('../utils/adminLogForwarder');
const metric = require('../middleware/metric');
const { apiError } = require('../middleware/api-error');

function normalizeBaseUrl(base) {
  if (!base) return null;
  const trimmed = String(base).trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
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

const viatorBase = normalizeBaseUrl(
  resolveBaseUrl(process.env.VIATOR_BASE_URL, process.env.VIATOR_PORT)
);
const viatorBaseError = viatorBase ? null : 'VIATOR_BASE_URL is missing or invalid';
const client = viatorBase ? axios.create({
  baseURL: `${viatorBase}/viator`,
  timeout: 5000,
  validateStatus: () => true,
  headers: {
    'content-type': 'application/json'
  }
}) : null;

function getClientOrError(req, next) {
  if (client) {
    return client;
  }
  const err = apiError.serviceUnavailable();
  err.detail = viatorBaseError;
  req.logger?.error?.('viator proxy not configured', { error: viatorBaseError });
  next(err);
  return null;
}

function isTimeoutError(err) {
  return err?.code === 'ECONNABORTED' || String(err?.message || '').toLowerCase().includes('timeout');
}

function buildUpstreamError(err) {
  const status = isTimeoutError(err) ? 504 : (err?.response?.status || 502);
  const apiErr = apiError.fromStatus(status);
  apiErr.detail = err?.response?.data || err?.message || null;
  return apiErr;
}

function sendUpstreamError(req, res, err, context) {
  const apiErr = buildUpstreamError(err);
  req.logger?.warn?.(context, { status: apiErr.status, error: apiErr.detail || apiErr.message });
  return res.status(apiErr.status).json(apiErr);
}

router.use(express.json({ limit: '256kb' }));

router.all('/*', [
  metric.count('viator.proxy', { when: 'always', timezone: 'utc', amount: 1 })
], async (req, res, next) => {
  const activeClient = getClientOrError(req, next);
  if (!activeClient) {
    return;
  }
  try {
    const token = await signServiceJwt({
      audience: process.env.SERVICE_JWT_AUDIENCE_VIATOR || 'service.viator'
    });
    const forwardHeaders = {
      Authorization: `Bearer ${token}`,
      'x-forwarded-host': req.get('host'),
      'x-forwarded-proto': req.protocol
    };
    const acceptLanguage = req.get('accept-language');
    if (acceptLanguage) {
      forwardHeaders['accept-language'] = acceptLanguage;
    }
    const upstream = await activeClient.request({
      url: req.path || '/',
      method: req.method,
      params: req.query,
      data: req.body,
      headers: forwardHeaders
    });
    res.status(upstream.status).json(upstream.data);
  } catch (err) {
    if (axios.isAxiosError(err)) {
      return sendUpstreamError(req, res, err, 'viator proxy upstream error');
    }
    return next(err);
  }
});

module.exports = router;
