const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { requireAdminJwt, checkToken } = require('../middleware/security');
const { verifyServiceJwt } = require('../utils/serviceJwt');
const tableFrontendErrorLog = require('../db/tableFrontendErrorLog');
const { apiError } = require('../middleware/api-error');

// Allow internal services via static token and admins via JWT
router.use((req, res, next) => {
  if (req.token) {
    try {
      verifyServiceJwt(req.token);
      return next();
    } catch {
      return requireAdminJwt(req, res, next);
    }
  }
  return checkToken(req, res, next);
});

const allowedEvents = new Set(['http_error', 'runtime_error', 'unhandled_rejection', 'resource_error']);
const allowedSeverities = new Set(['warning', 'error']);

function safeToken(value, maxLen = 80) {
  if (typeof value !== 'string') return '';
  return value.replace(/[^a-zA-Z0-9_.+-]/g, '').slice(0, maxLen);
}

function safePath(value) {
  if (typeof value !== 'string') return '';
  return value.split('?')[0].slice(0, 200);
}

/**
 * GET /frontend-error-log
 * Query: limit?, offset?
 */
router.get('/', (req, res, next) => {
  const db = req.database?.db;
  if (!db) return next(apiError.internal('database_unavailable'));
  const limit = Number(req.query?.limit);
  const offset = Number(req.query?.offset);
  tableFrontendErrorLog.list(db, limit, offset, (err, rows) => {
    if (err) {
      req.logger?.error('Frontend error log list failed', { error: err?.message });
      return next(apiError.internal('list_failed'));
    }
    res.json({ rows });
  });
});

/**
 * POST /frontend-error-log
 * Body: { client, event, severity, feature?, path?, status?, errorName?, errorCode?, appVersion?, environment?, createdAt? }
 */
router.post('/', express.json({ limit: '32kb' }), (req, res, next) => {
  const db = req.database?.db;
  if (!db) return next(apiError.internal('database_unavailable'));

  const client = safeToken(req.body?.client);
  const event = safeToken(req.body?.event);
  const severity = safeToken(req.body?.severity);
  const feature = safeToken(req.body?.feature);
  const path = safePath(req.body?.path);
  const status = Number.isFinite(req.body?.status) ? Number(req.body.status) : null;
  const errorName = safeToken(req.body?.errorName);
  const errorCode = safeToken(req.body?.errorCode);
  const appVersion = safeToken(req.body?.appVersion, 60);
  const environment = safeToken(req.body?.environment, 16);
  const createdAt = Number.isFinite(req.body?.createdAt) ? Number(req.body.createdAt) : Date.now();

  if (!client || !event || !severity || !allowedEvents.has(event) || !allowedSeverities.has(severity)) {
    return next(apiError.badRequest('missing_fields'));
  }

  const id = crypto.randomUUID();

  tableFrontendErrorLog.create(
    db,
    id,
    client,
    event,
    severity,
    feature || null,
    path || null,
    status,
    errorName || null,
    errorCode || null,
    appVersion || null,
    environment || null,
    createdAt,
    (err) => {
      if (err) {
        req.logger?.error('Frontend error log insert failed', { error: err?.message });
        return next(apiError.internal('insert_failed'));
      }
      res.status(201).json({ id, createdAt });
    }
  );
});

/**
 * GET /frontend-error-log/count?since=<ts>
 * Returns count of entries since timestamp (ms). Default: start of current day (UTC).
 */
router.get('/count', (req, res, next) => {
  const db = req.database?.db;
  if (!db) return next(apiError.internal('database_unavailable'));

  const since = Number(req.query?.since);
  const defaultSince = (() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const sinceTs = Number.isFinite(since) ? since : defaultSince;

  tableFrontendErrorLog.countSince(db, sinceTs, (err, count) => {
    if (err) {
      req.logger?.error('Frontend error log count failed', { error: err?.message });
      return next(apiError.internal('count_failed'));
    }
    res.json({ count, since: sinceTs });
  });
});

/**
 * DELETE /frontend-error-log/cleanup
 * Removes entries older than 7 days.
 */
router.delete('/cleanup', (req, res, next) => {
  const db = req.database?.db;
  if (!db) return next(apiError.internal('database_unavailable'));

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  tableFrontendErrorLog.cleanupOlderThan(db, sevenDaysAgo, (err) => {
    if (err) {
      req.logger?.error('Frontend error log cleanup failed', { error: err?.message });
      return next(apiError.internal('cleanup_failed'));
    }
    res.json({ cleaned: true, threshold: sevenDaysAgo });
  });
});

/**
 * DELETE /frontend-error-log/:id
 */
router.delete('/:id', (req, res, next) => {
  const db = req.database?.db;
  if (!db) return next(apiError.internal('database_unavailable'));
  tableFrontendErrorLog.deleteById(db, req.params.id, (err, ok) => {
    if (err) {
      req.logger?.error('Frontend error log delete failed', { error: err?.message });
      return next(apiError.internal('delete_failed'));
    }
    if (!ok) return next(apiError.notFound('not_found'));
    res.json({ deleted: true });
  });
});

module.exports = router;
