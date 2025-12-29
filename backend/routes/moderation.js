const express = require('express');
const security = require('../middleware/security');
const tableMessage = require('../db/tableMessage');
const { apiError } = require('../middleware/api-error');

const router = express.Router();

router.use(express.json({ limit: '256kb' }));
router.use(security.checkToken);

function findMessageByIdOrUuid(db, messageId) {
  return new Promise((resolve, reject) => {
    const raw = String(messageId ?? '').trim();
    if (!raw) return resolve(null);
    const isNumeric = /^\d+$/.test(raw);
    const handler = (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    };
    if (isNumeric) {
      tableMessage.getById(db, raw, handler);
    } else {
      tableMessage.getByUuid(db, raw, handler);
    }
  });
}

router.post('/decision', async (req, res, next) => {
  const db = req.database?.db;
  if (!db) return next(apiError.internal('database_unavailable'));

  const rawId = req.body?.messageId ?? req.body?.messageUuid ?? req.body?.id;
  const decision = String(req.body?.decision || '').toLowerCase();
  const reason = req.body?.reason ? String(req.body.reason) : null;
  const adminId = req.body?.adminId ? String(req.body.adminId) : (req.service?.sub || null);

  if (!rawId) {
    return next(apiError.badRequest('message_id_required'));
  }
  if (!['approved', 'rejected'].includes(decision)) {
    return next(apiError.badRequest('invalid_decision'));
  }
  if (decision === 'rejected' && (!reason || !reason.trim())) {
    return next(apiError.badRequest('reason_required'));
  }

  let message;
  try {
    message = await findMessageByIdOrUuid(db, rawId);
  } catch (err) {
    const apiErr = apiError.internal('db_error');
    apiErr.detail = err?.message || err;
    return next(apiErr);
  }
  if (!message) {
    return next(apiError.notFound('message_not_found'));
  }

  const status = decision === 'rejected'
    ? tableMessage.messageStatus.DISABLED
    : tableMessage.messageStatus.ENABLED;

  tableMessage.setManualModeration(
    db,
    message.uuid,
    decision,
    reason,
    Date.now(),
    adminId,
    status,
    (err) => {
      if (err) {
        return next(apiError.internal('db_error'));
      }
      res.status(200).json({ status: 200 });
    }
  );
});

module.exports = router;
