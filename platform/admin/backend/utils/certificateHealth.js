const tls = require('node:tls');
const tableCertificateHealth = require('../db/tableCertificateHealth');
const { sendMail } = require('./mailer');

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

let activeCheckPromise = null;

function asPositiveInt(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return fallback;
  }
  return Math.trunc(num);
}

function asBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
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

function shouldNotifyRecovery() {
  return asBool(process.env.CERT_MONITOR_NOTIFY_RECOVERY, true);
}

function getNotificationRecipient() {
  const candidates = [
    process.env.CERT_MONITOR_NOTIFY_EMAIL,
    process.env.ADMIN_ROOT_EMAIL,
    process.env.MAIL_ADDRESS,
    process.env.MAIL_USER
  ];

  const recipient = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
  return recipient ? recipient.trim() : null;
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

function determineStatus({ validTo, authorizationError, daysRemaining, warningDays, criticalDays, now }) {
  if (!Number.isFinite(validTo)) {
    return 'error';
  }

  if (authorizationError && String(authorizationError) === 'CERT_HAS_EXPIRED') {
    return 'expired';
  }

  if (Number(validTo) <= now) {
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
          criticalDays,
          now
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

function sortRows(rows) {
  return (Array.isArray(rows) ? rows.slice() : []).sort((a, b) => {
    const aRank = STATUS_RANK[a?.status] ?? STATUS_RANK.none;
    const bRank = STATUS_RANK[b?.status] ?? STATUS_RANK.none;
    if (aRank !== bRank) {
      return aRank - bRank;
    }
    return String(a?.origin || '').localeCompare(String(b?.origin || ''));
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

function formatStatusLabel(status) {
  switch (status) {
    case 'ok':
      return 'OK';
    case 'warning':
      return 'Warning';
    case 'critical':
      return 'Critical';
    case 'expired':
      return 'Expired';
    case 'error':
      return 'Error';
    default:
      return 'Unknown';
  }
}

function formatNotificationTimestamp(value) {
  return Number.isFinite(Number(value)) ? new Date(Number(value)).toISOString() : '—';
}

function formatNotificationDays(value) {
  if (!Number.isFinite(Number(value))) {
    return 'unknown';
  }

  const days = Number(value);
  if (days < 0) {
    return `expired ${Math.abs(days)} day(s) ago`;
  }
  if (days === 0) {
    return 'expires today';
  }
  if (days === 1) {
    return '1 day';
  }
  return `${days} day(s)`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function collectStatusChanges(previousRows, nextRows) {
  const previousByKey = new Map((Array.isArray(previousRows) ? previousRows : []).map((row) => [row.targetKey, row]));
  const changes = [];
  const notifyRecovery = shouldNotifyRecovery();

  for (const row of Array.isArray(nextRows) ? nextRows : []) {
    const previous = previousByKey.get(row.targetKey) || null;
    const previousStatus = previous?.status || null;
    const currentStatus = row.status;

    if (previousStatus === currentStatus) {
      continue;
    }

    if (currentStatus === 'ok') {
      if (!previousStatus || previousStatus === 'ok' || !notifyRecovery) {
        continue;
      }

      changes.push({
        type: 'recovery',
        previous,
        current: row
      });
      continue;
    }

    if (!previousStatus || previousStatus !== currentStatus) {
      changes.push({
        type: 'alert',
        previous,
        current: row
      });
    }
  }

  return changes;
}

function buildNotificationSubject(changes) {
  const alertCount = changes.filter((change) => change.type === 'alert').length;
  const recoveryCount = changes.filter((change) => change.type === 'recovery').length;
  const parts = [];

  if (alertCount > 0) {
    parts.push(`${alertCount} alert${alertCount === 1 ? '' : 's'}`);
  }
  if (recoveryCount > 0) {
    parts.push(`${recoveryCount} recover${recoveryCount === 1 ? 'y' : 'ies'}`);
  }

  return `[MessageDrop] Certificate monitor: ${parts.join(', ') || 'status update'}`;
}

function buildNotificationText(changes, reason) {
  const lines = [
    'MessageDrop certificate monitor detected status changes.',
    `Check reason: ${reason}`,
    `Detected at: ${new Date().toISOString()}`,
    ''
  ];

  const alerts = changes.filter((change) => change.type === 'alert');
  const recoveries = changes.filter((change) => change.type === 'recovery');

  if (alerts.length > 0) {
    lines.push('Alerts:');
    for (const change of alerts) {
      const previousLabel = change.previous ? formatStatusLabel(change.previous.status) : 'Not monitored before';
      lines.push(`- ${change.current.origin} (${change.current.label})`);
      lines.push(`  Previous: ${previousLabel}`);
      lines.push(`  Current: ${formatStatusLabel(change.current.status)}`);
      lines.push(`  Message: ${change.current.statusMessage || '—'}`);
      lines.push(`  Valid until: ${formatNotificationTimestamp(change.current.validTo)}`);
      lines.push(`  Days remaining: ${formatNotificationDays(change.current.daysRemaining)}`);
      lines.push(`  Checked at: ${formatNotificationTimestamp(change.current.lastCheckedAt)}`);
      lines.push('');
    }
  }

  if (recoveries.length > 0) {
    lines.push('Recoveries:');
    for (const change of recoveries) {
      lines.push(`- ${change.current.origin} (${change.current.label})`);
      lines.push(`  Previous: ${formatStatusLabel(change.previous?.status)}`);
      lines.push(`  Current: ${formatStatusLabel(change.current.status)}`);
      lines.push(`  Message: ${change.current.statusMessage || '—'}`);
      lines.push(`  Valid until: ${formatNotificationTimestamp(change.current.validTo)}`);
      lines.push(`  Days remaining: ${formatNotificationDays(change.current.daysRemaining)}`);
      lines.push(`  Checked at: ${formatNotificationTimestamp(change.current.lastCheckedAt)}`);
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}

function renderNotificationItems(changes) {
  return changes.map((change) => {
    const previousLabel = change.previous ? formatStatusLabel(change.previous.status) : 'Not monitored before';
    return `
      <li style="margin-bottom:16px;">
        <div style="font-weight:700;">${escapeHtml(change.current.origin)}</div>
        <div style="color:#475569; margin-top:4px;">${escapeHtml(change.current.label || 'Certificate target')}</div>
        <div style="margin-top:8px;"><strong>Previous:</strong> ${escapeHtml(previousLabel)}</div>
        <div><strong>Current:</strong> ${escapeHtml(formatStatusLabel(change.current.status))}</div>
        <div><strong>Message:</strong> ${escapeHtml(change.current.statusMessage || '—')}</div>
        <div><strong>Valid until:</strong> ${escapeHtml(formatNotificationTimestamp(change.current.validTo))}</div>
        <div><strong>Days remaining:</strong> ${escapeHtml(formatNotificationDays(change.current.daysRemaining))}</div>
        <div><strong>Checked at:</strong> ${escapeHtml(formatNotificationTimestamp(change.current.lastCheckedAt))}</div>
      </li>
    `;
  }).join('');
}

function buildNotificationHtml(changes, reason) {
  const alerts = changes.filter((change) => change.type === 'alert');
  const recoveries = changes.filter((change) => change.type === 'recovery');
  const sections = [];

  if (alerts.length > 0) {
    sections.push(`
      <h2 style="font-size:18px; margin:20px 0 10px;">Alerts</h2>
      <ul style="padding-left:20px;">${renderNotificationItems(alerts)}</ul>
    `);
  }

  if (recoveries.length > 0) {
    sections.push(`
      <h2 style="font-size:18px; margin:20px 0 10px;">Recoveries</h2>
      <ul style="padding-left:20px;">${renderNotificationItems(recoveries)}</ul>
    `);
  }

  return `
    <div style="font-family:Arial,Helvetica,sans-serif; color:#0f172a; line-height:1.5;">
      <h1 style="font-size:22px; margin:0 0 12px;">MessageDrop certificate monitor</h1>
      <p style="margin:0 0 6px;">Status changes were detected during the latest certificate check.</p>
      <p style="margin:0 0 6px;"><strong>Check reason:</strong> ${escapeHtml(reason)}</p>
      <p style="margin:0 0 20px;"><strong>Detected at:</strong> ${escapeHtml(new Date().toISOString())}</p>
      ${sections.join('')}
    </div>
  `.trim();
}

async function sendStatusChangeNotifications(changes, { logger, reason }) {
  if (!Array.isArray(changes) || changes.length === 0) {
    return false;
  }

  const recipient = getNotificationRecipient();
  if (!recipient) {
    logger?.info?.('Certificate health changes detected, but no notification recipient is configured.', {
      changes: changes.length,
      reason
    });
    return false;
  }

  const subject = buildNotificationSubject(changes);
  const text = buildNotificationText(changes, reason);
  const html = buildNotificationHtml(changes, reason);
  const result = await sendMail({
    to: recipient,
    subject,
    text,
    html,
    logger
  });

  if (result?.success) {
    logger?.info?.('Certificate health notification sent', {
      recipient,
      changes: changes.length,
      reason
    });
    return true;
  }

  logger?.warn?.('Certificate health notification could not be sent', {
    recipient,
    changes: changes.length,
    reason
  });
  return false;
}

async function getCertificateHealthOverview(db, { logger, autoCheckIfEmpty = false } = {}) {
  const configuredTargets = resolveConfiguredTargets();
  const rows = await listStoredRows(db);

  if (autoCheckIfEmpty && configuredTargets.length > 0 && rows.length === 0) {
    return runCertificateHealthCheck({ db, logger, reason: 'lazy-initial-load' });
  }

  return {
    summary: buildSummary(rows, configuredTargets.length),
    targets: sortRows(rows)
  };
}

async function runCertificateHealthCheckInternal({ db, logger, reason = 'manual' } = {}) {
  if (!db) {
    throw new Error('database_unavailable');
  }

  const targets = resolveConfiguredTargets();
  const previousRows = await listStoredRows(db);

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

  const sortedResults = sortRows(results);
  const statusChanges = collectStatusChanges(previousRows, sortedResults);
  if (statusChanges.length > 0) {
    try {
      await sendStatusChangeNotifications(statusChanges, { logger, reason });
    } catch (error) {
      logger?.warn?.('Certificate health notification failed', {
        error: error?.message || error,
        changes: statusChanges.length,
        reason
      });
    }
  }

  const overview = {
    summary: buildSummary(sortedResults, targets.length),
    targets: sortedResults
  };

  logger?.info?.('Certificate health check finished', {
    reason,
    targets: targets.length,
    worstStatus: overview.summary.worstStatus,
    ok: overview.summary.ok,
    warning: overview.summary.warning,
    critical: overview.summary.critical,
    expired: overview.summary.expired,
    error: overview.summary.error,
    notifications: statusChanges.length
  });

  return overview;
}

async function runCertificateHealthCheck(options = {}) {
  if (activeCheckPromise) {
    options?.logger?.info?.('Certificate health check already running; reusing active run.', {
      reason: options?.reason || 'manual'
    });
    return activeCheckPromise;
  }

  activeCheckPromise = runCertificateHealthCheckInternal(options)
    .finally(() => {
      activeCheckPromise = null;
    });

  return activeCheckPromise;
}

module.exports = {
  resolveConfiguredTargets,
  getCertificateHealthOverview,
  runCertificateHealthCheck
};
