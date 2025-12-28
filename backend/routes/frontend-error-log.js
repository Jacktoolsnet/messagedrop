const express = require('express');
const axios = require('axios');
const { signServiceJwt } = require('../utils/serviceJwt');
const { resolveBaseUrl } = require('../utils/adminLogForwarder');
const { apiError } = require('../middleware/api-error');

const router = express.Router();

const allowedEvents = new Set(['http_error', 'runtime_error', 'unhandled_rejection', 'resource_error']);
const allowedSeverities = new Set(['warning', 'error']);

function safeToken(value, maxLen = 80) {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[^a-zA-Z0-9_.+-]/g, '').slice(0, maxLen);
  return cleaned || undefined;
}

function safeMessage(value, maxLen = 300) {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[^\x20-\x7E]/g, '').slice(0, maxLen);
  return cleaned || undefined;
}

function safeStack(value, maxLen = 4000) {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '').slice(0, maxLen);
  return cleaned || undefined;
}

function safePath(value) {
  if (typeof value !== 'string') return undefined;
  return value.split('?')[0].split('#')[0].slice(0, 200) || undefined;
}

function safeSource(value) {
  if (typeof value !== 'string') return undefined;
  try {
    const parsed = new URL(value, typeof window !== 'undefined' ? window.location.origin : undefined);
    return safePath(parsed.pathname + (parsed.hash ?? ''));
  } catch {
    return safePath(value);
  }
}

function sanitizePayload(body) {
  const event = safeToken(body?.event);
  const severity = safeToken(body?.severity);
  if (!event || !severity || !allowedEvents.has(event) || !allowedSeverities.has(severity)) {
    return null;
  }
  const createdAt = Number.isFinite(body?.createdAt) ? Number(body.createdAt) : Date.now();
  return {
    client: 'web',
    event,
    severity,
    feature: safeToken(body?.feature),
    path: safePath(body?.path),
    status: Number.isFinite(body?.status) ? Number(body.status) : undefined,
    errorName: safeToken(body?.errorName),
    errorMessage: safeMessage(body?.errorMessage),
    stack: safeStack(body?.stack),
    source: safeSource(body?.source),
    line: Number.isFinite(body?.line) ? Math.max(0, Math.floor(Number(body.line))) : undefined,
    column: Number.isFinite(body?.column) ? Math.max(0, Math.floor(Number(body.column))) : undefined,
    errorCode: safeToken(body?.errorCode),
    appVersion: safeToken(body?.appVersion),
    environment: body?.environment === 'prod' ? 'prod' : 'dev',
    createdAt
  };
}

async function forwardToAdmin(payload) {
  const adminBase = resolveBaseUrl(process.env.ADMIN_BASE_URL, process.env.ADMIN_PORT, process.env.ADMIN_LOG_URL);
  if (!adminBase) return false;
  const jwtToken = await signServiceJwt({
    audience: process.env.SERVICE_JWT_AUDIENCE_ADMIN || 'service.admin-backend'
  });
  const response = await axios.post(`${adminBase}/frontend-error-log`, payload, {
    headers: { Authorization: `Bearer ${jwtToken}` },
    timeout: 2000,
    validateStatus: () => true
  });
  return response.status >= 200 && response.status < 300;
}

/**
 * POST /frontend-error-log
 * Body: FrontendErrorPayload (sanitized)
 */
router.post('/', express.json({ limit: '64kb' }), async (req, res, next) => {
  const payload = sanitizePayload(req.body);
  if (!payload) {
    return next(apiError.badRequest('invalid_payload'));
  }

  try {
    const ok = await forwardToAdmin(payload);
    if (!ok) {
      req.logger?.warn('Frontend error log forward failed', { status: 'non_2xx' });
    }
  } catch (err) {
    req.logger?.warn('Frontend error log forward failed', { error: err?.message });
  }

  res.status(202).json({ forwarded: true });
});

module.exports = router;
