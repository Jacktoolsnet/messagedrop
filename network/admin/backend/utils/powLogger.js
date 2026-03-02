const crypto = require('crypto');
const axios = require('axios');
const tablePowLog = require('../db/tablePowLog');

function safeText(value, maxLen) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLen);
}

function toNumber(value, fallback = null) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function getMakeConfig() {
  return {
    url: process.env.MAKE_PUSHBULLET_WEBHOOK_URL,
    apiKey: process.env.MAKE_API_KEY
  };
}

async function notifyPowEnabled(entry, logger) {
  const { url, apiKey } = getMakeConfig();
  if (!url || !apiKey) return;
  const title = 'Messagedrop PoW aktiviert';
  const text = [
    `Scope: ${entry.scope}`,
    `Path: ${entry.path}`,
    `Method: ${entry.method}`,
    `IP: ${entry.ip || 'unknown'}`,
    `UA: ${entry.userAgent ? entry.userAgent.slice(0, 160) : 'unknown'}`,
    `Reason: ${entry.reason || 'threshold_exceeded'}`,
    `Difficulty: ${entry.difficulty ?? 'n/a'}`,
    `Required until: ${entry.requiredUntil ? new Date(entry.requiredUntil).toISOString() : 'n/a'}`
  ].join('\n');

  try {
    await axios.post(url, { title, text }, {
      headers: { 'x-make-apikey': apiKey },
      timeout: 4000,
      validateStatus: () => true
    });
  } catch (err) {
    logger?.warn?.('PoW notify failed', { error: err?.message });
  }
}

function normalizePayload(payload) {
  return {
    source: safeText(payload?.source || 'admin-backend', 80),
    scope: safeText(payload?.scope || 'unknown', 120),
    path: safeText(payload?.path || '/', 200),
    method: safeText((payload?.method || 'POST').toUpperCase(), 12),
    ip: safeText(payload?.ip || '', 80),
    userAgent: safeText(payload?.userAgent || '', 240),
    reason: safeText(payload?.reason || 'threshold_exceeded', 120),
    difficulty: toNumber(payload?.difficulty, null),
    requiredUntil: toNumber(payload?.requiredUntil, null),
    createdAt: toNumber(payload?.createdAt, Date.now())
  };
}

function logPowEvent(db, payload, logger, { notify = true } = {}) {
  return new Promise((resolve, reject) => {
    const entry = normalizePayload(payload);
    const id = crypto.randomUUID();
    tablePowLog.create(
      db,
      id,
      entry.source,
      entry.scope,
      entry.path,
      entry.method,
      entry.ip,
      entry.userAgent,
      entry.reason,
      entry.difficulty,
      entry.requiredUntil,
      entry.createdAt,
      (err) => {
        if (err) {
          reject(err);
          return;
        }
        if (notify) {
          void notifyPowEnabled({ id, ...entry }, logger);
        }
        resolve({ id, ...entry });
      }
    );
  });
}

module.exports = {
  logPowEvent
};
