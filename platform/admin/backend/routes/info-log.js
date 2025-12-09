const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { requireAdminJwt, checkToken } = require('../middleware/security');
const tableInfoLog = require('../db/tableInfoLog');

// Allow internal services via static token and admins via JWT
router.use((req, res, next) => {
  if (req.token) {
    return requireAdminJwt(req, res, next);
  }
  return checkToken(req, res, next);
});

/**
 * POST /info-log
 * Body: { source: string, file: string, message: string, createdAt?: number }
 */
router.post('/', express.json({ limit: '256kb' }), (req, res) => {
  const db = req.database?.db;
  if (!db) return res.status(500).json({ message: 'database_unavailable' });

  const source = typeof req.body?.source === 'string' ? req.body.source.trim() : '';
  const file = typeof req.body?.file === 'string' ? req.body.file.trim() : '';
  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
  const createdAt = Number.isFinite(req.body?.createdAt) ? Number(req.body.createdAt) : Date.now();

  if (!source || !file || !message) {
    return res.status(400).json({ message: 'missing_fields' });
  }

  const id = crypto.randomUUID();

  tableInfoLog.create(db, id, source, file, message, createdAt, (err) => {
    if (err) {
      req.logger?.error('Info log insert failed', { error: err?.message });
      return res.status(500).json({ message: 'insert_failed' });
    }
    res.status(201).json({ id, createdAt });
  });
});

/**
 * DELETE /info-log/cleanup
 * Removes entries older than 7 days.
 */
router.delete('/cleanup', (req, res) => {
  const db = req.database?.db;
  if (!db) return res.status(500).json({ message: 'database_unavailable' });

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  tableInfoLog.cleanupOlderThan(db, sevenDaysAgo, (err) => {
    if (err) {
      req.logger?.error('Info log cleanup failed', { error: err?.message });
      return res.status(500).json({ message: 'cleanup_failed' });
    }
    res.json({ cleaned: true, threshold: sevenDaysAgo });
  });
});

module.exports = router;
