const express = require('express');
const router = express.Router();
const { requireAdminJwt, checkToken } = require('../middleware/security');
const { verifyServiceJwt } = require('../utils/serviceJwt');
const tablePowLog = require('../db/tablePowLog');
const { logPowEvent } = require('../utils/powLogger');
const { apiError } = require('../middleware/api-error');

// Allow internal services via service JWT and admins via JWT
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

/**
 * GET /pow-log
 * Query: limit?, offset?
 */
router.get('/', (req, res, next) => {
  const db = req.database?.db;
  if (!db) return next(apiError.internal('database_unavailable'));
  const limit = Number(req.query?.limit);
  const offset = Number(req.query?.offset);
  tablePowLog.list(db, limit, offset, (err, rows) => {
    if (err) {
      req.logger?.error('PoW log list failed', { error: err?.message });
      return next(apiError.internal('list_failed'));
    }
    res.json({ rows });
  });
});

/**
 * POST /pow-log
 * Body: { source, scope, path, method, ip, userAgent, reason, difficulty?, requiredUntil?, createdAt?, notify? }
 */
router.post('/', express.json({ limit: '64kb' }), async (req, res, next) => {
  const db = req.database?.db;
  if (!db) return next(apiError.internal('database_unavailable'));

  const payload = req.body || {};
  if (!payload.scope || !payload.path || !payload.method) {
    return next(apiError.badRequest('missing_fields'));
  }

  try {
    const entry = await logPowEvent(db, payload, req.logger, { notify: payload.notify !== false });
    res.status(201).json({ id: entry.id, createdAt: entry.createdAt });
  } catch (err) {
    req.logger?.error('PoW log insert failed', { error: err?.message });
    return next(apiError.internal('insert_failed'));
  }
});

/**
 * GET /pow-log/count?since=<ts>
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

  tablePowLog.countSince(db, sinceTs, (err, count) => {
    if (err) {
      req.logger?.error('PoW log count failed', { error: err?.message });
      return next(apiError.internal('count_failed'));
    }
    res.json({ count, since: sinceTs });
  });
});

/**
 * DELETE /pow-log/cleanup
 */
router.delete('/cleanup', (req, res, next) => {
  const db = req.database?.db;
  if (!db) return next(apiError.internal('database_unavailable'));
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  tablePowLog.cleanupOlderThan(db, sevenDaysAgo, (err) => {
    if (err) {
      req.logger?.error('PoW log cleanup failed', { error: err?.message });
      return next(apiError.internal('cleanup_failed'));
    }
    res.json({ cleaned: true, threshold: sevenDaysAgo });
  });
});

/**
 * DELETE /pow-log
 * Deletes all entries.
 */
router.delete('/', (req, res, next) => {
  const db = req.database?.db;
  if (!db) return next(apiError.internal('database_unavailable'));
  tablePowLog.deleteAll(db, (err, count) => {
    if (err) {
      req.logger?.error('PoW log delete all failed', { error: err?.message });
      return next(apiError.internal('delete_failed'));
    }
    res.json({ deleted: true, count });
  });
});

/**
 * DELETE /pow-log/:id
 */
router.delete('/:id', (req, res, next) => {
  const db = req.database?.db;
  if (!db) return next(apiError.internal('database_unavailable'));
  tablePowLog.deleteById(db, req.params.id, (err, ok) => {
    if (err) {
      req.logger?.error('PoW log delete failed', { error: err?.message });
      return next(apiError.internal('delete_failed'));
    }
    if (!ok) return next(apiError.notFound('not_found'));
    res.json({ deleted: true });
  });
});

module.exports = router;
