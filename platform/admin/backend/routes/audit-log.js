const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { requireRoleIfAdmin, requireServiceOrAdminJwt } = require('../middleware/security');
const tableAudit = require('../db/tableDsaAuditLog');
const { apiError } = require('../middleware/api-error');

router.use(requireServiceOrAdminJwt);
router.use(requireRoleIfAdmin('moderator', 'legal', 'admin', 'root'));

function normalizeText(value, maxLength = 255) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, maxLength);
}

function serializeDetails(details) {
  if (details === undefined) {
    return null;
  }
  try {
    return JSON.stringify(details);
  } catch {
    return null;
  }
}

router.post('/', express.json({ limit: '256kb' }), (req, res, next) => {
  const db = req.database?.db;
  if (!db) {
    return next(apiError.internal('database_unavailable'));
  }

  const entityType = normalizeText(req.body?.entityType, 120);
  const entityId = normalizeText(req.body?.entityId, 255);
  const action = normalizeText(req.body?.action, 160);
  const actor = normalizeText(
    req.body?.actor,
    200
  ) || normalizeText(req.admin?.username || req.admin?.sub || req.service?.sub || 'service', 200);
  const at = Number.isFinite(req.body?.at) ? Math.floor(Number(req.body.at)) : Date.now();
  const detailsJson = serializeDetails(req.body?.details);

  if (!entityType || !entityId || !action) {
    return next(apiError.badRequest('missing_fields'));
  }

  const id = crypto.randomUUID();
  tableAudit.create(db, id, entityType, entityId, action, actor, at, detailsJson, (err) => {
    if (err) {
      req.logger?.error?.('Audit log insert failed', {
        entityType,
        entityId,
        action,
        error: err?.message
      });
      return next(apiError.internal('insert_failed'));
    }
    return res.status(201).json({ id, at });
  });
});

module.exports = router;
