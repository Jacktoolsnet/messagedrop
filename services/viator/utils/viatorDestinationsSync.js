const axios = require('axios');
const { randomUUID } = require('node:crypto');
const OpenLocationCode = require('open-location-code-typescript');
const tableViatorDestinations = require('../db/tableViatorDestinations');

const DEFAULT_TIMEOUT_MS = 15000;
let syncInProgress = false;

function normalizeBaseUrl(base) {
  if (!base) return null;
  const trimmed = String(base).trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(withScheme);
    if (!parsed.hostname) {
      return null;
    }
  } catch {
    return null;
  }
  return withScheme;
}

function resolveTimeoutMs(rawValue, fallback) {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.round(parsed);
}

function buildApiClient() {
  const baseUrl = normalizeBaseUrl(process.env.VIATOR_API_BASE_URL);
  if (!baseUrl) {
    return { client: null, error: 'VIATOR_API_BASE_URL is missing or invalid' };
  }
  const apiKey = process.env.VIATOR_API_KEY;
  if (!apiKey) {
    return { client: null, error: 'VIATOR_API_KEY is missing' };
  }
  const client = axios.create({
    baseURL: baseUrl,
    timeout: resolveTimeoutMs(process.env.VIATOR_API_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    validateStatus: () => true,
    headers: {
      'content-type': 'application/json'
    }
  });
  return { client, error: null };
}

function normalizeDestination(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
    return null;
  }
  const center = entry.center && typeof entry.center === 'object' ? entry.center : null;
  const rawLat = center?.latitude;
  const rawLng = center?.longitude;
  const lat = Number.isFinite(rawLat) ? rawLat : Number(rawLat);
  const lng = Number.isFinite(rawLng) ? rawLng : Number(rawLng);
  const centerLat = Number.isFinite(lat) ? lat : null;
  const centerLng = Number.isFinite(lng) ? lng : null;
  let plusCode = null;
  if (Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
    try {
      const encoded = OpenLocationCode.encode(centerLat, centerLng, 10);
      plusCode = encoded || null;
    } catch {
      plusCode = null;
    }
  }
  return {
    destinationId: Number(entry.destinationId),
    name: entry.name ? String(entry.name) : null,
    type: entry.type ? String(entry.type) : null,
    parentDestinationId: entry.parentDestinationId !== undefined ? Number(entry.parentDestinationId) : null,
    lookupId: entry.lookupId ? String(entry.lookupId) : null,
    destinationUrl: entry.destinationUrl ? String(entry.destinationUrl) : null,
    defaultCurrencyCode: entry.defaultCurrencyCode ? String(entry.defaultCurrencyCode) : null,
    timeZone: entry.timeZone ? String(entry.timeZone) : null,
    iataCodes: Array.isArray(entry.iataCodes) ? JSON.stringify(entry.iataCodes) : null,
    countryCallingCode: entry.countryCallingCode ? String(entry.countryCallingCode) : null,
    languages: Array.isArray(entry.languages) ? JSON.stringify(entry.languages) : null,
    centerLat,
    centerLng,
    plusCode
  };
}

function formatBytes(bytes) {
  const num = Number(bytes);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  const mb = num / (1024 * 1024);
  if (mb >= 1) {
    return `${mb.toFixed(1)} MB`;
  }
  const kb = num / 1024;
  return `${kb.toFixed(1)} KB`;
}

function normalizeAcceptLanguage(rawValue) {
  if (!rawValue) return null;
  const first = String(rawValue).split(',')[0]?.split(';')[0]?.trim().replace('_', '-');
  if (!first) return null;
  return /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(first) ? first : null;
}

async function syncDestinations({ db, logger, force = false } = {}) {
  if (syncInProgress) {
    logger?.warn?.('Destination sync already running, skipping.');
    return { ok: false, skipped: true };
  }
  if (!db) {
    logger?.error?.('Destination sync skipped: database unavailable.');
    return { ok: false };
  }

  try {
    const existingCount = tableViatorDestinations.countAll(db);
    if (!force && existingCount > 0) {
      logger?.info?.(`Destination sync skipped (cache filled, ${existingCount} rows).`);
      return { ok: true, skipped: true, count: existingCount };
    }

    const { client, error } = buildApiClient();
    if (!client) {
      logger?.error?.('Destination sync failed', { error });
      return { ok: false, error };
    }

    syncInProgress = true;
    logger?.info?.('Destination sync started.');
    logger?.info?.('Destination sync download started.');
    const acceptLanguage = normalizeAcceptLanguage(process.env.VIATOR_ACCEPT_LANGUAGE) || 'en';
    const response = await client.get('/destinations', {
      headers: {
        'exp-api-key': process.env.VIATOR_API_KEY,
        Accept: 'application/json;version=2.0',
        'accept-language': acceptLanguage
      }
    });

    if (response.status < 200 || response.status >= 300) {
      logger?.error?.('Destination sync download failed', { status: response.status, data: response.data });
      return { ok: false, status: response.status };
    }

    const destinations = Array.isArray(response.data?.destinations)
      ? response.data.destinations
      : [];

    const contentLengthHeader = response.headers?.['content-length'];
    const headerBytes = contentLengthHeader ? Number(contentLengthHeader) : null;
    const payloadBytes = Number.isFinite(headerBytes)
      ? headerBytes
      : Buffer.byteLength(JSON.stringify(response.data ?? {}), 'utf8');
    const payloadLabel = formatBytes(payloadBytes);
    logger?.info?.(`Destination sync download completed (${payloadLabel || 'size unknown'}).`);

    if (destinations.length === 0) {
      logger?.error?.('Destination sync returned empty list.');
      return { ok: false, count: 0 };
    }

    const syncRunId = randomUUID();
    const stmt = tableViatorDestinations.prepareUpsert(db);

    logger?.info?.(`Destination import started (${destinations.length} rows).`);
    db.exec('BEGIN');
    let written = 0;
    for (const entry of destinations) {
      const normalized = normalizeDestination(entry);
      if (!normalized || !Number.isFinite(normalized.destinationId)) {
        continue;
      }
      stmt.run(
        normalized.destinationId,
        normalized.name,
        normalized.type,
        normalized.parentDestinationId,
        normalized.lookupId,
        normalized.destinationUrl,
        normalized.defaultCurrencyCode,
        normalized.timeZone,
        normalized.iataCodes,
        normalized.countryCallingCode,
        normalized.languages,
        normalized.centerLat,
        normalized.centerLng,
        normalized.plusCode,
        syncRunId
      );
      written += 1;
    }
    db.exec('COMMIT');

    const deleted = tableViatorDestinations.deleteNotRunId(db, syncRunId);
    logger?.info?.(`Destination cleanup completed (${deleted} rows removed).`);

    logger?.info?.(`Destination sync completed (${written} rows).`);
    return { ok: true, count: written };
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    logger?.error?.('Destination sync failed', { error: err?.message || err });
    return { ok: false, error: err?.message || err };
  } finally {
    syncInProgress = false;
  }
}

module.exports = {
  syncDestinations
};
