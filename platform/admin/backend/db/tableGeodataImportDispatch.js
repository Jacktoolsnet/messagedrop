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
  db.run(`ALTER TABLE ${tableName} ADD COLUMN batchId TEXT`, [], (err) => {
    if (err && !String(err.message || '').includes('duplicate column name')) throw err;
  });
  db.run(`CREATE INDEX IF NOT EXISTS indexGeodataImportDispatchBatch ON ${tableName}(batchId)`);
}

function create(db, value, callback = () => {}) {
  const now = Date.now();
  db.run(`INSERT INTO ${tableName}
    (dispatchId, serviceJobId, datasetId, triggerType, status, requestedConfig, error, createdAt, updatedAt, batchId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [value.dispatchId, value.serviceJobId || null,
    value.datasetId, value.triggerType, value.status, JSON.stringify(value.requestedConfig || {}),
    value.error || null, now, now, value.batchId || null], callback);
}

function list(db, limit, callback = () => {}) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  db.all(`SELECT * FROM ${tableName} ORDER BY createdAt DESC LIMIT ?`, [safeLimit], callback);
}

function latestBatch(db, callback = () => {}) {
  db.all(`SELECT dispatchId AS dispatchId, serviceJobId AS serviceJobId,
      datasetId AS datasetId, batchId AS batchId, createdAt AS createdAt, error
    FROM ${tableName}
    WHERE batchId = (SELECT batchId FROM ${tableName}
      WHERE batchId IS NOT NULL ORDER BY createdAt DESC, dispatchId DESC LIMIT 1)
    ORDER BY createdAt ASC, dispatchId ASC`, [], callback);
}

function cleanupOlderThan(db, timestamp, callback = () => {}) {
  // The actual job lifecycle is protected separately in the Geodata service DB.
  db.run(`DELETE FROM ${tableName} WHERE createdAt < ?`, [timestamp], callback);
}

function findForRetry(db, jobId, callback) {
  db.get(`SELECT * FROM ${tableName} WHERE serviceJobId = ? OR dispatchId = ?
    ORDER BY createdAt DESC, dispatchId DESC LIMIT 1`, [jobId, jobId], callback);
}

function replaceJob(db, dispatchId, job, callback) {
  // Keep the country in its original run. The failed service job remains in
  // service history; only the run's pointer changes to the new attempt.
  db.run(`UPDATE ${tableName} SET serviceJobId = ?, status = ?, error = NULL, updatedAt = ?
    WHERE dispatchId = ?`, [job.jobId, job.status, Date.now(), dispatchId], callback);
}

module.exports = { tableName, init, create, list, latestBatch, cleanupOlderThan, findForRetry, replaceJob };
