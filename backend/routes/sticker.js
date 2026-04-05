const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const metric = require('../middleware/metric');
const security = require('../middleware/security');
const { apiError } = require('../middleware/api-error');
const { signServiceJwt } = require('../utils/serviceJwt');
const { resolveBaseUrl } = require('../utils/adminLogForwarder');

const router = express.Router();

const DEFAULT_PROXY_TIMEOUT_MS = 15000;
const DEFAULT_RENDER_TOKEN_TTL_SECONDS = 300;
const MIN_RENDER_TOKEN_REMAINING_MS = 15000;
const stickerAudience = process.env.SERVICE_JWT_AUDIENCE_STICKER || 'service.sticker';
const stickerRenderAudience = process.env.STICKER_RENDER_TOKEN_AUDIENCE || 'app.sticker-render';
const stickerRenderIssuer = process.env.STICKER_RENDER_TOKEN_ISSUER || 'messagedrop-public-backend';

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

function resolveTimeoutMs(rawValue, fallback) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.round(parsed);
}

function resolvePositiveInt(rawValue, fallback) {
  const parsed = Number.parseInt(String(rawValue ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}

function buildStickerBase() {
  return normalizeBaseUrl(resolveBaseUrl(process.env.STICKER_BASE_URL, process.env.STICKER_PORT));
}

function getStickerBaseOrError(req) {
  const stickerBase = buildStickerBase();
  if (stickerBase) {
    return stickerBase;
  }
  const error = apiError.serviceUnavailable('sticker_service_unavailable');
  error.detail = 'STICKER_BASE_URL is missing or invalid';
  req.logger?.error?.('sticker proxy not configured', { error: error.detail });
  throw error;
}

function buildProxyHeaders(req, token, extraHeaders = {}) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
    'x-forwarded-host': req.get('host'),
    'x-forwarded-proto': req.protocol,
    ...extraHeaders
  };
  const acceptLanguage = req.get('accept-language');
  if (acceptLanguage) {
    headers['accept-language'] = acceptLanguage;
  }
  return headers;
}

function isTimeoutError(error) {
  return error?.code === 'ECONNABORTED' || String(error?.message || '').toLowerCase().includes('timeout');
}

function buildAxiosError(error) {
  const status = isTimeoutError(error) ? 504 : (error?.response?.status || 502);
  const proxyError = apiError.fromStatus(status);
  proxyError.detail = error?.response?.data || error?.message || null;
  return proxyError;
}

function parseJsonBuffer(buffer) {
  try {
    return JSON.parse(Buffer.from(buffer).toString('utf8'));
  } catch {
    return null;
  }
}

async function requestStickerService(req, {
  method = 'get',
  path = '/',
  params,
  data,
  responseType = 'json',
  headers = {}
} = {}) {
  const baseUrl = getStickerBaseOrError(req);
  const token = await signServiceJwt({ audience: stickerAudience });
  const timeout = resolveTimeoutMs(process.env.STICKER_PROXY_TIMEOUT_MS, DEFAULT_PROXY_TIMEOUT_MS);

  return axios.request({
    method,
    url: `${baseUrl}/sticker${path}`,
    params,
    data,
    timeout,
    responseType,
    validateStatus: () => true,
    headers: buildProxyHeaders(req, token, headers)
  });
}

function relayJsonResponse(res, response) {
  return res.status(response.status).json(response.data);
}

function relayBinaryResponse(req, res, response, fallbackErrorCode) {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
  if (response.status >= 400 || contentType.includes('application/json')) {
    const payload = parseJsonBuffer(response.data) || {
      status: response.status,
      error: fallbackErrorCode
    };
    return res.status(response.status).json(payload);
  }

  const allowedHeaders = [
    'cache-control',
    'content-type',
    'content-disposition',
    'x-content-type-options',
    'x-resolved-sticker-id',
    'x-sticker-fallback'
  ];

  for (const headerName of allowedHeaders) {
    const value = response.headers?.[headerName];
    if (value !== undefined) {
      res.setHeader(headerName, value);
    }
  }

  req.logger?.debug?.('relaying sticker asset', {
    status: response.status,
    contentType: response.headers?.['content-type']
  });

  return res.status(response.status).send(Buffer.from(response.data));
}

function getStickerRenderTokenSecret() {
  return process.env.STICKER_RENDER_TOKEN_SECRET || process.env.JWT_SECRET || null;
}

function getStickerRenderTokenTtlSeconds() {
  return resolvePositiveInt(process.env.STICKER_RENDER_TOKEN_TTL_SECONDS, DEFAULT_RENDER_TOKEN_TTL_SECONDS);
}

