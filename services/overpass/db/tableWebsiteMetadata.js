const METADATA_TABLE = 'tableOverpassWebsiteMetadata';
const REFERENCE_TABLE = 'tableOverpassWebsiteReference';
const JOB_TABLE = 'tableOverpassMetadataJob';

function init(db, callback) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${METADATA_TABLE} (
      websiteUrl TEXT PRIMARY KEY,
      metadata JSONB,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fetching', 'succeeded', 'failed')),
      attemptCount INTEGER NOT NULL DEFAULT 0,
      fetchedAt TIMESTAMPTZ,
      lastAttemptAt TIMESTAMPTZ,
      nextAttemptAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      lastError TEXT,
      outcome TEXT,
      errorCode TEXT,
      httpStatus INTEGER,
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_overpass_website_metadata_due
      ON ${METADATA_TABLE} (nextAttemptAt, fetchedAt);
    CREATE TABLE IF NOT EXISTS ${REFERENCE_TABLE} (
      websiteUrl TEXT PRIMARY KEY,
      normalizedUrl TEXT NOT NULL REFERENCES ${METADATA_TABLE}(websiteUrl) ON DELETE CASCADE,
      updatedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_overpass_website_reference_normalized
      ON ${REFERENCE_TABLE} (normalizedUrl);
    CREATE TABLE IF NOT EXISTS ${JOB_TABLE} (
      metadataJobId TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
      triggerReason TEXT NOT NULL,
      totalUrls INTEGER NOT NULL DEFAULT 0,
      processedUrls INTEGER NOT NULL DEFAULT 0,
      succeededUrls INTEGER NOT NULL DEFAULT 0,
      failedUrls INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      createdAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      startedAt TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completedAt TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_overpass_metadata_job_running
      ON ${JOB_TABLE} ((1)) WHERE status = 'running';
    ALTER TABLE ${METADATA_TABLE} ALTER COLUMN nextAttemptAt DROP NOT NULL;
    ALTER TABLE ${METADATA_TABLE} ADD COLUMN IF NOT EXISTS outcome TEXT;
    ALTER TABLE ${METADATA_TABLE} ADD COLUMN IF NOT EXISTS errorCode TEXT;
    ALTER TABLE ${METADATA_TABLE} ADD COLUMN IF NOT EXISTS httpStatus INTEGER;
  `, callback);
}

function recover(db, callback) {
  db.exec(`
    UPDATE ${METADATA_TABLE}
      SET status = 'failed', nextAttemptAt = CURRENT_TIMESTAMP,
        outcome = 'retryable_error', errorCode = 'service_restarted_during_metadata_fetch',
        lastError = 'Service restarted during metadata fetch', updatedAt = CURRENT_TIMESTAMP
      WHERE status = 'fetching';
    UPDATE ${JOB_TABLE}
      SET status = 'failed', error = 'Service restarted during metadata job', completedAt = CURRENT_TIMESTAMP
      WHERE status = 'running';
  `, callback);
}

function discoverWebsites(db, callback) {
  db.all(`
    SELECT DISTINCT p.payload #>> '{contact,website}' AS websiteUrl
    FROM tableOverpassPoiVersion p
    JOIN tableOverpassDatasetVersion v ON v.versionId = p.versionId AND v.status = 'active'
    WHERE p.payload #>> '{contact,website}' ~* '^https://'
  `, [], callback);
}

function listDue(db, refreshDays, limit, callback) {
  const days = Math.max(1, Number(refreshDays) || 30);
  const safeLimit = Math.max(1, Math.min(100000, Number(limit) || 100000));
  db.all(`
    SELECT websiteUrl, metadata, status, fetchedAt, attemptCount
    FROM ${METADATA_TABLE}
    WHERE status <> 'fetching'
      AND nextAttemptAt IS NOT NULL
      AND nextAttemptAt <= CURRENT_TIMESTAMP
      AND (fetchedAt IS NULL OR fetchedAt < CURRENT_TIMESTAMP - (? * INTERVAL '1 day'))
    ORDER BY fetchedAt ASC NULLS FIRST, websiteUrl
    LIMIT ?
  `, [days, safeLimit], callback);
}

function get(db, websiteUrl, callback) {
  db.get(`SELECT * FROM ${METADATA_TABLE} WHERE websiteUrl = ?`, [websiteUrl], callback);
}

function ensure(db, websiteUrl, callback) {
  db.run(`INSERT INTO ${METADATA_TABLE} (websiteUrl) VALUES (?) ON CONFLICT (websiteUrl) DO NOTHING`, [websiteUrl], callback);
}

function ensureReference(db, websiteUrl, normalizedUrl, callback) {
  db.run(`INSERT INTO ${REFERENCE_TABLE} (websiteUrl, normalizedUrl) VALUES (?, ?)
    ON CONFLICT (websiteUrl) DO UPDATE SET normalizedUrl = EXCLUDED.normalizedUrl, updatedAt = CURRENT_TIMESTAMP`,
  [websiteUrl, normalizedUrl], callback);
}

function markFetching(db, websiteUrl, callback) {
  db.run(`UPDATE ${METADATA_TABLE} SET status = 'fetching', attemptCount = attemptCount + 1,
    lastAttemptAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP WHERE websiteUrl = ?`, [websiteUrl], callback);
}

function markSucceeded(db, websiteUrl, metadata, refreshDays, callback) {
  const days = Math.max(1, Number(refreshDays) || 30);
  db.run(`UPDATE ${METADATA_TABLE} SET metadata = ?::jsonb, status = 'succeeded', fetchedAt = CURRENT_TIMESTAMP,
    nextAttemptAt = CURRENT_TIMESTAMP + (? * INTERVAL '1 day'), outcome = 'metadata',
    lastError = NULL, errorCode = NULL, httpStatus = NULL, updatedAt = CURRENT_TIMESTAMP
    WHERE websiteUrl = ?`, [JSON.stringify(metadata), days, websiteUrl], callback);
}

function markNoMetadata(db, websiteUrl, callback) {
  db.run(`UPDATE ${METADATA_TABLE} SET metadata = NULL, status = 'succeeded', fetchedAt = CURRENT_TIMESTAMP,
    nextAttemptAt = NULL, outcome = 'no_metadata', lastError = NULL, errorCode = NULL,
    httpStatus = NULL, updatedAt = CURRENT_TIMESTAMP WHERE websiteUrl = ?`, [websiteUrl], callback);
}

function markRetryableFailed(db, websiteUrl, { error, errorCode, httpStatus, retryAt }, callback) {
  db.run(`UPDATE ${METADATA_TABLE} SET status = 'failed',
    nextAttemptAt = ?::timestamptz, outcome = 'retryable_error', lastError = ?, errorCode = ?, httpStatus = ?,
    updatedAt = CURRENT_TIMESTAMP WHERE websiteUrl = ?`, [retryAt,
    String(error || 'Metadata fetch failed').slice(0, 2000), errorCode || null, httpStatus || null, websiteUrl], callback);
}

function markPermanentFailed(db, websiteUrl, { error, errorCode, httpStatus }, callback) {
  db.run(`UPDATE ${METADATA_TABLE} SET metadata = NULL, status = 'failed', nextAttemptAt = NULL,
    outcome = 'permanent_error', lastError = ?, errorCode = ?, httpStatus = ?, updatedAt = CURRENT_TIMESTAMP
    WHERE websiteUrl = ?`, [String(error || 'Metadata fetch failed').slice(0, 2000),
    errorCode || null, httpStatus || null, websiteUrl], callback);
}

function createJob(db, { jobId, reason, total }, callback) {
  db.run(`INSERT INTO ${JOB_TABLE} (metadataJobId, status, triggerReason, totalUrls)
    VALUES (?, 'running', ?, ?)`, [jobId, reason, total], callback);
}

function updateJob(db, jobId, { processed, succeeded, failed }, callback) {
  db.run(`UPDATE ${JOB_TABLE} SET processedUrls = ?, succeededUrls = ?, failedUrls = ?
    WHERE metadataJobId = ? AND status = 'running'`, [processed, succeeded, failed, jobId], callback);
}

function completeJob(db, jobId, callback) {
  db.run(`UPDATE ${JOB_TABLE} SET status = 'succeeded', completedAt = CURRENT_TIMESTAMP
    WHERE metadataJobId = ? AND status = 'running'`, [jobId], callback);
}

function failJob(db, jobId, error, callback) {
  db.run(`UPDATE ${JOB_TABLE} SET status = 'failed', error = ?, completedAt = CURRENT_TIMESTAMP
    WHERE metadataJobId = ? AND status = 'running'`, [String(error || 'Metadata job failed').slice(0, 2000), jobId], callback);
}

function runningJob(db, callback) {
  db.get(`SELECT * FROM ${JOB_TABLE} WHERE status = 'running' ORDER BY startedAt LIMIT 1`, [], callback);
}

function listJobs(db, limit, callback) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 20));
  db.all(`SELECT * FROM ${JOB_TABLE} ORDER BY createdAt DESC LIMIT ?`, [safeLimit], callback);
}

module.exports = {
  METADATA_TABLE, REFERENCE_TABLE, JOB_TABLE, init, recover, discoverWebsites, listDue, get, ensure, ensureReference,
  markFetching, markSucceeded, markNoMetadata, markRetryableFailed, markPermanentFailed,
  createJob, updateJob, completeJob, failJob, runningJob, listJobs
};
