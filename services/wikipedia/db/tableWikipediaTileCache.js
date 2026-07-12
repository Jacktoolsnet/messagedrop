const TABLE = 'tableWikipediaTileCache';

function init(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      cacheKey TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      fetchedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      lastAccessed TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_wikipedia_tile_last_accessed
      ON ${TABLE} (lastAccessed);
  `);
}

function get(db, cacheKey, callback) {
  db.get(`SELECT cacheKey, payload, fetchedAt, lastAccessed FROM ${TABLE} WHERE cacheKey = ?`, [cacheKey], (error, row) => {
    if (error || !row) return callback?.(error || null, row || null);
    db.run(`UPDATE ${TABLE} SET lastAccessed = CURRENT_TIMESTAMP WHERE cacheKey = ?`, [cacheKey]);
    callback?.(null, row);
  });
}

function set(db, cacheKey, payload, callback) {
  db.run(`
    INSERT INTO ${TABLE} (cacheKey, payload, fetchedAt, lastAccessed)
    VALUES (?, ?::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (cacheKey) DO UPDATE SET
      payload = EXCLUDED.payload,
      fetchedAt = CURRENT_TIMESTAMP,
      lastAccessed = CURRENT_TIMESTAMP
  `, [cacheKey, JSON.stringify(payload)], callback);
}

function cleanExpired(db, callback) {
  db.run(`DELETE FROM ${TABLE} WHERE lastAccessed < CURRENT_TIMESTAMP - INTERVAL '30 days'`, [], callback);
}

module.exports = { init, get, set, cleanExpired };
