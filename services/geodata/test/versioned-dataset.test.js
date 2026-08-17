const test = require('node:test');
const assert = require('node:assert/strict');
const tableGeodataPoi = require('../db/tableGeodataPoi');

function recordingDatabase() {
  const calls = [];
  const transaction = {
    run(sql, params, callback) {
      calls.push({ sql: sql.replace(/\s+/gu, ' ').trim(), params });
      callback?.(null);
    },
    get(sql, params, callback) {
      calls.push({ sql: sql.replace(/\s+/gu, ' ').trim(), params });
      callback?.(null, {
        versionId: params[0], recordCount: 1,
        relativePath: 'datasets/wolfenbuettel/version-2/pois.jsonl.gz', sha256: 'a'.repeat(64)
      });
    }
  };
  return {
    calls,
    run: transaction.run,
    transaction: async (factory) => factory(transaction)
  };
}

test('requires a ready export before atomically changing the active pointer', async () => {
  const db = recordingDatabase();
  const poi = {
    osmType: 'node', osmId: 42, category: 'accommodation', subtype: 'hotel',
    latitude: 52.1, longitude: 10.5
  };
  const dataset = {
    id: 'wolfenbuettel', sourceUrl: 'https://example.test/data.pbf', sourceTimestamp: null,
    bounds: { south: 52, west: 10, north: 53, east: 11 }
  };
  await tableGeodataPoi.stageVersion(db, {
    versionId: 'version-2',
    dataset,
    categories: ['accommodation']
  });
  await tableGeodataPoi.insertPoiBatch(db, 'version-2', [poi]);
  await new Promise((resolve, reject) => tableGeodataPoi.beginExport(db,
    { versionId: 'version-2', datasetId: 'wolfenbuettel' },
    (error) => error ? reject(error) : resolve()));
  await new Promise((resolve, reject) => tableGeodataPoi.completeExport(db, {
    versionId: 'version-2', relativePath: 'datasets/wolfenbuettel/version-2/pois.jsonl.gz',
    recordCount: 1, byteSize: 100, sha256: 'a'.repeat(64), metadata: {}
  }, (error) => error ? reject(error) : resolve()));
  await tableGeodataPoi.activateVersion(db, {
    jobId: 'job-1', versionId: 'version-2', datasetId: 'wolfenbuettel', poiCount: 1
  });

  const statements = db.calls.map(({ sql }) => sql);
  const insertPoi = statements.findIndex((sql) => sql.includes('INSERT INTO tableGeodataPoiVersion'));
  const activateVersion = statements.findIndex((sql) => sql.includes("SET status = 'active'"));
  const completeExport = statements.findIndex((sql) => sql.includes("SET status = 'ready'"));
  const switchDataset = statements.findIndex((sql) => sql.includes('SET activeVersionId = ?'));
  const finishJob = statements.findIndex((sql) => sql.includes("SET status = 'succeeded'"));
  assert.ok(insertPoi >= 0 && insertPoi < completeExport);
  assert.ok(completeExport < activateVersion);
  assert.ok(activateVersion < switchDataset);
  assert.ok(switchDataset < finishJob);
  assert.equal(db.calls[insertPoi].params[0], 'version-2');
});

test('cleanup only targets retired versions and can retain rollback versions', async () => {
  let captured;
  const db = {
    run(sql, params, callback) {
      captured = { sql, params };
      callback(null);
    }
  };
  await new Promise((resolve, reject) => tableGeodataPoi.cleanupRetiredVersions(
    db,
    'wolfenbuettel',
    1,
    (error) => error ? reject(error) : resolve()
  ));
  assert.match(captured.sql, /status = 'retired'/u);
  assert.deepEqual(captured.params, ['wolfenbuettel', 1]);
});

test('does not activate a database version without its validated export', async () => {
  const db = {
    transaction: async (factory) => factory({
      get(_sql, _params, callback) { callback(null, null); },
      run(_sql, _params, callback) { callback(null); }
    })
  };
  await assert.rejects(() => tableGeodataPoi.activateVersion(db, {
    jobId: 'job-2', versionId: 'version-without-export', datasetId: 'germany', poiCount: 1
  }), /No ready ODbL export/u);
});

test('job cleanup removes only completed terminal jobs older than the retention window', async () => {
  let captured;
  const db = {
    run(sql, params, callback) {
      captured = { sql: sql.replace(/\s+/gu, ' ').trim(), params };
      callback(null);
    }
  };
  await new Promise((resolve, reject) => tableGeodataPoi.cleanupJobs(db, 90,
    (error) => error ? reject(error) : resolve()));

  assert.match(captured.sql, /status IN \('succeeded', 'failed'\)/u);
  assert.match(captured.sql, /completedAt </u);
  assert.deepEqual(captured.params, [90]);
});
