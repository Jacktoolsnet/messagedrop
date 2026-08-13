const test = require('node:test');
const assert = require('node:assert/strict');
const tableOverpassPoi = require('../db/tableOverpassPoi');

function recordingDatabase() {
  const calls = [];
  const transaction = {
    run(sql, params, callback) {
      calls.push({ sql: sql.replace(/\s+/gu, ' ').trim(), params });
      callback?.(null);
    }
  };
  return {
    calls,
    run: transaction.run,
    transaction: async (factory) => factory(transaction)
  };
}

test('publishes a complete version before atomically changing the active pointer', async () => {
  const db = recordingDatabase();
  const poi = {
    osmType: 'node', osmId: 42, category: 'accommodation', subtype: 'hotel',
    latitude: 52.1, longitude: 10.5
  };
  await tableOverpassPoi.publishVersion(db, {
    jobId: 'job-1',
    versionId: 'version-2',
    dataset: {
      id: 'wolfenbuettel', sourceUrl: 'https://example.test/data.pbf', sourceTimestamp: null,
      bounds: { south: 52, west: 10, north: 53, east: 11 }
    },
    categories: ['accommodation'],
    pois: [poi]
  });

  const statements = db.calls.map(({ sql }) => sql);
  const insertPoi = statements.findIndex((sql) => sql.includes('INSERT INTO tableOverpassPoiVersion'));
  const activateVersion = statements.findIndex((sql) => sql.includes("SET status = 'active'"));
  const switchDataset = statements.findIndex((sql) => sql.includes('SET activeVersionId = ?'));
  const finishJob = statements.findIndex((sql) => sql.includes("SET status = 'succeeded'"));
  assert.ok(insertPoi >= 0 && insertPoi < activateVersion);
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
  await new Promise((resolve, reject) => tableOverpassPoi.cleanupRetiredVersions(
    db,
    'wolfenbuettel',
    1,
    (error) => error ? reject(error) : resolve()
  ));
  assert.match(captured.sql, /status = 'retired'/u);
  assert.deepEqual(captured.params, ['wolfenbuettel', 1]);
});
