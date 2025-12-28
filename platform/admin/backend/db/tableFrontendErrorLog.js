// db/tableFrontendErrorLog.js
const tableName = 'tableFrontendErrorLog';
const columnId = 'id';
const columnClient = 'client';
const columnEvent = 'event';
const columnSeverity = 'severity';
const columnFeature = 'feature';
const columnPath = 'path';
const columnStatus = 'status';
const columnErrorName = 'errorName';
const columnErrorMessage = 'errorMessage';
const columnStack = 'stack';
const columnSource = 'source';
const columnLine = 'line';
const columnColumn = 'column';
const columnErrorCode = 'errorCode';
const columnAppVersion = 'appVersion';
const columnEnvironment = 'environment';
const columnCreatedAt = 'createdAt';

/**
 * Initialize frontend error log table.
 */
const init = function (db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columnId} TEXT PRIMARY KEY NOT NULL,
      ${columnClient} TEXT NOT NULL,
      ${columnEvent} TEXT NOT NULL,
      ${columnSeverity} TEXT NOT NULL,
      ${columnFeature} TEXT,
      ${columnPath} TEXT,
      ${columnStatus} INTEGER,
      ${columnErrorName} TEXT,
      ${columnErrorMessage} TEXT,
      ${columnStack} TEXT,
      ${columnSource} TEXT,
      ${columnLine} INTEGER,
      ${columnColumn} INTEGER,
      ${columnErrorCode} TEXT,
      ${columnAppVersion} TEXT,
      ${columnEnvironment} TEXT,
      ${columnCreatedAt} INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_${tableName}_createdAt ON ${tableName}(${columnCreatedAt});
  `;
  db.exec(sql, (err) => {
    if (err) throw err;
  });
};

/**
 * Insert new frontend error log entry.
 */
const create = function (
  db,
  id,
  client,
  event,
  severity,
  feature,
  path,
  status,
  errorName,
  errorMessage,
  stack,
  source,
  line,
  column,
  errorCode,
  appVersion,
  environment,
  createdAt,
  callback
) {
  const sql = `
    INSERT INTO ${tableName} (
      ${columnId},
      ${columnClient},
      ${columnEvent},
      ${columnSeverity},
      ${columnFeature},
      ${columnPath},
      ${columnStatus},
      ${columnErrorName},
      ${columnErrorMessage},
      ${columnStack},
      ${columnSource},
      ${columnLine},
      ${columnColumn},
      ${columnErrorCode},
      ${columnAppVersion},
      ${columnEnvironment},
      ${columnCreatedAt}
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    id,
    client,
    event,
    severity,
    feature,
    path,
    status,
    errorName,
    errorMessage,
    stack,
    source,
    line,
    column,
    errorCode,
    appVersion,
    environment,
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
  cleanupOlderThan,
  countSince
};
