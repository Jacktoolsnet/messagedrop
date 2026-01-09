const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { requireAdminJwt, checkToken } = require('../middleware/security');
const { verifyServiceJwt } = require('../utils/serviceJwt');
const tableWarnLog = require('../db/tableWarnLog');
const { apiError } = require('../middleware/api-error');
const { parseRetentionMs, DAY_MS } = require('../utils/logRetention');

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

/**
 * POST /warn-log
 * Body: { source: string, file: string, message: string, detail?: string, createdAt?: number }
 */
router.post('/', express.json({ limit: '256kb' }), (req, res, next) => {
  const db = req.database?.db;
  if (!db) return next(apiError.internal('database_unavailable'));

  const source = typeof req.body?.source === 'string' ? req.body.source.trim() : '';
  const file = typeof req.body?.file === 'string' ? req.body.file.trim() : '';
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const detail = typeof req.body?.detail === 'string'
    ? req.body.detail.trim()
    : (req.body?.detail ? JSON.stringify(req.body.detail) : '');
  const createdAt = Number.isFinite(req.body?.createdAt) ? Number(req.body.createdAt) : Date.now();

  if (!source || !file || !message) {
    return next(apiError.badRequest('missing_fields'));
  }

  const id = crypto.randomUUID();

  tableWarnLog.create(db, id, source, file, message, detail || null, createdAt, (err) => {
    if (err) {
      req.logger?.error('Warn log insert failed', { error: err?.message });
      return next(apiError.internal('insert_failed'));
    }
    res.status(201).json({ id, createdAt });
  });
});

/**
 * GET /warn-log
 * Query: limit?, offset?
 */
router.get('/', (req, res, next) => {
  const db = req.database?.db;
  if (!db) return next(apiError.internal('database_unavailable'));
  const limit = Number(req.query?.limit);
  const offset = Number(req.query?.offset);
  tableWarnLog.list(db, limit, offset, (err, rows) => {
    if (err) {
      req.logger?.error('Warn log list failed', { error: err?.message });
      return next(apiError.internal('list_failed'));
    }
    res.json({ rows });
  });
});

/**
 * GET /warn-log/count?since=<ts>
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

  tableWarnLog.countSince(db, sinceTs, (err, count) => {
    if (err) {
      req.logger?.error('Warn log count failed', { error: err?.message });
      return next(apiError.internal('count_failed'));
    }
    res.json({ count, since: sinceTs });
  });
});

/**
 * DELETE /warn-log/cleanup
 * Removes entries older than configured retention (LOG_RETENTION_INFO).
 */
router.delete('/cleanup', (req, res, next) => {
  const db = req.database?.db;
  if (!db) return next(apiError.internal('database_unavailable'));

  const retentionMs = parseRetentionMs(process.env.LOG_RETENTION_INFO || '2d', 2 * DAY_MS);
  const threshold = Date.now() - retentionMs;
  tableWarnLog.cleanupOlderThan(db, threshold, (err) => {
    if (err) {
      req.logger?.error('Warn log cleanup failed', { error: err?.message });
      return next(apiError.internal('cleanup_failed'));
    }
    res.json({ cleaned: true, threshold });
  });
});

/**
 * DELETE /warn-log
 * Deletes all entries.
 */
router.delete('/', (req, res, next) => {
  const db = req.database?.db;
  if (!db) return next(apiError.internal('database_unavailable'));
  tableWarnLog.deleteAll(db, (err, count) => {
    if (err) {
      req.logger?.error('Warn log delete all failed', { error: err?.message });
      return next(apiError.internal('delete_failed'));
    }
    res.json({ deleted: true, count });
  });
});

/**
 * DELETE /warn-log/:id
 */
router.delete('/:id', (req, res, next) => {
  const db = req.database?.db;
  if (!db) return next(apiError.internal('database_unavailable'));
  tableWarnLog.deleteById(db, req.params.id, (err, ok) => {
    if (err) {
      req.logger?.error('Warn log delete failed', { error: err?.message });
      return next(apiError.internal('delete_failed'));
    }
    if (!ok) return next(apiError.notFound('not_found'));
    res.json({ deleted: true });
  });
});

module.exports = router;
