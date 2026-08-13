const DATASET_TABLE = 'tableOverpassDataset';
const VERSION_TABLE = 'tableOverpassDatasetVersion';
const POI_TABLE = 'tableOverpassPoiVersion';
const JOB_TABLE = 'tableOverpassImportJob';

function init(db, callback) {
  runStatements(db, [
    `CREATE TABLE IF NOT EXISTS ${DATASET_TABLE} (
      datasetId TEXT PRIMARY KEY,
      south DOUBLE PRECISION NOT NULL,
      west DOUBLE PRECISION NOT NULL,
      north DOUBLE PRECISION NOT NULL,
      east DOUBLE PRECISION NOT NULL,
      activeVersionId TEXT,
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CHECK (south < north),
      CHECK (west < east)
    )`,
    `CREATE TABLE IF NOT EXISTS ${VERSION_TABLE} (
      versionId TEXT PRIMARY KEY,
      datasetId TEXT NOT NULL REFERENCES ${DATASET_TABLE}(datasetId) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('importing', 'active', 'retired', 'failed')),
      sourceUrl TEXT NOT NULL,
      sourceTimestamp TIMESTAMPTZ,
      categories JSONB NOT NULL DEFAULT '[]'::jsonb,
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      activatedAt TIMESTAMPTZ,
      poiCount INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS ${POI_TABLE} (
      versionId TEXT NOT NULL REFERENCES ${VERSION_TABLE}(versionId) ON DELETE CASCADE,
      osmType TEXT NOT NULL CHECK (osmType IN ('node', 'way', 'relation')),
      osmId BIGINT NOT NULL,
      category TEXT NOT NULL,
      subtype TEXT NOT NULL,
      latitude DOUBLE PRECISION NOT NULL,
      longitude DOUBLE PRECISION NOT NULL,
      payload JSONB NOT NULL,
      PRIMARY KEY (versionId, osmType, osmId)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_overpass_version_dataset_status
      ON ${VERSION_TABLE} (datasetId, status, activatedAt DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_overpass_poi_version_bounds
      ON ${POI_TABLE} (versionId, latitude, longitude)`,
    `CREATE INDEX IF NOT EXISTS idx_overpass_poi_version_category_subtype
      ON ${POI_TABLE} (versionId, category, subtype)`,
    `CREATE TABLE IF NOT EXISTS ${JOB_TABLE} (
      jobId TEXT PRIMARY KEY,
      datasetId TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
      stage TEXT NOT NULL DEFAULT 'queued',
      progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
      requestedConfig JSONB NOT NULL DEFAULT '{}'::jsonb,
      versionId TEXT,
      error TEXT,
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      startedAt TIMESTAMPTZ,
      completedAt TIMESTAMPTZ
    )`,
    `CREATE INDEX IF NOT EXISTS idx_overpass_import_job_dataset_created
      ON ${JOB_TABLE} (datasetId, createdAt DESC)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_overpass_import_job_one_active
      ON ${JOB_TABLE} (datasetId)
      WHERE status IN ('queued', 'running')`
  ], callback);
}

function coveringDataset(db, bounds, categories, callback) {
  db.get(`
    SELECT d.datasetId, d.south, d.west, d.north, d.east,
      v.versionId, v.sourceUrl, v.sourceTimestamp, v.activatedAt AS importedAt, v.poiCount
    FROM ${DATASET_TABLE} d
    JOIN ${VERSION_TABLE} v ON v.versionId = d.activeVersionId AND v.status = 'active'
    WHERE d.south <= ? AND d.west <= ? AND d.north >= ? AND d.east >= ?
      AND v.categories @> ?::jsonb
    ORDER BY ((d.north - d.south) * (d.east - d.west)) ASC, v.activatedAt DESC
    LIMIT 1
  `, [bounds.south, bounds.west, bounds.north, bounds.east, JSON.stringify(categories)], callback);
}

function status(db, callback) {
  db.get(`
    SELECT COUNT(*)::integer AS datasetCount, COALESCE(SUM(v.poiCount), 0)::integer AS poiCount,
      MAX(v.activatedAt) AS importedAt
    FROM ${DATASET_TABLE} d
    JOIN ${VERSION_TABLE} v ON v.versionId = d.activeVersionId AND v.status = 'active'
  `, [], callback);
}

function nearby(db, versionId, bounds, selections, limit, callback) {
  const clauses = [];
  const params = [versionId, bounds.south, bounds.north, bounds.west, bounds.east];
  for (const [category, subtypes] of Object.entries(selections)) {
    clauses.push('(category = ? AND subtype = ANY(?::text[]))');
    params.push(category, subtypes);
  }
  params.push(limit);
  db.all(`
    SELECT payload
    FROM ${POI_TABLE}
    WHERE versionId = ?
      AND latitude BETWEEN ? AND ?
      AND longitude BETWEEN ? AND ?
      AND (${clauses.join(' OR ')})
    ORDER BY category, subtype, osmType, osmId
    LIMIT ?
  `, params, callback);
}

function createJob(db, job, callback) {
  db.run(`
    INSERT INTO ${JOB_TABLE} (jobId, datasetId, status, requestedConfig)
    VALUES (?, ?, 'queued', ?::jsonb)
  `, [job.id, job.datasetId, JSON.stringify(job.requestedConfig || {})], callback);
}

