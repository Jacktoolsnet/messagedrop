const tls = require('node:tls');
const tableCertificateHealth = require('../db/tableCertificateHealth');

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_WARNING_DAYS = 30;
const DEFAULT_CRITICAL_DAYS = 14;

const URL_TARGETS = [
  { envKey: 'ORIGIN', label: 'Public frontend' },
  { envKey: 'ADMIN_ORIGIN', label: 'Admin frontend' },
  { envKey: 'BASE_URL', label: 'Public backend' },
  { envKey: 'ADMIN_BASE_URL', label: 'Admin backend' },
  { envKey: 'PUBLIC_STATUS_BASE_URL', label: 'Public status page' },
  { envKey: 'OPENMETEO_BASE_URL', label: 'OpenMeteo service' },
  { envKey: 'NOMINATIM_BASE_URL', label: 'Nominatim service' },
  { envKey: 'SOCKETIO_BASE_URL', label: 'Socket.IO service' },
  { envKey: 'VIATOR_BASE_URL', label: 'Viator service' },
  { envKey: 'STICKER_BASE_URL', label: 'Sticker service' }
];

const STATUS_RANK = {
  error: 0,
  expired: 1,
  critical: 2,
  warning: 3,
  ok: 4,
  none: 5
};

function asPositiveInt(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return fallback;
  }
  return Math.trunc(num);
}

function getWarningDays() {
  return asPositiveInt(process.env.CERT_MONITOR_WARNING_DAYS, DEFAULT_WARNING_DAYS);
}

function getCriticalDays() {
  const critical = asPositiveInt(process.env.CERT_MONITOR_CRITICAL_DAYS, DEFAULT_CRITICAL_DAYS);
  return Math.min(critical, getWarningDays());
}

function getTimeoutMs() {
  return asPositiveInt(process.env.CERT_MONITOR_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
}

function splitDistinct(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

function normalizeOrigin(host, port) {
  return `https://${host}${port === 443 ? '' : `:${port}`}`;
}

function toTargetKey(host, port) {
  return `${String(host || '').trim().toLowerCase()}:${Number(port || 443)}`;
}

function parseUrlTarget(rawValue, label, source) {
  if (typeof rawValue !== 'string' || !rawValue.trim()) {
    return null;
  }

  try {
    const url = new URL(rawValue.trim());
    if (url.protocol !== 'https:') {
      return null;
    }

    const host = url.hostname.trim().toLowerCase();
    if (!host) {
      return null;
    }

    const port = url.port ? Number(url.port) : 443;
    if (!Number.isFinite(port) || port <= 0) {
      return null;
    }

    return {
      targetKey: toTargetKey(host, port),
      host,
      port,
      origin: normalizeOrigin(host, port),
      labels: splitDistinct([label]),
      sources: splitDistinct([source])
    };
  } catch {
    return null;
  }
}

function splitNamedTarget(entry) {
  const trimmed = String(entry || '').trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes('|')) {
    const [label, ...rest] = trimmed.split('|');
    return {
      label: label?.trim() || null,
      targetText: rest.join('|').trim()
    };
  }

  const eqIndex = trimmed.indexOf('=');
  if (eqIndex > 0) {
    const left = trimmed.slice(0, eqIndex).trim();
    const right = trimmed.slice(eqIndex + 1).trim();
    if (right) {
      return { label: left || null, targetText: right };
    }
  }

  return { label: null, targetText: trimmed };
}

function parseManualTarget(rawValue, fallbackLabel) {
  const named = splitNamedTarget(rawValue);
  if (!named?.targetText) {
    return null;
  }

  const label = named.label || fallbackLabel || 'Manual target';
  const targetText = named.targetText;
  if (/^https?:\/\//i.test(targetText)) {
    return parseUrlTarget(targetText, label, 'CERT_MONITOR_DOMAINS');
  }

  const hostPortMatch = targetText.match(/^([^:\s/]+)(?::(\d+))?$/);
  if (!hostPortMatch) {
    return null;
  }

  const host = hostPortMatch[1]?.trim().toLowerCase();
  const port = hostPortMatch[2] ? Number(hostPortMatch[2]) : 443;
  if (!host || !Number.isFinite(port) || port <= 0) {
    return null;
  }

  return {
    targetKey: toTargetKey(host, port),
    host,
    port,
    origin: normalizeOrigin(host, port),
    labels: splitDistinct([label]),
    sources: ['CERT_MONITOR_DOMAINS']
  };
}

function mergeTarget(existing, incoming) {
  if (!existing) {
    return incoming;
  }

  existing.labels = splitDistinct([...(existing.labels || []), ...(incoming.labels || [])]);
  existing.sources = splitDistinct([...(existing.sources || []), ...(incoming.sources || [])]);
  return existing;
}

function resolveConfiguredTargets() {
  const targets = new Map();

  for (const target of URL_TARGETS) {
    const parsed = parseUrlTarget(process.env[target.envKey], target.label, target.envKey);
    if (!parsed) {
      continue;
    }
    targets.set(parsed.targetKey, mergeTarget(targets.get(parsed.targetKey), parsed));
  }

  const manualEntries = String(process.env.CERT_MONITOR_DOMAINS || '')
    .split(/[\n,;]/)
    .map((value) => value.trim())
    .filter(Boolean);

  for (const entry of manualEntries) {
    const parsed = parseManualTarget(entry, 'Certificate target');
    if (!parsed) {
      continue;
    }
    targets.set(parsed.targetKey, mergeTarget(targets.get(parsed.targetKey), parsed));
  }

  return Array.from(targets.values())
    .map((target) => ({
      targetKey: target.targetKey,
      host: target.host,
      port: target.port,
      origin: target.origin,
      label: target.labels?.join(', ') || target.origin,
      source: target.sources?.join(', ') || 'environment'
    }))
    .sort((a, b) => a.origin.localeCompare(b.origin));
}

function formatDistinguishedName(value) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const preferredOrder = ['CN', 'O', 'OU', 'L', 'ST', 'C'];
  const keys = Object.keys(value);
  const sortedKeys = [
    ...preferredOrder.filter((key) => Object.prototype.hasOwnProperty.call(value, key)),
    ...keys.filter((key) => !preferredOrder.includes(key))
  ];

  const parts = sortedKeys
    .map((key) => {
      const raw = value[key];
      const normalized = Array.isArray(raw) ? raw.join(', ') : raw;
      const text = typeof normalized === 'string' || typeof normalized === 'number'
        ? String(normalized).trim()
        : '';
      return text ? `${key}=${text}` : null;
    })
    .filter(Boolean);

  return parts.length > 0 ? parts.join(', ') : null;
}

function parseCertificateTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function calculateDaysRemaining(validTo, now) {
  if (!Number.isFinite(validTo)) {
    return null;
  }

  const diffMs = Number(validTo) - now;
  if (diffMs <= 0) {
    return Math.floor(diffMs / DAY_MS);
  }

  return Math.ceil(diffMs / DAY_MS);
}

function buildStatusMessage(status, { validTo, daysRemaining, errorMessage, authorizationError }) {
  if (status === 'error') {
    return errorMessage || authorizationError || 'TLS check failed.';
  }

  if (status === 'expired') {
    return validTo
      ? `Certificate expired on ${new Date(validTo).toISOString()}.`
      : 'Certificate has expired.';
  }

  if (status === 'critical') {
    return Number.isFinite(daysRemaining)
      ? `Certificate expires in ${daysRemaining} day(s).`
      : 'Certificate expires very soon.';
  }

  if (status === 'warning') {
    return Number.isFinite(daysRemaining)
      ? `Certificate expires in ${daysRemaining} day(s).`
      : 'Certificate expires soon.';
  }

  return validTo
    ? `Certificate is valid until ${new Date(validTo).toISOString()}.`
    : 'Certificate is valid.';
}

function determineStatus({ validTo, authorizationError, daysRemaining, warningDays, criticalDays }) {
  if (!Number.isFinite(validTo)) {
    return 'error';
  }

  if (authorizationError && String(authorizationError) === 'CERT_HAS_EXPIRED') {
    return 'expired';
  }

  if (Number(validTo) <= Date.now()) {
    return 'expired';
  }

  if (authorizationError) {
    return 'error';
  }

  if (Number.isFinite(daysRemaining) && Number(daysRemaining) <= criticalDays) {
    return 'critical';
  }

  if (Number.isFinite(daysRemaining) && Number(daysRemaining) <= warningDays) {
    return 'warning';
  }

  return 'ok';
}

function buildErrorRow(target, now, message) {
  return {
    targetKey: target.targetKey,
    label: target.label,
    source: target.source,
    host: target.host,
    port: target.port,
    origin: target.origin,
    status: 'error',
    statusMessage: message || 'TLS check failed.',
    authorizationError: null,
    subject: null,
    subjectAltName: null,
    issuer: null,
    validFrom: null,
    validTo: null,
    daysRemaining: null,
    lastCheckedAt: now,
    updatedAt: now
  };
}

