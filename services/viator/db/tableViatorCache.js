const tableName = 'tableViatorCache';
const columnCacheKey = 'cacheKey';
const columnPayload = 'payload';
const columnStatus = 'status';
const columnHeaders = 'headers';
const columnExpiresAt = 'expiresAt';
const columnLastUpdate = 'lastUpdate';

const init = function (db) {
  const sql = `
    CREATE TABLE IF NOT EXISTS ${tableName} (
      ${columnCacheKey} TEXT PRIMARY KEY,
      ${columnPayload} TEXT,
      ${columnStatus} INTEGER,
      ${columnHeaders} TEXT,
      ${columnExpiresAt} DATETIME,
      ${columnLastUpdate} DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;
  db.exec(sql);
};

const setCache = function (db, cacheKey, payload, status, headers, ttlSeconds, callback) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const sql = `
    INSERT OR REPLACE INTO ${tableName}
    (${columnCacheKey}, ${columnPayload}, ${columnStatus}, ${columnHeaders}, ${columnExpiresAt}, ${columnLastUpdate})
    VALUES (?, ?, ?, ?, ?, datetime('now'));
  `;
  try {
    db.prepare(sql).run(cacheKey, payload, status, headers, expiresAt);
    if (callback) callback(null);
  } catch (err) {
    if (callback) callback(err);
  }
};

const getCache = function (db, cacheKey, callback) {
  const sql = `
    SELECT * FROM ${tableName}
    WHERE ${columnCacheKey} = ?
      AND DATETIME(${columnExpiresAt}) > DATETIME('now');
  `;
  try {
    const row = db.prepare(sql).get(cacheKey);
    if (!row) return callback(null, null);
    return callback(null, row);
  } catch (err) {
    return callback(err);
  }
};

const cleanExpired = function (db, callback) {
  const sql = `
    DELETE FROM ${tableName}
    WHERE DATETIME(${columnExpiresAt}) <= DATETIME('now');
  `;
  try {
    db.prepare(sql).run();
    if (callback) callback(null);
  } catch (err) {
    if (callback) callback(err);
  }
};

module.exports = {
  init,
  setCache,
  getCache,
  cleanExpired
};
