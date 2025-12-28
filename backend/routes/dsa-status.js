const express = require('express');
const axios = require('axios');
const multer = require('multer');
const FormData = require('form-data');
const rateLimit = require('express-rate-limit');
const { signServiceJwt } = require('../utils/serviceJwt');
const { apiError } = require('../middleware/api-error');

const router = express.Router();
const upload = multer({ limits: { fileSize: 5 * 1024 * 1024 } });

const rateLimitMessage = (message) => ({
  errorCode: 'RATE_LIMIT',
  message,
  error: message
});

const statusLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage('Too many status requests, please try again later.')
});

const appealLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage('Too many appeal requests, please try again later.')
});

const evidenceLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage('Too many evidence uploads, please try again later.')
});

function buildForwardError(err) {
  const status = err?.response?.status || 502;
  const apiErr = apiError.fromStatus(status);
  apiErr.detail = err?.response?.data || err?.message || null;
  return apiErr;
}

function adminBase(path) {
  const base = `${process.env.ADMIN_BASE_URL}:${process.env.ADMIN_PORT}`.replace(/\/+$/, '');
  return `${base}/public${path}`;
}

async function forwardGet(path, opts = {}) {
  const token = await signServiceJwt({
    audience: process.env.SERVICE_JWT_AUDIENCE_ADMIN || 'service.admin-backend'
  });
  return axios.get(adminBase(path), {
    timeout: 5000,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {})
    },
    responseType: opts.responseType || 'json'
  });
}

async function forwardPost(path, body, opts = {}) {
  const token = await signServiceJwt({
    audience: process.env.SERVICE_JWT_AUDIENCE_ADMIN || 'service.admin-backend'
  });
  return axios.post(adminBase(path), body, {
    timeout: 5000,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts.headers || {})
    },
    validateStatus: () => true
  });
}

router.get('/status/:token', statusLimiter, async (req, res, next) => {
  try {
    const resp = await forwardGet(`/status/${encodeURIComponent(req.params.token)}`);
    res.status(resp.status).json(resp.data);
  } catch (err) {
    return next(buildForwardError(err));
  }
});

router.get('/status/:token/evidence/:id', statusLimiter, async (req, res, next) => {
  try {
    const resp = await forwardGet(`/status/${encodeURIComponent(req.params.token)}/evidence/${encodeURIComponent(req.params.id)}`, { responseType: 'arraybuffer' });
    Object.entries(resp.headers || {}).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    res.status(resp.status).send(resp.data);
  } catch (err) {
    return next(buildForwardError(err));
  }
});

router.post('/status/:token/appeals', appealLimiter, express.json({ limit: '2mb' }), async (req, res, next) => {
  try {
    const resp = await forwardPost(`/status/${encodeURIComponent(req.params.token)}/appeals`, req.body);
    res.status(resp.status).json(resp.data);
  } catch (err) {
    return next(buildForwardError(err));
  }
});

router.post('/status/:token/appeals/:appealId/evidence', evidenceLimiter, upload.single('file'), async (req, res, next) => {
  if (!req.file) return next(apiError.badRequest('file_required'));
  try {
    const form = new FormData();
    form.append('file', req.file.buffer, req.file.originalname);
    const token = await signServiceJwt({
      audience: process.env.SERVICE_JWT_AUDIENCE_ADMIN || 'service.admin-backend'
    });
    const headers = form.getHeaders({ Authorization: `Bearer ${token}` });
    const resp = await axios.post(
      adminBase(`/status/${encodeURIComponent(req.params.token)}/appeals/${encodeURIComponent(req.params.appealId)}/evidence`),
      form,
      {
        timeout: 5000,
        headers,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        validateStatus: () => true
      }
    );
    res.status(resp.status).json(resp.data);
  } catch (err) {
    return next(buildForwardError(err));
  }
});

// Forward adding URL evidence for an appeal (JSON body)
router.post('/status/:token/appeals/:appealId/evidence/url', evidenceLimiter, express.json({ limit: '1mb' }), async (req, res, next) => {
  try {
    const resp = await forwardPost(
      `/status/${encodeURIComponent(req.params.token)}/appeals/${encodeURIComponent(req.params.appealId)}/evidence/url`,
      req.body
    );
    res.status(resp.status).json(resp.data);
  } catch (err) {
    return next(buildForwardError(err));
  }
});

module.exports = router;
