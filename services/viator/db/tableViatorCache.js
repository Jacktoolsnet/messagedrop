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
      ${columnExpiresAt} TIMESTAMPTZ,
      ${columnLastUpdate} TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    );
  `;
  db.exec(sql);
};

const setCache = function (db, cacheKey, payload, status, headers, ttlSeconds, callback) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const sql = `
    INSERT INTO ${tableName}
    (${columnCacheKey}, ${columnPayload}, ${columnStatus}, ${columnHeaders}, ${columnExpiresAt}, ${columnLastUpdate})
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT (${columnCacheKey}) DO UPDATE SET
      ${columnPayload} = EXCLUDED.${columnPayload},
      ${columnStatus} = EXCLUDED.${columnStatus},
      ${columnHeaders} = EXCLUDED.${columnHeaders},
      ${columnExpiresAt} = EXCLUDED.${columnExpiresAt},
      ${columnLastUpdate} = CURRENT_TIMESTAMP;
  `;
  db.run(sql, [cacheKey, payload, status, headers, expiresAt], (err) => {
    if (callback) callback(err || null);
  });
};

const getCache = function (db, cacheKey, callback) {
  const sql = `
    SELECT * FROM ${tableName}
    WHERE ${columnCacheKey} = ?
      AND ${columnExpiresAt} > CURRENT_TIMESTAMP;
  `;
  db.get(sql, [cacheKey], (err, row) => {
    if (err) return callback(err);
    if (!row) return callback(null, null);
    return callback(null, row);
  });
};

const cleanExpired = function (db, callback) {
  const sql = `
    DELETE FROM ${tableName}
    WHERE ${columnExpiresAt} <= CURRENT_TIMESTAMP;
  `;
  db.run(sql, [], (err) => {
    if (callback) callback(err || null);
  });
};

module.exports = {
  init,
  setCache,
  getCache,
  cleanExpired
};