function startJob(db, jobId, callback) {
  db.run(`
    UPDATE ${JOB_TABLE}
    SET status = 'running', stage = 'starting', progress = 1,
      startedAt = CURRENT_TIMESTAMP, error = NULL
    WHERE jobId = ? AND status = 'queued'
  `, [jobId], callback);
}

function updateJobProgress(db, jobId, stage, progress, callback) {
  const normalizedProgress = Math.max(0, Math.min(99, Math.round(Number(progress) || 0)));
  db.run(`
    UPDATE ${JOB_TABLE}
    SET stage = ?, progress = ?
    WHERE jobId = ? AND status = 'running'
  `, [String(stage || 'running').slice(0, 100), normalizedProgress, jobId], callback);
}

function failJob(db, jobId, error, callback) {
  db.run(`
    UPDATE ${JOB_TABLE}
    SET status = 'failed', stage = 'failed', error = ?, completedAt = CURRENT_TIMESTAMP
    WHERE jobId = ? AND status IN ('queued', 'running')
  `, [String(error || 'Import failed').slice(0, 4000), jobId], callback);
}

function getJob(db, jobId, callback) {
  db.get(`SELECT * FROM ${JOB_TABLE} WHERE jobId = ?`, [jobId], callback);
}

function listJobs(db, limit, callback) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  db.all(`SELECT * FROM ${JOB_TABLE} ORDER BY createdAt DESC LIMIT ?`, [safeLimit], callback);
}

function findActiveJob(db, datasetId, callback) {
  db.get(`
    SELECT * FROM ${JOB_TABLE}
    WHERE datasetId = ? AND status IN ('queued', 'running')
    ORDER BY createdAt DESC LIMIT 1
  `, [datasetId], callback);
}

async function publishVersion(db, { jobId, versionId, dataset, categories, pois }) {
  await db.transaction(async (transaction) => {
    await run(transaction, `
      INSERT INTO ${DATASET_TABLE}
        (datasetId, south, west, north, east, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (datasetId) DO UPDATE SET
        south = EXCLUDED.south,
        west = EXCLUDED.west,
        north = EXCLUDED.north,
        east = EXCLUDED.east,
        updatedAt = CURRENT_TIMESTAMP
    `, [
      dataset.id, dataset.bounds.south, dataset.bounds.west, dataset.bounds.north, dataset.bounds.east
    ]);
    await run(transaction, `
      INSERT INTO ${VERSION_TABLE}
        (versionId, datasetId, status, sourceUrl, sourceTimestamp, categories, poiCount)
      VALUES (?, ?, 'importing', ?, ?, ?::jsonb, 0)
    `, [versionId, dataset.id, dataset.sourceUrl, dataset.sourceTimestamp || null, JSON.stringify(categories)]);
    for (const poi of pois) {
      await run(transaction, `
        INSERT INTO ${POI_TABLE}
          (versionId, osmType, osmId, category, subtype, latitude, longitude, payload)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb)
      `, [
        versionId, poi.osmType, poi.osmId, poi.category, poi.subtype,
        poi.latitude, poi.longitude, JSON.stringify(poi)
      ]);
    }
    await run(transaction, `
      UPDATE ${VERSION_TABLE}
      SET status = 'retired'
      WHERE datasetId = ? AND status = 'active'
    `, [dataset.id]);
    await run(transaction, `
      UPDATE ${VERSION_TABLE}
      SET status = 'active', activatedAt = CURRENT_TIMESTAMP, poiCount = ?
      WHERE versionId = ? AND status = 'importing'
    `, [pois.length, versionId]);
    await run(transaction, `
      UPDATE ${DATASET_TABLE}
      SET activeVersionId = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE datasetId = ?
    `, [versionId, dataset.id]);
    await run(transaction, `
      UPDATE ${JOB_TABLE}
      SET status = 'succeeded', stage = 'completed', progress = 100,
        versionId = ?, completedAt = CURRENT_TIMESTAMP
      WHERE jobId = ? AND status = 'running'
    `, [versionId, jobId]);
  });
}

function cleanupRetiredVersions(db, datasetId, keepCount, callback) {
  const keep = Math.max(0, Number(keepCount) || 0);
  db.run(`
    DELETE FROM ${VERSION_TABLE}
    WHERE versionId IN (
      SELECT versionId FROM ${VERSION_TABLE}
      WHERE datasetId = ? AND status = 'retired'
      ORDER BY activatedAt DESC NULLS LAST, createdAt DESC
      OFFSET ?
    )
  `, [datasetId, keep], callback);
}

function runStatements(db, statements, callback) {
  let index = 0;
  const next = (error) => {
    if (error) return callback?.(error);
    if (index >= statements.length) return callback?.(null);
    db.run(statements[index++], [], next);
  };
  next();
}

function run(db, sql, params) {
  return new Promise((resolve, reject) => db.run(sql, params, (error) => {
    if (error) reject(error);
    else resolve();
  }));
}

module.exports = {
  init,
  status,
  coveringDataset,
  nearby,
  createJob,
  startJob,
  updateJobProgress,
  failJob,
  getJob,
  listJobs,
  findActiveJob,
  publishVersion,
  cleanupRetiredVersions
};
