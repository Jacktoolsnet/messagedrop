// db/tableErrorLog.js
const tableName = 'tableErrorLog';
const columnId = 'id';
const columnSource = 'source';
const columnFile = 'file';
const columnMessage = 'message';
const columnDetail = 'detail';
const columnCreatedAt = 'createdAt';

/**
 * Initialize error log table.
 */
const init = function (db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columnId} TEXT PRIMARY KEY NOT NULL,
      ${columnSource} TEXT NOT NULL,
      ${columnFile} TEXT NOT NULL,
      ${columnMessage} TEXT NOT NULL,
      ${columnDetail} TEXT DEFAULT NULL,
      ${columnCreatedAt} INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_${tableName}_createdAt ON ${tableName}(${columnCreatedAt});
  `;
  db.exec(sql, (err) => {
    if (err) throw err;
  });

  db.all(`PRAGMA table_info(${tableName});`, (err, rows) => {
    if (err || !rows) {
      return;
    }
    const existing = new Set(rows.map((row) => row.name));
    if (!existing.has(columnDetail)) {
      db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnDetail} TEXT DEFAULT NULL;`);
    }
  });
};

/**
 * Insert new error log entry.
 */
const create = function (db, id, source, file, message, detail, createdAt, callback) {
  const sql = `
    INSERT INTO ${tableName} (
      ${columnId},
      ${columnSource},
      ${columnFile},
      ${columnMessage},
      ${columnDetail},
      ${columnCreatedAt}
    ) VALUES (?, ?, ?, ?, ?, ?)
  `;
  const params = [id, source, file, message, detail ?? null, createdAt];
  db.run(sql, params, function (err) {
    callback(err);
  });
};

const list = function (db, limit, offset, callback) {
  const lim = Number.isFinite(limit) ? Math.max(1, Math.min(500, limit)) : 100;
  const off = Number.isFinite(offset) ? Math.max(0, offset) : 0;
  const sql = `
    SELECT * FROM ${tableName}
    ORDER BY ${columnCreatedAt} DESC
    LIMIT ? OFFSET ?`;
  db.all(sql, [lim, off], (err, rows) => callback(err, rows || []));
};

const deleteById = function (db, id, callback) {
  const sql = `DELETE FROM ${tableName} WHERE ${columnId} = ?`;
  db.run(sql, [id], function (err) {
    callback(err, this?.changes > 0);
  });
};

const deleteAll = function (db, callback) {
  const sql = `DELETE FROM ${tableName}`;
  db.run(sql, function (err) {
    callback(err, this?.changes || 0);
  });
};

/**
 * Delete entries older than provided timestamp.
 */
const cleanupOlderThan = function (db, threshold, callback) {
  const sql = `DELETE FROM ${tableName} WHERE ${columnCreatedAt} < ?`;
  db.run(sql, [threshold], (err) => callback(err));
};

const countSince = function (db, sinceTs, callback) {
  const sql = `SELECT COUNT(*) AS count FROM ${tableName} WHERE ${columnCreatedAt} >= ?`;
  db.get(sql, [sinceTs], (err, row) => callback(err, row?.count || 0));
};

module.exports = {
  tableName,
  init,
  create,
  list,
  deleteById,
  deleteAll,
  cleanupOlderThan,
  countSince
};
