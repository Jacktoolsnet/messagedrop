const express = require('express');
const axios = require('axios');
const multer = require('multer');

const { requireAdminJwt, requireRole } = require('../middleware/security');
const { apiError } = require('../middleware/api-error');
const { signServiceJwt } = require('../utils/serviceJwt');
const { resolveBaseUrl } = require('../utils/adminLogForwarder');

const router = express.Router();

const STICKER_ROLES = ['editor', 'admin', 'root'];
const DEFAULT_PROXY_TIMEOUT_MS = 15000;
const stickerAudience = process.env.SERVICE_JWT_AUDIENCE_STICKER || 'service.sticker';
const maxStickerSvgFiles = Math.max(1, Number(process.env.STICKER_IMPORT_MAX_FILES || 500));
const maxStickerSvgFileBytes = Math.max(1, Number(process.env.STICKER_IMPORT_MAX_FILE_MB || 4)) * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: maxStickerSvgFileBytes,
    files: maxStickerSvgFiles
  },
  fileFilter: (_req, file, cb) => {
    const lowerName = String(file.originalname || '').toLowerCase();
    if (file.mimetype === 'image/svg+xml' || lowerName.endsWith('.svg')) {
      return cb(null, true);
    }
    return cb(apiError.unsupportedMediaType('svg_only_upload'));
  }
});

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

router.use(requireAdminJwt, requireRole(...STICKER_ROLES));
router.use(express.json({ limit: '5mb' }));

router.get('/settings', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'get',
      path: '/settings'
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'put',
      path: '/admin/settings',
      data: req.body
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'get',
      path: '/categories',
      params: req.query
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'post',
      path: '/admin/categories',
      data: req.body
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.post('/flaticon/resolve', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'post',
      path: '/admin/flaticon/resolve',
      data: req.body
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.get('/categories/:id', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'get',
      path: `/categories/${encodeURIComponent(req.params.id)}`
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
      params: req.query
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.put('/categories/:id', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'put',
      path: `/admin/categories/${encodeURIComponent(req.params.id)}`,
      data: req.body
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.delete('/categories/:id', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'delete',
      path: `/admin/categories/${encodeURIComponent(req.params.id)}`
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.get('/packs', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'get',
      path: '/packs',
      params: req.query
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.post('/packs', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'post',
      path: '/admin/packs',
      data: req.body
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.get('/packs/:id', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'get',
      path: `/packs/${encodeURIComponent(req.params.id)}`
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
      params: req.query
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.put('/packs/:id', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'put',
      path: `/admin/packs/${encodeURIComponent(req.params.id)}`,
      data: req.body
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.delete('/packs/:id', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'delete',
      path: `/admin/packs/${encodeURIComponent(req.params.id)}`
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.get('/stickers', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'get',
      path: '/stickers',
      params: req.query
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.post('/stickers', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'post',
      path: '/admin/stickers',
      data: req.body
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.get('/stickers/:id', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'get',
      path: `/stickers/${encodeURIComponent(req.params.id)}`
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.put('/stickers/:id', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'put',
      path: `/admin/stickers/${encodeURIComponent(req.params.id)}`,
      data: req.body
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.delete('/stickers/:id', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'delete',
      path: `/admin/stickers/${encodeURIComponent(req.params.id)}`
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.post('/packs/:packId/stickers/bulk-upsert', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'post',
      path: `/admin/packs/${encodeURIComponent(req.params.packId)}/stickers/bulk-upsert`,
      data: req.body
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.post('/packs/:packId/import-svg', upload.array('files', maxStickerSvgFiles), async (req, res, next) => {
  try {
    const files = Array.isArray(req.files) ? req.files : [];
    if (files.length === 0) {
      throw apiError.badRequest('svg_files_required');
    }
    const payload = {
      files: files.map((file) => ({
        fileName: file.originalname,
        mimeType: file.mimetype,
        contentBase64: Buffer.from(file.buffer).toString('base64')
      }))
    };
    const response = await requestStickerService(req, {
      method: 'post',
      path: `/admin/packs/${encodeURIComponent(req.params.packId)}/import-svg`,
      data: payload
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.get('/search', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'get',
      path: '/search',
      params: req.query
    });
    return relayJsonResponse(res, response);
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

router.get('/render/:stickerId', async (req, res, next) => {
  try {
    const response = await requestStickerService(req, {
      method: 'get',
      path: `/render/${encodeURIComponent(req.params.stickerId)}`,
      params: req.query,
      responseType: 'arraybuffer',
      headers: {
        Accept: req.get('accept') || '*/*'
      }
    });

    const contentType = String(response.headers?.['content-type'] || '').toLowerCase();
    if (response.status >= 400 || contentType.includes('application/json')) {
      const payload = parseJsonBuffer(response.data) || { status: response.status, error: 'sticker_render_failed' };
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
    return res.status(response.status).send(Buffer.from(response.data));
  } catch (error) {
    return next(axios.isAxiosError(error) ? buildAxiosError(error) : error);
  }
});

module.exports = router;
