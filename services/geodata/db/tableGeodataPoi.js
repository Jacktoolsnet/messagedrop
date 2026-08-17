const DATASET_TABLE = 'tableGeodataDataset';
const VERSION_TABLE = 'tableGeodataDatasetVersion';
const POI_TABLE = 'tableGeodataPoiVersion';
const JOB_TABLE = 'tableGeodataImportJob';
const EXPORT_TABLE = 'tableGeodataDatasetExport';

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
      sourceEtag TEXT,
      sourceContentLength BIGINT,
      importConfigHash TEXT,
      importConfig JSONB NOT NULL DEFAULT '{}'::jsonb,
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
    `CREATE TABLE IF NOT EXISTS ${EXPORT_TABLE} (
      versionId TEXT PRIMARY KEY REFERENCES ${VERSION_TABLE}(versionId) ON DELETE CASCADE,
      datasetId TEXT NOT NULL REFERENCES ${DATASET_TABLE}(datasetId) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('building', 'ready', 'failed')),
      format TEXT NOT NULL DEFAULT 'jsonl',
      formatVersion INTEGER NOT NULL DEFAULT 1,
      compression TEXT NOT NULL DEFAULT 'gzip',
      mediaType TEXT NOT NULL DEFAULT 'application/x-ndjson',
      relativePath TEXT,
      recordCount BIGINT,
      byteSize BIGINT,
      sha256 TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      error TEXT,
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      generatedAt TIMESTAMPTZ
    )`,
    `CREATE INDEX IF NOT EXISTS idx_geodata_version_dataset_status
      ON ${VERSION_TABLE} (datasetId, status, activatedAt DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_geodata_poi_version_bounds
      ON ${POI_TABLE} (versionId, latitude, longitude)`,
    `CREATE INDEX IF NOT EXISTS idx_geodata_poi_version_category_subtype
      ON ${POI_TABLE} (versionId, category, subtype)`,
    `CREATE INDEX IF NOT EXISTS idx_geodata_export_dataset_status
      ON ${EXPORT_TABLE} (datasetId, status, generatedAt DESC)`,
    `CREATE TABLE IF NOT EXISTS ${JOB_TABLE} (
      jobId TEXT PRIMARY KEY,
      datasetId TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
      stage TEXT NOT NULL DEFAULT 'queued',
      progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
      stepNumber INTEGER NOT NULL DEFAULT 0,
      stepCount INTEGER NOT NULL DEFAULT 0,
      stepProgress INTEGER,
      processedBytes BIGINT,
      totalBytes BIGINT,
      processedItems BIGINT,
      sourceTimestamp TIMESTAMPTZ,
      sourceEtag TEXT,
      sourceChanged BOOLEAN,
      stepStartedAt TIMESTAMPTZ,
      requestedConfig JSONB NOT NULL DEFAULT '{}'::jsonb,
      versionId TEXT,
      error TEXT,
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      startedAt TIMESTAMPTZ,
      completedAt TIMESTAMPTZ
    )`,
    `CREATE INDEX IF NOT EXISTS idx_geodata_import_job_dataset_created
      ON ${JOB_TABLE} (datasetId, createdAt DESC)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_geodata_import_job_one_active
      ON ${JOB_TABLE} (datasetId)
      WHERE status IN ('queued', 'running')`,
    `ALTER TABLE ${JOB_TABLE} ADD COLUMN IF NOT EXISTS stepNumber INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE ${JOB_TABLE} ADD COLUMN IF NOT EXISTS stepCount INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE ${JOB_TABLE} ADD COLUMN IF NOT EXISTS stepProgress INTEGER`,
    `ALTER TABLE ${JOB_TABLE} ADD COLUMN IF NOT EXISTS processedBytes BIGINT`,
    `ALTER TABLE ${JOB_TABLE} ADD COLUMN IF NOT EXISTS totalBytes BIGINT`,
    `ALTER TABLE ${JOB_TABLE} ADD COLUMN IF NOT EXISTS processedItems BIGINT`,
    `ALTER TABLE ${JOB_TABLE} ADD COLUMN IF NOT EXISTS stepStartedAt TIMESTAMPTZ`,
    `ALTER TABLE ${JOB_TABLE} ADD COLUMN IF NOT EXISTS sourceTimestamp TIMESTAMPTZ`,
    `ALTER TABLE ${JOB_TABLE} ADD COLUMN IF NOT EXISTS sourceEtag TEXT`,
    `ALTER TABLE ${JOB_TABLE} ADD COLUMN IF NOT EXISTS sourceChanged BOOLEAN`,
    `ALTER TABLE ${VERSION_TABLE} ADD COLUMN IF NOT EXISTS sourceEtag TEXT`,
    `ALTER TABLE ${VERSION_TABLE} ADD COLUMN IF NOT EXISTS sourceContentLength BIGINT`,
    `ALTER TABLE ${VERSION_TABLE} ADD COLUMN IF NOT EXISTS importConfigHash TEXT`,
    `ALTER TABLE ${VERSION_TABLE} ADD COLUMN IF NOT EXISTS importConfig JSONB NOT NULL DEFAULT '{}'::jsonb`
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
    WITH activeWebsites AS MATERIALIZED (
      SELECT NULLIF(BTRIM(p.payload #>> '{contact,website}'), '') AS websiteUrl
      FROM ${POI_TABLE} p
      JOIN ${VERSION_TABLE} pv ON pv.versionId = p.versionId AND pv.status = 'active'
      JOIN ${DATASET_TABLE} pd ON pd.activeVersionId = pv.versionId
      WHERE NULLIF(BTRIM(p.payload #>> '{contact,website}'), '') IS NOT NULL
    ), websiteCounts AS (
      SELECT COUNT(*)::integer AS websitePoiCount
      FROM activeWebsites
    ), datasetCounts AS (
      SELECT COUNT(*)::integer AS datasetCount, COALESCE(SUM(v.poiCount), 0)::integer AS poiCount,
        MAX(v.activatedAt) AS importedAt
      FROM ${DATASET_TABLE} d
      JOIN ${VERSION_TABLE} v ON v.versionId = d.activeVersionId AND v.status = 'active'
    )
    SELECT dc.datasetCount, dc.poiCount, dc.importedAt,
      pg_database_size(current_database())::bigint AS databaseBytes,
      wc.websitePoiCount
    FROM datasetCounts dc
    CROSS JOIN websiteCounts wc
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
    SELECT p.payload
    FROM ${POI_TABLE} p
    WHERE p.versionId = ?
      AND p.latitude BETWEEN ? AND ?
      AND p.longitude BETWEEN ? AND ?
      AND (${clauses.join(' OR ')})
    ORDER BY p.category, p.subtype, p.osmType, p.osmId
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
      stepNumber = 0, stepProgress = NULL, processedBytes = NULL, totalBytes = NULL,
      processedItems = NULL, stepStartedAt = CURRENT_TIMESTAMP,
      startedAt = CURRENT_TIMESTAMP, error = NULL
    WHERE jobId = ? AND status = 'queued'
  `, [jobId], callback);
}

function updateJobProgress(db, jobId, stage, progress, details, callback) {
  if (typeof details === 'function') {
    callback = details;
    details = {};
  }
  const normalizedProgress = Math.max(0, Math.min(99, Math.round(Number(progress) || 0)));
  const stepProgress = details?.stepProgress == null
    ? null
    : Math.max(0, Math.min(100, Math.round(Number(details.stepProgress) || 0)));
  const normalizedStage = String(stage || 'running').slice(0, 100);
  db.run(`
    UPDATE ${JOB_TABLE}
    SET stage = ?, progress = ?, stepNumber = ?, stepCount = ?, stepProgress = ?,
      processedBytes = ?, totalBytes = ?, processedItems = ?,
      stepStartedAt = CASE WHEN stage <> ? THEN CURRENT_TIMESTAMP ELSE COALESCE(stepStartedAt, CURRENT_TIMESTAMP) END
    WHERE jobId = ? AND status = 'running'
  `, [normalizedStage, normalizedProgress, Math.max(0, Number(details?.stepNumber) || 0),
    Math.max(0, Number(details?.stepCount) || 0), stepProgress,
    finiteOrNull(details?.processedBytes), finiteOrNull(details?.totalBytes), finiteOrNull(details?.processedItems),
    normalizedStage, jobId], callback);
}

function activeSource(db, datasetId, callback) {
  db.get(`
    SELECT v.versionId, v.sourceUrl, v.sourceTimestamp, v.sourceEtag,
      v.sourceContentLength, v.importConfigHash, v.activatedAt,
      e.status AS exportStatus
    FROM ${DATASET_TABLE} d
    JOIN ${VERSION_TABLE} v ON v.versionId = d.activeVersionId AND v.status = 'active'
    LEFT JOIN ${EXPORT_TABLE} e ON e.versionId = v.versionId
    WHERE d.datasetId = ?
  `, [datasetId], callback);
}

function updateJobSource(db, jobId, source, changed, callback) {
  db.run(`
    UPDATE ${JOB_TABLE}
    SET sourceTimestamp = ?, sourceEtag = ?, sourceChanged = ?
    WHERE jobId = ? AND status = 'running'
  `, [source?.lastModified || null, source?.etag || null, changed == null ? null : Boolean(changed), jobId], callback);
}

function completeUnchangedJob(db, jobId, versionId, callback) {
  db.run(`
    UPDATE ${JOB_TABLE}
    SET status = 'succeeded', stage = 'up_to_date', progress = 100, stepProgress = 100,
      stepNumber = stepCount, versionId = ?, sourceChanged = FALSE, completedAt = CURRENT_TIMESTAMP
    WHERE jobId = ? AND status = 'running'
  `, [versionId, jobId], callback);
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

function cleanupJobs(db, retentionDays, callback) {
  const days = Math.max(1, Number(retentionDays) || 90);
  db.run(`DELETE FROM ${JOB_TABLE}
    WHERE status IN ('succeeded', 'failed')
      AND completedAt < CURRENT_TIMESTAMP - (? * INTERVAL '1 day')`, [days], callback);
}

function findActiveJob(db, datasetId, callback) {
  db.get(`
    SELECT * FROM ${JOB_TABLE}
    WHERE datasetId = ? AND status IN ('queued', 'running')
    ORDER BY createdAt DESC LIMIT 1
  `, [datasetId], callback);
}

function findRunningJob(db, callback) {
  db.get(`SELECT * FROM ${JOB_TABLE} WHERE status = 'running' ORDER BY startedAt ASC LIMIT 1`, [], callback);
}

function findQueuedJob(db, callback) {
  db.get(`SELECT * FROM ${JOB_TABLE} WHERE status = 'queued' ORDER BY createdAt ASC LIMIT 1`, [], callback);
}

function failInterruptedJobs(db, callback) {
  db.run(`UPDATE ${JOB_TABLE} SET status = 'failed', stage = 'failed',
    error = 'Service restarted during import', completedAt = CURRENT_TIMESTAMP
    WHERE status = 'running'`, [], (error) => {
    if (error) return callback?.(error);
    db.run(`DELETE FROM ${VERSION_TABLE} WHERE status = 'importing'`, [], callback);
  });
}

async function stageVersion(db, { versionId, dataset, categories, subcategories = {} }) {
  await db.transaction(async (transaction) => {
    await run(transaction, `
      INSERT INTO ${DATASET_TABLE}
        (datasetId, south, west, north, east, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (datasetId) DO UPDATE SET south = EXCLUDED.south, west = EXCLUDED.west,
        north = EXCLUDED.north, east = EXCLUDED.east, updatedAt = CURRENT_TIMESTAMP
    `, [dataset.id, dataset.bounds.south, dataset.bounds.west, dataset.bounds.north, dataset.bounds.east]);
    await run(transaction, `
      INSERT INTO ${VERSION_TABLE}
        (versionId, datasetId, status, sourceUrl, sourceTimestamp, sourceEtag,
          sourceContentLength, importConfigHash, importConfig, categories, poiCount)
      VALUES (?, ?, 'importing', ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, 0)
    `, [versionId, dataset.id, dataset.sourceUrl, dataset.sourceTimestamp || null,
      dataset.sourceEtag || null,
      dataset.sourceContentLength == null ? null : finiteOrNull(dataset.sourceContentLength),
      dataset.importConfigHash || null,
      JSON.stringify({
        dataset: {
          id: dataset.id, label: dataset.label || dataset.id,
          continentCode: dataset.continentCode || null, continentLabel: dataset.continentLabel || null,
          countryCode: dataset.countryCode || null, countryLabel: dataset.countryLabel || null,
          countryCodes: dataset.countryCodes || (dataset.countryCode ? [dataset.countryCode] : []),
          regionCode: dataset.regionCode || null, level: dataset.level || null,
          bounds: dataset.bounds
        },
        categories,
        subcategories
      }),
      JSON.stringify(categories)]);
  });
}

function countPois(db, versionId, callback) {
  db.get(`SELECT COUNT(*)::bigint AS count FROM ${POI_TABLE} WHERE versionId = ?`, [versionId], callback);
}

function exportPoiBatch(db, versionId, afterType, afterId, limit, callback) {
  const safeLimit = Math.max(1, Math.min(10000, Number(limit) || 5000));
  db.all(`
    SELECT osmType, osmId, payload
    FROM ${POI_TABLE}
    WHERE versionId = ?
      AND (?::text IS NULL OR (osmType, osmId) > (?::text, ?::bigint))
    ORDER BY osmType, osmId
    LIMIT ?
  `, [versionId, afterType, afterType, afterId == null ? 0 : afterId, safeLimit], callback);
}

function beginExport(db, { versionId, datasetId }, callback) {
  db.run(`
    INSERT INTO ${EXPORT_TABLE} (versionId, datasetId, status)
    VALUES (?, ?, 'building')
    ON CONFLICT (versionId) DO UPDATE SET status = 'building', relativePath = NULL,
      recordCount = NULL, byteSize = NULL, sha256 = NULL, metadata = '{}'::jsonb,
      error = NULL, generatedAt = NULL
  `, [versionId, datasetId], callback);
}

function updateVersionImportConfig(db, versionId, importConfig, callback) {
  db.run(`UPDATE ${VERSION_TABLE} SET importConfig = ?::jsonb WHERE versionId = ?`,
    [JSON.stringify(importConfig || {}), versionId], callback);
}

function completeExport(db, value, callback) {
  db.run(`
    UPDATE ${EXPORT_TABLE}
    SET status = 'ready', relativePath = ?, recordCount = ?, byteSize = ?, sha256 = ?,
      metadata = ?::jsonb, error = NULL, generatedAt = CURRENT_TIMESTAMP
    WHERE versionId = ? AND status = 'building'
  `, [value.relativePath, value.recordCount, value.byteSize, value.sha256,
    JSON.stringify(value.metadata || {}), value.versionId], callback);
}

function failExport(db, versionId, error, callback) {
  db.run(`UPDATE ${EXPORT_TABLE} SET status = 'failed', error = ? WHERE versionId = ?`,
    [String(error || 'Export failed').slice(0, 4000), versionId], callback);
}

function getActiveExport(db, datasetId, callback) {
  db.get(`
    SELECT e.*, v.sourceUrl, v.sourceTimestamp, v.sourceEtag, v.importConfig,
      v.activatedAt, v.poiCount, d.south, d.west, d.north, d.east
    FROM ${DATASET_TABLE} d
    JOIN ${VERSION_TABLE} v ON v.versionId = d.activeVersionId AND v.status = 'active'
    JOIN ${EXPORT_TABLE} e ON e.versionId = v.versionId AND e.status = 'ready'
    WHERE d.datasetId = ?
  `, [datasetId], callback);
}

function getExport(db, datasetId, versionId, callback) {
  db.get(`
    SELECT e.*, v.sourceUrl, v.sourceTimestamp, v.sourceEtag, v.importConfig,
      v.activatedAt, v.poiCount
    FROM ${EXPORT_TABLE} e
    JOIN ${VERSION_TABLE} v ON v.versionId = e.versionId
    WHERE e.datasetId = ? AND e.versionId = ? AND e.status = 'ready'
      AND v.status IN ('active', 'retired')
  `, [datasetId, versionId], callback);
}

function listActiveExports(db, callback) {
  db.all(`
    SELECT e.*, v.sourceUrl, v.sourceTimestamp, v.sourceEtag, v.importConfig,
      v.activatedAt, v.poiCount
    FROM ${DATASET_TABLE} d
    JOIN ${VERSION_TABLE} v ON v.versionId = d.activeVersionId AND v.status = 'active'
    JOIN ${EXPORT_TABLE} e ON e.versionId = v.versionId AND e.status = 'ready'
    ORDER BY e.datasetId
  `, [], callback);
}

function listVersionIds(db, callback) {
  db.all(`SELECT versionId FROM ${VERSION_TABLE}`, [], callback);
}

function insertPoiBatch(db, versionId, pois) {
  if (!pois.length) return Promise.resolve();
  const params = [];
  const rows = pois.map((poi) => {
    params.push(versionId, poi.osmType, poi.osmId, poi.category, poi.subtype,
      poi.latitude, poi.longitude, JSON.stringify(poi));
    return '(?, ?, ?, ?, ?, ?, ?, ?::jsonb)';
  });
  return run(db, `INSERT INTO ${POI_TABLE}
    (versionId, osmType, osmId, category, subtype, latitude, longitude, payload)
    VALUES ${rows.join(',')} ON CONFLICT DO NOTHING`, params);
}

async function activateVersion(db, { jobId, versionId, datasetId, poiCount }) {
  await db.transaction(async (transaction) => {
    const readyExport = await get(transaction,
      `SELECT versionId, recordCount, relativePath, sha256 FROM ${EXPORT_TABLE}
        WHERE versionId = ? AND datasetId = ? AND status = 'ready'`,
      [versionId, datasetId]);
    if (!readyExport) throw new Error(`No ready ODbL export for version ${versionId}`);
    if (Number(readyExport.recordCount) !== Number(poiCount)
        || !readyExport.relativePath || !/^[a-f0-9]{64}$/u.test(String(readyExport.sha256 || ''))) {
      throw new Error(`Invalid ODbL export metadata for version ${versionId}`);
    }
    await run(transaction, `UPDATE ${VERSION_TABLE} SET status = 'retired'
      WHERE datasetId = ? AND status = 'active'`, [datasetId]);
    await run(transaction, `UPDATE ${VERSION_TABLE}
      SET status = 'active', activatedAt = CURRENT_TIMESTAMP, poiCount = ?
      WHERE versionId = ? AND status = 'importing'`, [poiCount, versionId]);
    await run(transaction, `UPDATE ${DATASET_TABLE} SET activeVersionId = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE datasetId = ?`, [versionId, datasetId]);
    await run(transaction, `UPDATE ${JOB_TABLE}
      SET status = 'succeeded', stage = 'completed', progress = 100, stepProgress = 100,
        stepNumber = stepCount, versionId = ?, completedAt = CURRENT_TIMESTAMP
      WHERE jobId = ? AND status = 'running'`, [versionId, jobId]);
  });
}

function discardVersion(db, versionId, callback) {
  db.run(`DELETE FROM ${VERSION_TABLE} WHERE versionId = ? AND status = 'importing'`, [versionId], callback);
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

function deleteDatasets(db, datasetIds, callback) {
  const ids = [...new Set((datasetIds || []).filter(Boolean))];
  if (!ids.length) return callback?.(null);
  db.run(`DELETE FROM ${DATASET_TABLE} WHERE datasetId = ANY(?::text[])`, [ids], callback);
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

function get(db, sql, params) {
  return new Promise((resolve, reject) => db.get(sql, params, (error, row) => {
    if (error) reject(error);
    else resolve(row);
  }));
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : null;
}

module.exports = {
  init,
  status,
  coveringDataset,
  nearby,
  createJob,
  startJob,
  updateJobProgress,
  activeSource,
  updateJobSource,
  completeUnchangedJob,
  failJob,
  getJob,
  listJobs,
  cleanupJobs,
  findActiveJob,
  findRunningJob,
  findQueuedJob,
  failInterruptedJobs,
  stageVersion,
  insertPoiBatch,
  countPois,
  exportPoiBatch,
  beginExport,
  updateVersionImportConfig,
  completeExport,
  failExport,
  getActiveExport,
  getExport,
  listActiveExports,
  listVersionIds,
  activateVersion,
  discardVersion,
  cleanupRetiredVersions,
  deleteDatasets
};
