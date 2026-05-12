const tableName = 'tableModerationVoluntaryReview';

const columns = {
  messageUuid: 'messageUuid',
  decision: 'decision',
  reviewedAt: 'reviewedAt',
  reviewedBy: 'reviewedBy'
};

function init(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columns.messageUuid} TEXT PRIMARY KEY NOT NULL,
      ${columns.decision} TEXT NOT NULL,
      ${columns.reviewedAt} INTEGER NOT NULL,
      ${columns.reviewedBy} TEXT DEFAULT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_moderation_voluntary_reviewed_at
      ON ${tableName}(${columns.reviewedAt} DESC);
  `;
  db.exec(sql, (err) => {
    if (err) {
      throw err;
    }
  });
}

function listReviewedUuids(db, uuids, callback = () => {}) {
  const normalizedUuids = Array.from(new Set(
    (Array.isArray(uuids) ? uuids : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
  ));
  if (normalizedUuids.length === 0) {
    callback(null, []);
    return;
  }

  const placeholders = normalizedUuids.map(() => '?').join(', ');
  db.all(
    `SELECT ${columns.messageUuid} FROM ${tableName} WHERE ${columns.messageUuid} IN (${placeholders})`,
    normalizedUuids,
    (err, rows) => callback(err || null, (rows || []).map((row) => row?.messageUuid).filter(Boolean))
  );
}

function upsert(db, payload, callback = () => {}) {
  const messageUuid = String(payload?.messageUuid || '').trim();
  const decision = String(payload?.decision || '').trim().toLowerCase();
  const reviewedAt = Number.isFinite(Number(payload?.reviewedAt)) ? Number(payload.reviewedAt) : Date.now();
  const reviewedBy = typeof payload?.reviewedBy === 'string' && payload.reviewedBy.trim()
    ? payload.reviewedBy.trim()
    : null;

  if (!messageUuid || !decision) {
    callback(new Error('messageUuid and decision are required'));
    return;
  }

  const sql = `
    INSERT INTO ${tableName} (${columns.messageUuid}, ${columns.decision}, ${columns.reviewedAt}, ${columns.reviewedBy})
    VALUES (?, ?, ?, ?)
    ON CONFLICT(${columns.messageUuid}) DO UPDATE SET
      ${columns.decision} = excluded.${columns.decision},
      ${columns.reviewedAt} = excluded.${columns.reviewedAt},
      ${columns.reviewedBy} = excluded.${columns.reviewedBy}
  `;

  db.run(sql, [messageUuid, decision, reviewedAt, reviewedBy], (err) => {
    callback(err || null, { messageUuid, decision, reviewedAt, reviewedBy });
  });
}

module.exports = {
  tableName,
  columns,
  init,
  listReviewedUuids,
  upsert
};
