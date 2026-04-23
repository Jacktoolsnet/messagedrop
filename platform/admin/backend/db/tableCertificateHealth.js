const tableName = 'tableCertificateHealth';

function init(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      targetKey TEXT PRIMARY KEY NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT '',
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 443,
      origin TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'error',
      statusMessage TEXT DEFAULT NULL,
      authorizationError TEXT DEFAULT NULL,
      subject TEXT DEFAULT NULL,
      subjectAltName TEXT DEFAULT NULL,
      issuer TEXT DEFAULT NULL,
      validFrom INTEGER DEFAULT NULL,
      validTo INTEGER DEFAULT NULL,
      daysRemaining INTEGER DEFAULT NULL,
      lastCheckedAt INTEGER NOT NULL DEFAULT 0,
      updatedAt INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_certificate_health_status
      ON ${tableName}(status);
    CREATE INDEX IF NOT EXISTS idx_certificate_health_valid_to
      ON ${tableName}(validTo);
    CREATE INDEX IF NOT EXISTS idx_certificate_health_checked_at
      ON ${tableName}(lastCheckedAt DESC);
  `;

  db.exec(sql, (err) => {
    if (err) {
      throw err;
    }
  });
}

function normalizeRow(row) {
  if (!row || typeof row !== 'object') {
    return null;
  }

  return {
    targetKey: row.targetKey,
    label: row.label || '',
    source: row.source || '',
    host: row.host,
    port: Number(row.port ?? 443),
    origin: row.origin || '',
    status: row.status || 'error',
    statusMessage: row.statusMessage ?? null,
    authorizationError: row.authorizationError ?? null,
    subject: row.subject ?? null,
    subjectAltName: row.subjectAltName ?? null,
    issuer: row.issuer ?? null,
    validFrom: Number.isFinite(Number(row.validFrom)) ? Number(row.validFrom) : null,
    validTo: Number.isFinite(Number(row.validTo)) ? Number(row.validTo) : null,
    daysRemaining: Number.isFinite(Number(row.daysRemaining)) ? Number(row.daysRemaining) : null,
    lastCheckedAt: Number.isFinite(Number(row.lastCheckedAt)) ? Number(row.lastCheckedAt) : null,
    updatedAt: Number.isFinite(Number(row.updatedAt)) ? Number(row.updatedAt) : null
  };
}

function listAll(db, callback = () => {}) {
  const sql = `
    SELECT
      targetKey,
      label,
      source,
      host,
      port,
      origin,
      status,
      statusMessage,
      authorizationError,
      subject,
      subjectAltName,
      issuer,
      validFrom,
      validTo,
      daysRemaining,
      lastCheckedAt,
      updatedAt
    FROM ${tableName}
    ORDER BY
      CASE status
        WHEN 'error' THEN 0
        WHEN 'expired' THEN 1
        WHEN 'critical' THEN 2
        WHEN 'warning' THEN 3
        WHEN 'ok' THEN 4
        ELSE 5
      END ASC,
      CASE WHEN validTo IS NULL THEN 1 ELSE 0 END ASC,
      validTo ASC,
      host COLLATE NOCASE ASC,
      port ASC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      callback(err);
      return;
    }
    callback(null, Array.isArray(rows) ? rows.map(normalizeRow).filter(Boolean) : []);
  });
}

function upsert(db, payload, callback = () => {}) {
  const now = Number.isFinite(Number(payload?.updatedAt)) ? Number(payload.updatedAt) : Date.now();
  const lastCheckedAt = Number.isFinite(Number(payload?.lastCheckedAt)) ? Number(payload.lastCheckedAt) : now;
  const sql = `
    INSERT INTO ${tableName} (
      targetKey,
      label,
      source,
      host,
      port,
      origin,
      status,
      statusMessage,
      authorizationError,
      subject,
      subjectAltName,
      issuer,
      validFrom,
      validTo,
      daysRemaining,
      lastCheckedAt,
      updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(targetKey) DO UPDATE SET
      label = excluded.label,
      source = excluded.source,
      host = excluded.host,
      port = excluded.port,
      origin = excluded.origin,
      status = excluded.status,
      statusMessage = excluded.statusMessage,
      authorizationError = excluded.authorizationError,
      subject = excluded.subject,
      subjectAltName = excluded.subjectAltName,
      issuer = excluded.issuer,
      validFrom = excluded.validFrom,
      validTo = excluded.validTo,
      daysRemaining = excluded.daysRemaining,
      lastCheckedAt = excluded.lastCheckedAt,
      updatedAt = excluded.updatedAt
  `;

  const params = [
    String(payload?.targetKey || ''),
    String(payload?.label || ''),
    String(payload?.source || ''),
    String(payload?.host || ''),
    Number.isFinite(Number(payload?.port)) ? Number(payload.port) : 443,
    String(payload?.origin || ''),
    String(payload?.status || 'error'),
    payload?.statusMessage ?? null,
    payload?.authorizationError ?? null,
    payload?.subject ?? null,
    payload?.subjectAltName ?? null,
    payload?.issuer ?? null,
    Number.isFinite(Number(payload?.validFrom)) ? Number(payload.validFrom) : null,
    Number.isFinite(Number(payload?.validTo)) ? Number(payload.validTo) : null,
    Number.isFinite(Number(payload?.daysRemaining)) ? Number(payload.daysRemaining) : null,
    lastCheckedAt,
    now
  ];

  db.run(sql, params, (err) => {
    callback(err || null);
  });
}

function deleteExcept(db, targetKeys, callback = () => {}) {
  const normalizedKeys = Array.isArray(targetKeys)
    ? targetKeys.map((value) => String(value || '').trim()).filter(Boolean)
    : [];

  if (normalizedKeys.length === 0) {
    db.run(`DELETE FROM ${tableName}`, [], (err) => callback(err || null));
    return;
  }

  const placeholders = normalizedKeys.map(() => '?').join(', ');
  const sql = `DELETE FROM ${tableName} WHERE targetKey NOT IN (${placeholders})`;
  db.run(sql, normalizedKeys, (err) => callback(err || null));
}

module.exports = {
  tableName,
  init,
  listAll,
  upsert,
  deleteExcept
};
