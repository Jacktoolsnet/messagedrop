const express = require('express');
const axios = require('axios');
const { resolveBaseUrl } = require('../utils/adminLogForwarder');
const { apiError } = require('../middleware/api-error');

const router = express.Router();
const base = normalizeBaseUrl(resolveBaseUrl(process.env.GEODATA_BASE_URL, process.env.GEODATA_PORT));
const client = base ? axios.create({
  baseURL: `${base}/geodata/exports`,
  timeout: Number(process.env.GEODATA_EXPORT_PROXY_TIMEOUT_MS || 5 * 60 * 1000),
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
  validateStatus: () => true
}) : null;

async function forward(req, res, next) {
  if (!client) {
    const error = apiError.serviceUnavailable();
    error.detail = 'GEODATA_BASE_URL is missing or invalid';
    return next(error);
  }
  try {
    const suffix = Array.isArray(req.params.path) ? req.params.path.join('/') : String(req.params.path || '');
    if (suffix && !/^[a-zA-Z0-9_/-]+$/u.test(suffix)) {
      return res.status(400).json({ error: 'invalid_geodata_export_path' });
    }
    const upstream = await client.get(`/${suffix}`, {
      responseType: 'stream',
      headers: { Accept: req.get('Accept') || '*/*', 'x-request-id': req.traceId }
    });
    for (const name of ['content-type', 'content-length', 'content-disposition', 'cache-control', 'digest', 'link']) {
      if (upstream.headers[name]) res.set(name, upstream.headers[name]);
    }
    res.status(upstream.status);
    upstream.data.on('error', next);
    res.on('close', () => upstream.data.destroy());
    return upstream.data.pipe(res);
  } catch (error) {
    if (!axios.isAxiosError(error)) return next(error);
    const apiErr = apiError.fromStatus(error.code === 'ECONNABORTED' ? 504 : 502);
    apiErr.detail = error.message;
    return next(apiErr);
  }
}

router.get('/', forward);
router.get('/*path', forward);

function normalizeBaseUrl(value) {
  if (!value) return null;
  const normalized = String(value).trim().replace(/\/+$/u, '');
  const withScheme = /^https?:\/\//iu.test(normalized) ? normalized : `http://${normalized}`;
  try { return new URL(withScheme).hostname ? withScheme : null; } catch { return null; }
}

module.exports = router;
