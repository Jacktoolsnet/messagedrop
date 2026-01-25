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
  db.run(sql);
};

const setCache = function (db, cacheKey, payload, status, headers, ttlSeconds, callback) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const sql = `
    INSERT OR REPLACE INTO ${tableName}
    (${columnCacheKey}, ${columnPayload}, ${columnStatus}, ${columnHeaders}, ${columnExpiresAt}, ${columnLastUpdate})
    VALUES (?, ?, ?, ?, ?, datetime('now'));
  `;
  db.run(sql, [cacheKey, payload, status, headers, expiresAt], callback);
};

const getCache = function (db, cacheKey, callback) {
  const sql = `
    SELECT * FROM ${tableName}
    WHERE ${columnCacheKey} = ?
      AND DATETIME(${columnExpiresAt}) > DATETIME('now');
  `;
  db.get(sql, [cacheKey], (err, row) => {
    if (err) return callback(err);
    if (!row) return callback(null, null);
    callback(null, row);
  });
};

const cleanExpired = function (db, callback) {
  const sql = `
    DELETE FROM ${tableName}
    WHERE DATETIME(${columnExpiresAt}) <= DATETIME('now');
  `;
  db.run(sql, callback);
};

module.exports = {
  init,
  setCache,
  getCache,
  cleanExpired
};
