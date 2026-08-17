const tableName = 'tableGeodataImportDispatch';

function init(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      dispatchId TEXT PRIMARY KEY,
      serviceJobId TEXT,
      datasetId TEXT NOT NULL,
      triggerType TEXT NOT NULL,
      status TEXT NOT NULL,
      requestedConfig TEXT NOT NULL DEFAULT '{}',
      error TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS indexGeodataImportDispatchCreatedAt
      ON ${tableName}(createdAt DESC);
  `, (err) => { if (err) throw err; });
}

function create(db, value, callback = () => {}) {
  const now = Date.now();
  db.run(`INSERT INTO ${tableName}
    (dispatchId, serviceJobId, datasetId, triggerType, status, requestedConfig, error, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [value.dispatchId, value.serviceJobId || null,
    value.datasetId, value.triggerType, value.status, JSON.stringify(value.requestedConfig || {}),
    value.error || null, now, now], callback);
}

function list(db, limit, callback = () => {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  db.all(`SELECT * FROM ${tableName} ORDER BY createdAt DESC LIMIT ?`, [safeLimit], callback);
}

function cleanupOlderThan(db, timestamp, callback = () => {}) {
  // Dispatch rows are immutable hand-off records. The actual job lifecycle is
  // protected separately in the Geodata service database.
  db.run(`DELETE FROM ${tableName} WHERE createdAt < ?`, [timestamp], callback);
}

module.exports = { tableName, init, create, list, cleanupOlderThan };
