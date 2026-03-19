const express = require('express');
const axios = require('axios');

const { requireAdminJwt } = require('../middleware/security');
const { apiError } = require('../middleware/api-error');
const { signServiceJwt } = require('../utils/serviceJwt');
const { resolveBaseUrl } = require('../utils/adminLogForwarder');

const router = express.Router();
const nominatimAudience = process.env.SERVICE_JWT_AUDIENCE_NOMINATIM || 'service.nominatim';

router.use(requireAdminJwt);

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

const nominatimBase = normalizeBaseUrl(
  resolveBaseUrl(process.env.NOMINATIM_BASE_URL, process.env.NOMINATIM_PORT)
);

function resolveSearchRequest(req) {
  const rawSearchTerm = req.params.searchTerm ?? req.query.searchTerm ?? req.query.q ?? '';
  const rawLimit = req.params.limit ?? req.query.limit ?? '10';
  const searchTerm = String(rawSearchTerm).trim();
  const parsedLimit = Number.parseInt(String(rawLimit), 10);

  return {
    searchTerm,
    limit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 10
  };
}

async function handleSearch(req, res, next) {
  if (!nominatimBase) {
    return next(apiError.serviceUnavailable('nominatim_unavailable'));
  }

  const { searchTerm, limit } = resolveSearchRequest(req);
  if (!searchTerm) {
    return next(apiError.badRequest('missing_search_term'));
  }

  try {
    const token = await signServiceJwt({ audience: nominatimAudience });
    const response = await axios.get(
      `${nominatimBase}/nominatim/search/${encodeURIComponent(searchTerm)}/${encodeURIComponent(limit)}`,
      {
        timeout: 5000,
        validateStatus: () => true,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'x-forwarded-host': req.get('host'),
          'x-forwarded-proto': req.protocol
        }
      }
    );

    if (response.status === 404) {
      return res.status(200).json({ status: 200, result: [] });
    }

    return res.status(response.status).json(response.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const upstreamError = apiError.fromStatus(error.response?.status || 502);
      upstreamError.detail = error.response?.data || error.message || 'nominatim_request_failed';
      return next(upstreamError);
    }
    return next(error);
  }
}

router.get('/search', handleSearch);
router.get('/search/:searchTerm', handleSearch);
router.get('/search/:searchTerm/:limit', handleSearch);

module.exports = router;
