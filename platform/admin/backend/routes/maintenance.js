const express = require('express');
const axios = require('axios');
const deepl = require('deepl-node');
const { requireAdminJwt, requireRole } = require('../middleware/security');
const { signServiceJwt } = require('../utils/serviceJwt');
const { apiError } = require('../middleware/api-error');

const router = express.Router();
const translator = new deepl.Translator(process.env.DEEPL_API_KEY);

router.use(express.json({ limit: '64kb' }));
router.use(requireAdminJwt);
router.use(requireRole('admin', 'root'));

function normalizeTimestamp(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return Math.trunc(num);
}

function normalizeText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveBackendBase() {
  if (!process.env.BASE_URL || !process.env.PORT) return null;
  return `${process.env.BASE_URL}:${process.env.PORT}`;
}

async function callBackend(method, path, payload) {
  const base = resolveBackendBase();
  if (!base) {
    throw new Error('backend_unavailable');
  }
  const backendAudience = process.env.SERVICE_JWT_AUDIENCE_BACKEND || 'service.backend';
  const serviceToken = await signServiceJwt({ audience: backendAudience });
  return axios({
    method,
    url: `${base}${path}`,
    data: payload,
    headers: {
      Authorization: `Bearer ${serviceToken}`,
      Accept: 'application/json',
      'content-type': 'application/json'
    },
    timeout: 5000,
    validateStatus: () => true
  });
}

async function translateReason(reason) {
  const [en, es, fr] = await Promise.all([
    translator.translateText(reason, null, 'EN-GB'),
    translator.translateText(reason, null, 'ES'),
    translator.translateText(reason, null, 'FR')
  ]);
  return {
    reasonEn: en?.text || null,
    reasonEs: es?.text || null,
    reasonFr: fr?.text || null
  };
}

router.get('/', async (_req, res, next) => {
  try {
    const response = await callBackend('get', '/maintenance');
    return res.status(response.status).json(response.data);
  } catch (error) {
    const apiErr = apiError.badGateway('backend_unavailable');
    apiErr.detail = error?.message || error;
    return next(apiErr);
  }
});

router.put('/', async (req, res, next) => {
  const enabled = req.body?.enabled;
  if (typeof enabled !== 'boolean') {
    return next(apiError.badRequest('invalid_enabled'));
  }

  const startsAt = normalizeTimestamp(req.body?.startsAt);
  const endsAt = normalizeTimestamp(req.body?.endsAt);
  if (startsAt && endsAt && endsAt < startsAt) {
    return next(apiError.badRequest('invalid_maintenance_window'));
  }

  const reason = normalizeText(req.body?.reason);

  let translations = { reasonEn: null, reasonEs: null, reasonFr: null };
  if (reason) {
    try {
      translations = await translateReason(reason);
    } catch (error) {
      const apiErr = apiError.internal('translate_failed');
      apiErr.detail = error?.message || error;
      return next(apiErr);
    }
  }

  try {
    const response = await callBackend('put', '/maintenance', {
      enabled,
      startsAt,
      endsAt,
      reason,
      ...translations
    });
    return res.status(response.status).json(response.data);
  } catch (error) {
    const apiErr = apiError.badGateway('backend_unavailable');
    apiErr.detail = error?.message || error;
    return next(apiErr);
  }
});

module.exports = router;