function issueStickerRenderToken(req) {
  const secret = getStickerRenderTokenSecret();
  if (!secret) {
    throw new Error('JWT secret for sticker render token is not configured');
  }

  const ttlSeconds = getStickerRenderTokenTtlSeconds();
  const userId = String(req.jwtUser?.userId || req.jwtUser?.id || '').trim();
  const subject = userId || `guest:${crypto.randomUUID()}`;
  const token = jwt.sign(
    {
      purpose: 'sticker_render',
      guest: !userId
    },
    secret,
    {
      audience: stickerRenderAudience,
      issuer: stickerRenderIssuer,
      subject,
      expiresIn: ttlSeconds
    }
  );

  return {
    token,
    expiresAt: Date.now() + ttlSeconds * 1000
  };
}

function verifyStickerRenderToken(token) {
  const secret = getStickerRenderTokenSecret();
  if (!secret) {
    throw new Error('JWT secret for sticker render token is not configured');
  }

  const payload = jwt.verify(token, secret, {
    audience: stickerRenderAudience,
    issuer: stickerRenderIssuer
  });

  if (payload?.purpose !== 'sticker_render') {
    throw new Error('Invalid sticker render token purpose');
  }

  const expiresAtMs = Number(payload?.exp) * 1000;
  if (Number.isFinite(expiresAtMs) && expiresAtMs - Date.now() <= 0) {
    throw new Error('Sticker render token expired');
  }

  return payload;
}

function authenticateStickerRender(req, res, next) {
  const bearerToken = security.extractBearerFromHeader(req);
  if (!bearerToken) {
    return res.status(403).json({
      errorCode: 'UNAUTHORIZED',
      message: 'missing_token',
      error: 'missing_token'
    });
  }

  try {
    const jwtUser = security.verifyUserJwtToken(bearerToken);
    const userId = String(jwtUser?.userId || jwtUser?.id || '').trim();
    if (userId) {
      req.jwtUser = jwtUser;
      return next();
    }
  } catch {
    // fall through to sticker render session verification below
  }

  try {
    req.stickerRenderSession = verifyStickerRenderToken(bearerToken);
    const expiresAtMs = Number(req.stickerRenderSession?.exp) * 1000;
    if (Number.isFinite(expiresAtMs) && expiresAtMs - Date.now() <= MIN_RENDER_TOKEN_REMAINING_MS) {
      res.setHeader('x-sticker-render-token-expiring', 'true');
    }
    return next();
  } catch {
    return res.status(403).json({
      errorCode: 'UNAUTHORIZED',
      message: 'invalid_token',
      error: 'invalid_token'
    });
  }
}

router.use(metric.count('sticker.proxy', { when: 'always', timezone: 'utc', amount: 1 }));
router.use(express.json({ limit: '256kb' }));
router.use('/render', (_req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

router.get('/bootstrap', security.authenticate, async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'get',
      path: '/bootstrap'
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.get('/categories', security.authenticate, async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'get',
      path: '/categories',
      params: {
        status: 'active'
      }
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.get('/categories/:id/packs', security.authenticate, async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'get',
      path: `/categories/${encodeURIComponent(req.params.id)}/packs`,
      params: {
        status: 'active',
        searchVisible: true
      }
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.get('/packs/:id/stickers', security.authenticate, async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'get',
      path: `/packs/${encodeURIComponent(req.params.id)}/stickers`,
      params: {
        status: 'active',
        searchVisible: true,
        limit: req.query.limit,
        offset: req.query.offset
      }
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.get('/packs/:id/license', security.authenticate, async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'get',
      path: `/packs/${encodeURIComponent(req.params.id)}/license`,
      responseType: 'arraybuffer',
      headers: {
        Accept: req.get('accept') || '*/*'
      }
    });
    return relayBinaryResponse(req, res, response, 'sticker_pack_license_fetch_failed');
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.post('/render-session', security.authenticateOptional, (req, res, next) => {
  try {
    const session = issueStickerRenderToken(req);
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    return res.status(200).json({
      status: 200,
      token: session.token,
      expiresAt: session.expiresAt
    });
  } catch (error) {
    req.logger?.error?.('failed to issue sticker render token', {
      error: error?.message
    });
    return next(apiError.internal('sticker_render_session_failed'));
  }
});

router.get('/render/:stickerId', authenticateStickerRender, async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'get',
      path: `/render/${encodeURIComponent(req.params.stickerId)}`,
      params: {
        variant: req.query.variant
      },
      responseType: 'arraybuffer',
      headers: {
        Accept: req.get('accept') || '*/*'
      }
    });
    return relayBinaryResponse(req, res, response, 'sticker_render_failed');
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

module.exports = router;