function inspectCertificate(target, options = {}) {
  const timeoutMs = asPositiveInt(options.timeoutMs, getTimeoutMs());
  const warningDays = asPositiveInt(options.warningDays, getWarningDays());
  const criticalDays = Math.min(asPositiveInt(options.criticalDays, getCriticalDays()), warningDays);

  return new Promise((resolve) => {
    const now = Date.now();
    let settled = false;

    const finish = (payload) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(payload);
    };

    const socket = tls.connect({
      host: target.host,
      port: target.port,
      servername: target.host,
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2'
    }, () => {
      try {
        const certificate = socket.getPeerCertificate();
        const authorizationError = socket.authorizationError ? String(socket.authorizationError) : null;
        socket.end();

        if (!certificate || Object.keys(certificate).length === 0) {
          finish(buildErrorRow(target, now, 'No certificate was presented by the remote host.'));
          return;
        }

        const validFrom = parseCertificateTimestamp(certificate.valid_from);
        const validTo = parseCertificateTimestamp(certificate.valid_to);
        const daysRemaining = calculateDaysRemaining(validTo, now);
        const status = determineStatus({
          validTo,
          authorizationError,
          daysRemaining,
          warningDays,
          criticalDays
        });

        finish({
          targetKey: target.targetKey,
          label: target.label,
          source: target.source,
          host: target.host,
          port: target.port,
          origin: target.origin,
          status,
          statusMessage: buildStatusMessage(status, {
            validTo,
            daysRemaining,
            authorizationError,
            errorMessage: null
          }),
          authorizationError,
          subject: formatDistinguishedName(certificate.subject),
          subjectAltName: typeof certificate.subjectaltname === 'string' ? certificate.subjectaltname : null,
          issuer: formatDistinguishedName(certificate.issuer),
          validFrom,
          validTo,
          daysRemaining,
          lastCheckedAt: now,
          updatedAt: now
        });
      } catch (error) {
        finish(buildErrorRow(target, now, error?.message || 'TLS check failed.'));
      }
    });

    socket.setTimeout(timeoutMs, () => {
      socket.destroy(new Error(`TLS check timed out after ${timeoutMs}ms.`));
    });

    socket.on('error', (error) => {
      finish(buildErrorRow(target, now, error?.message || 'TLS check failed.'));
    });
  });
}

function listStoredRows(db) {
  return new Promise((resolve, reject) => {
    tableCertificateHealth.listAll(db, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows || []);
    });
  });
}

function upsertRow(db, row) {
  return new Promise((resolve, reject) => {
    tableCertificateHealth.upsert(db, row, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function deleteExcept(db, targetKeys) {
  return new Promise((resolve, reject) => {
    tableCertificateHealth.deleteExcept(db, targetKeys, (err) => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
}

function buildSummary(rows, configuredTargets) {
  const list = Array.isArray(rows) ? rows : [];
  const counts = {
    ok: 0,
    warning: 0,
    critical: 0,
    expired: 0,
    error: 0
  };

  let lastCheckedAt = null;
  let worstStatus = list.length > 0 ? 'ok' : 'none';

  for (const row of list) {
    if (counts[row.status] !== undefined) {
      counts[row.status] += 1;
    }

    if (Number.isFinite(Number(row.lastCheckedAt))) {
      const timestamp = Number(row.lastCheckedAt);
      lastCheckedAt = lastCheckedAt == null ? timestamp : Math.max(lastCheckedAt, timestamp);
    }

    if ((STATUS_RANK[row.status] ?? STATUS_RANK.none) < (STATUS_RANK[worstStatus] ?? STATUS_RANK.none)) {
      worstStatus = row.status;
    }
  }

  return {
    enabled: configuredTargets > 0,
    configuredTargets,
    total: list.length,
    ok: counts.ok,
    warning: counts.warning,
    critical: counts.critical,
    expired: counts.expired,
    error: counts.error,
    worstStatus,
    lastCheckedAt
  };
}

async function getCertificateHealthOverview(db, { logger, autoCheckIfEmpty = false } = {}) {
  const configuredTargets = resolveConfiguredTargets();
  const rows = await listStoredRows(db);

  if (autoCheckIfEmpty && configuredTargets.length > 0 && rows.length === 0) {
    return runCertificateHealthCheck({ db, logger, reason: 'lazy-initial-load' });
  }

  return {
    summary: buildSummary(rows, configuredTargets.length),
    targets: rows
  };
}

async function runCertificateHealthCheck({ db, logger, reason = 'manual' } = {}) {
  if (!db) {
    throw new Error('database_unavailable');
  }

  const targets = resolveConfiguredTargets();
  logger?.info?.('Certificate health check started', {
    reason,
    targets: targets.length
  });

  const results = [];
  for (const target of targets) {
    try {
      const row = await inspectCertificate(target);
      results.push(row);
      await upsertRow(db, row);
    } catch (error) {
      const fallback = buildErrorRow(target, Date.now(), error?.message || 'TLS check failed.');
      results.push(fallback);
      await upsertRow(db, fallback);
    }
  }

  await deleteExcept(db, results.map((row) => row.targetKey));

  const overview = {
    summary: buildSummary(results, targets.length),
    targets: results.slice().sort((a, b) => {
      const aRank = STATUS_RANK[a.status] ?? STATUS_RANK.none;
      const bRank = STATUS_RANK[b.status] ?? STATUS_RANK.none;
      if (aRank !== bRank) {
        return aRank - bRank;
      }
      return a.origin.localeCompare(b.origin);
    })
  };

  logger?.info?.('Certificate health check finished', {
    reason,
    targets: targets.length,
    worstStatus: overview.summary.worstStatus,
    ok: overview.summary.ok,
    warning: overview.summary.warning,
    critical: overview.summary.critical,
    expired: overview.summary.expired,
    error: overview.summary.error
  });

  return overview;
}

module.exports = {
  resolveConfiguredTargets,
  getCertificateHealthOverview,
  runCertificateHealthCheck
};
