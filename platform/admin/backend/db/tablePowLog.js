const tableName = 'tablePowLog';
const columnId = 'id';
const columnSource = 'source';
const columnScope = 'scope';
const columnPath = 'path';
const columnMethod = 'method';
const columnIp = 'ip';
const columnUserAgent = 'userAgent';
const columnReason = 'reason';
const columnDifficulty = 'difficulty';
const columnRequiredUntil = 'requiredUntil';
const columnCreatedAt = 'createdAt';

const init = function (db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columnId} TEXT PRIMARY KEY NOT NULL,
      ${columnSource} TEXT NOT NULL,
      ${columnScope} TEXT NOT NULL,
      ${columnPath} TEXT NOT NULL,
      ${columnMethod} TEXT NOT NULL,
      ${columnIp} TEXT,
      ${columnUserAgent} TEXT,
      ${columnReason} TEXT,
      ${columnDifficulty} INTEGER,
      ${columnRequiredUntil} INTEGER,
      ${columnCreatedAt} INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_${tableName}_createdAt ON ${tableName}(${columnCreatedAt});
  `;
  db.exec(sql, (err) => {
    if (err) throw err;
  });
};

const create = function (
  db,
  id,
  source,
  scope,
  path,
  method,
  ip,
  userAgent,
  reason,
  difficulty,
  requiredUntil,
  createdAt,
  callback
) {
  const sql = `
    INSERT INTO ${tableName} (
      ${columnId},
      ${columnSource},
      ${columnScope},
      ${columnPath},
      ${columnMethod},
      ${columnIp},
      ${columnUserAgent},
      ${columnReason},
      ${columnDifficulty},
      ${columnRequiredUntil},
      ${columnCreatedAt}
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    id,
    source,
    scope,
    path,
    method,
    ip,
    userAgent,
    reason,
    difficulty,
    requiredUntil,
    createdAt
  ];
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
