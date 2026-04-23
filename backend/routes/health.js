const express = require('express');
const router = express.Router();
const tableMaintenance = require('../db/tableMaintenance');
const { getEncryptionPublicKey, getSigningPublicKey } = require('../utils/keyStore');

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

function isDatabaseConnected(database) {
  const db = database?.db;
  if (!db || typeof db.get !== 'function') {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    db.get('SELECT 1 AS ok', (err, row) => {
      if (err) {
        resolve(false);
        return;
      }
      resolve(Boolean(row?.ok ?? row));
    });
  });
}

function getMaintenanceState(database) {
  const db = database?.db;
  if (!db) {
    return Promise.resolve(formatMaintenance(null));
  }
  return new Promise((resolve) => {
    tableMaintenance.get(db, (_err, row) => {
      resolve(formatMaintenance(row));
    });
  });
}

function isKeyReady(getter) {
  try {
    return Boolean(getter());
  } catch {
    return false;
  }
}

router.get(
  '/',
  async (req, res) => {
    const [databaseOk, encryptionKeyOk, signingKeyOk, maintenance] = await Promise.all([
      isDatabaseConnected(req.database),
      Promise.resolve(isKeyReady(getEncryptionPublicKey)),
      Promise.resolve(isKeyReady(getSigningPublicKey)),
      getMaintenanceState(req.database)
    ]);

    const online = databaseOk && encryptionKeyOk && signingKeyOk;

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');

    return res.status(200).json({
      status: 200,
      online,
      maintenance,
      checks: {
        database: { ok: databaseOk },
        keyStore: {
          encryptionPublicKey: encryptionKeyOk,
          signingPublicKey: signingKeyOk
        }
      },
      serverTime: Date.now(),
      uptimeMs: Math.round(process.uptime() * 1000)
    });
  }
);

module.exports = router;
