const express = require('express');
const axios = require('axios');

const metric = require('../middleware/metric');
const security = require('../middleware/security');
const { apiError } = require('../middleware/api-error');
const { signServiceJwt } = require('../utils/serviceJwt');
const { resolveBaseUrl } = require('../utils/adminLogForwarder');

const router = express.Router();

const DEFAULT_PROXY_TIMEOUT_MS = 15000;
const stickerAudience = process.env.SERVICE_JWT_AUDIENCE_STICKER || 'service.sticker';

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

  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  req.logger?.debug?.('relaying sticker asset', {
    status: response.status,
    contentType: response.headers?.['content-type']
  });

  return res.status(response.status).send(Buffer.from(response.data));
}

router.use(metric.count('sticker.proxy', { when: 'always', timezone: 'utc', amount: 1 }));
router.use(security.authenticateOptional);
router.use(express.json({ limit: '256kb' }));

router.get('/categories', async (req, res, next) => {
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

router.get('/categories/:id/packs', async (req, res, next) => {
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

router.get('/packs/:id/stickers', async (req, res, next) => {
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

router.get('/packs/:id/license', async (req, res, next) => {
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

router.get('/render/:stickerId', async (req, res, next) => {
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
