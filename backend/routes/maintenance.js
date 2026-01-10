const express = require('express');
const router = express.Router();
const security = require('../middleware/security');
const tableMaintenance = require('../db/tableMaintenance');
const { apiError } = require('../middleware/api-error');

router.use(express.json({ limit: '64kb' }));
router.use(security.checkToken);

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

function formatMaintenance(row) {
  if (!row) {
    return {
      enabled: false,
      startsAt: null,
      endsAt: null,
      reason: null,
      reasonEn: null,
      reasonEs: null,
      reasonFr: null,
      updatedAt: null
    };
  }
  const toNumber = (val) => (Number.isFinite(Number(val)) ? Number(val) : null);
  return {
    enabled: Number(row.enabled) === 1,
    startsAt: toNumber(row.startsAt),
    endsAt: toNumber(row.endsAt),
    reason: normalizeText(row.reason),
    reasonEn: normalizeText(row.reasonEn),
    reasonEs: normalizeText(row.reasonEs),
    reasonFr: normalizeText(row.reasonFr),
    updatedAt: toNumber(row.updatedAt)
  };
}

router.get('/', (req, res, next) => {
  const db = req.database?.db;
  if (!db) return next(apiError.internal('database_unavailable'));

  tableMaintenance.get(db, (err, row) => {
    if (err) {
      req.logger?.error?.('maintenance fetch failed', { error: err?.message || err });
      return next(apiError.internal('db_error'));
    }
    return res.status(200).json({ status: 200, maintenance: formatMaintenance(row) });
  });
});

router.put('/', (req, res, next) => {
  const db = req.database?.db;
  if (!db) return next(apiError.internal('database_unavailable'));

  const enabled = req.body?.enabled;
  if (typeof enabled !== 'boolean') {
    return next(apiError.badRequest('invalid_enabled'));
  }

  const startsAt = normalizeTimestamp(req.body?.startsAt);
  const endsAt = normalizeTimestamp(req.body?.endsAt);
  if (startsAt && endsAt && endsAt < startsAt) {
    return next(apiError.badRequest('invalid_maintenance_window'));
  }

  const payload = {
    enabled: enabled ? 1 : 0,
    startsAt,
    endsAt,
    reason: normalizeText(req.body?.reason),
    reasonEn: normalizeText(req.body?.reasonEn),
    reasonEs: normalizeText(req.body?.reasonEs),
    reasonFr: normalizeText(req.body?.reasonFr)
  };

  tableMaintenance.set(db, payload, (err) => {
    if (err) {
      req.logger?.error?.('maintenance update failed', { error: err?.message || err });
      return next(apiError.internal('db_error'));
    }
    tableMaintenance.get(db, (fetchErr, row) => {
      if (fetchErr) {
        req.logger?.error?.('maintenance readback failed', { error: fetchErr?.message || fetchErr });
        return next(apiError.internal('db_error'));
      }
      return res.status(200).json({ status: 200, maintenance: formatMaintenance(row) });
    });
  });
});

module.exports = router;
