const tableMaintenance = require('../db/tableMaintenance');
const { verifyServiceJwt } = require('../utils/serviceJwt');

const DEFAULT_AUDIENCE = process.env.SERVICE_JWT_AUDIENCE || 'service.backend';

function normalizeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function normalizeText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function formatMaintenance(row) {
  if (!row) return null;
  return {
    enabled: Number(row.enabled) === 1,
    startsAt: normalizeNumber(row.startsAt),
    endsAt: normalizeNumber(row.endsAt),
    reason: normalizeText(row.reason),
    reasonEn: normalizeText(row.reasonEn),
    reasonEs: normalizeText(row.reasonEs),
    reasonFr: normalizeText(row.reasonFr),
    updatedAt: normalizeNumber(row.updatedAt)
  };
}

function isServiceRequest(req) {
  if (!req.token) return false;
  try {
    verifyServiceJwt(req.token, { audience: DEFAULT_AUDIENCE });
    return true;
  } catch {
    return false;
  }
}

module.exports = function maintenance() {
  return function (req, res, next) {
    const db = req.database?.db;
    if (!db) {
      return next();
    }
    if (isServiceRequest(req)) {
      return next();
    }
    tableMaintenance.get(db, (err, row) => {
      if (err) {
        req.logger?.error?.('maintenance lookup failed', { error: err?.message || err });
        return next();
      }
      const isEnabled = row && Number(row.enabled) === 1;
      if (!isEnabled) {
        return next();
      }
      const maintenanceData = formatMaintenance(row);
      return res.status(503).json({
        errorCode: 'MAINTENANCE',
        message: 'Im Wartungsmodus',
        error: 'Im Wartungsmodus',
        maintenance: maintenanceData
      });
    });
  };
};
