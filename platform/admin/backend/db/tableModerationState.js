const tableName = 'tableModerationState';

const columns = {
  key: 'stateKey',
  lastSeenAt: 'lastSeenAt',
  updatedAt: 'updatedAt',
  updatedBy: 'updatedBy'
};

const keys = {
  VOLUNTARY: 'voluntary'
};

function init(db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columns.key} TEXT PRIMARY KEY NOT NULL,
      ${columns.lastSeenAt} INTEGER NOT NULL DEFAULT 0,
      ${columns.updatedAt} INTEGER NOT NULL DEFAULT 0,
      ${columns.updatedBy} TEXT DEFAULT NULL
    );
    INSERT INTO ${tableName} (${columns.key}, ${columns.lastSeenAt}, ${columns.updatedAt}, ${columns.updatedBy})
    VALUES ('${keys.VOLUNTARY}', 0, 0, NULL)
    ON CONFLICT(${columns.key}) DO NOTHING;
  `;
  db.exec(sql, (err) => {
    if (err) {
      throw err;
    }
  });
}

function get(db, key, callback = () => {}) {
  db.get(
    `SELECT ${columns.key}, ${columns.lastSeenAt}, ${columns.updatedAt}, ${columns.updatedBy}
     FROM ${tableName}
     WHERE ${columns.key} = ?
     LIMIT 1`,
    [key],
    (err, row) => callback(err || null, row || {
      stateKey: key,
      lastSeenAt: 0,
      updatedAt: 0,
      updatedBy: null
    })
  );
}

function upsert(db, key, payload, callback = () => {}) {
  const lastSeenAt = Number.isFinite(Number(payload?.lastSeenAt)) ? Math.max(0, Number(payload.lastSeenAt)) : 0;
  const updatedAt = Number.isFinite(Number(payload?.updatedAt)) ? Number(payload.updatedAt) : Date.now();
  const updatedBy = typeof payload?.updatedBy === 'string' && payload.updatedBy.trim()
    ? payload.updatedBy.trim()
    : null;
  const sql = `
    INSERT INTO ${tableName} (${columns.key}, ${columns.lastSeenAt}, ${columns.updatedAt}, ${columns.updatedBy})
    VALUES (?, ?, ?, ?)
    ON CONFLICT(${columns.key}) DO UPDATE SET
      ${columns.lastSeenAt} = excluded.${columns.lastSeenAt},
      ${columns.updatedAt} = excluded.${columns.updatedAt},
      ${columns.updatedBy} = excluded.${columns.updatedBy}
  `;

  db.run(sql, [key, lastSeenAt, updatedAt, updatedBy], (err) => {
    if (err) {
      return callback(err);
    }
    callback(null, { stateKey: key, lastSeenAt, updatedAt, updatedBy });
  });
}

module.exports = {
  tableName,
  columns,
  keys,
  init,
  get,
  upsert
};
