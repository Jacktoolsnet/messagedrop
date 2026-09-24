const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const table = require('../db/tableGeodataPoi');
const { ImportJobManager } = require('../import-job-manager');

const result = (register) => new Promise((resolve, reject) =>
  register((error, value) => error ? reject(error) : resolve(value)));

// Exercise the actual priority SQL against isolated fixtures, never the app DB.
function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(`
    CREATE TABLE tableGeodataDataset (datasetId TEXT PRIMARY KEY, activeVersionId TEXT);
    CREATE TABLE tableGeodataImportJob (
      jobId TEXT PRIMARY KEY, datasetId TEXT, status TEXT, createdAt INTEGER,
      completedAt INTEGER, startedAt INTEGER, requestedConfig TEXT DEFAULT '{}'
    );
  `);
  const db = {
    all(sql, params, cb) { cb(null, sqlite.prepare(sql).all(...params)); },
    get(sql, params, cb) { cb(null, sqlite.prepare(sql).get(...params)); }
  };
  function job(id, dataset, status, time) {
    sqlite.prepare(`INSERT INTO tableGeodataImportJob
      (jobId, datasetId, status, createdAt, completedAt, startedAt) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(id, dataset, status, time, ['succeeded', 'failed'].includes(status) ? time + 1 : null,
        status === 'running' ? time : null);
  }
  function dataset(id, version = null) {
    sqlite.prepare('INSERT INTO tableGeodataDataset VALUES (?, ?)').run(id, version);
  }
  return { sqlite, db, job, dataset };
}

function managerFor(db, ids) {
  const manager = Object.create(ImportJobManager.prototype);
  manager.database = { db };
  manager.datasetCatalog = { get: async () => ({ definitions: Object.fromEntries(ids.map(id => [id, { id }])) }) };
  manager.children = new Map();
  manager.launching = false;
  manager.logger = { error: (...args) => assert.fail(JSON.stringify(args)) };
  return manager;
}

test('plan: last failures first, new datasets next, existing imports last; ties retain selection order', async (t) => {
  const { db, job, dataset } = fixture(t);
  dataset('canada', 'old-version');
  job('ca-ok', 'canada', 'succeeded', 1);
  job('ca-failed', 'canada', 'failed', 2);
  job('us-failed', 'us', 'failed', 3);
  job('gl-failed', 'greenland', 'failed', 4);
  job('gl-retry', 'greenland', 'queued', 5); // Must not hide the last failure.
  job('de-failed', 'germany', 'failed', 1);
  job('de-ok', 'germany', 'succeeded', 2); // Old failures no longer get priority.
  dataset('france', 'retained-version'); // Success history has been cleaned up.
  dataset('new-with-row'); // A row alone does not mean a successful import.
  const ids = ['germany', 'new', 'canada', 'france', 'us', 'new-with-row', 'greenland'];
  const manager = managerFor(db, ids);
  const plan = await manager.plan(ids);
  assert.deepEqual(plan.map(row => [row.datasetId, row.priority]), [
    ['canada', 0], ['us', 0], ['greenland', 0], ['new', 1], ['new-with-row', 1],
    ['germany', 2], ['france', 2]
  ]);
});

test('planning handles more than 100 countries, deduplicates and validates before querying', async (t) => {
  const { db } = fixture(t);
  const ids = Array.from({ length: 180 }, (_, i) => `country-${i}`);
  const manager = managerFor(db, ids);
  const plan = await manager.plan([...ids, ids[0]]);
  assert.deepEqual(plan.map(row => row.datasetId), ids);
  for (const input of [undefined, [], 'country-1', [null]]) {
    await assert.rejects(manager.plan(input), { message: 'invalid_import_datasets', status: 400 });
  }
  for (const input of [['unknown'], ['constructor']]) {
    await assert.rejects(manager.plan(input), { message: 'unknown_import_dataset', status: 400 });
  }
});

test('persisted queue uses the same priority after manager recreation; FIFO within each class', async (t) => {
  const { db, job, dataset, sqlite } = fixture(t);
  dataset('imported', 'version');
  job('old-failure', 'failed', 'failed', 1);
  job('old-other-failure', 'failed-other', 'failed', 2);
  // Queue insertion deliberately disagrees with priority.
  job('q-imported', 'imported', 'queued', 10);
  job('q-new', 'new', 'queued', 11);
  job('q-failed', 'failed', 'queued', 12);
  job('q-failed-other', 'failed-other', 'queued', 13);
  job('q-new-other', 'new-other', 'queued', 14);
  const ids = ['imported', 'new', 'failed', 'failed-other', 'new-other'];
  for (const expected of ['q-failed', 'q-failed-other', 'q-new', 'q-new-other', 'q-imported']) {
    const manager = managerFor(db, ids);
    let launched;
    manager.launch = (id) => { launched = id; };
    await manager.launchNext();
    assert.equal(launched, expected);
    sqlite.prepare("UPDATE tableGeodataImportJob SET status = 'succeeded', completedAt = 20 WHERE jobId = ?")
      .run(expected);
  }
  assert.equal(await result(cb => table.findQueuedJob(db, cb)), undefined);
});

test('a running import is never preempted by a higher-priority country', async (t) => {
  const { db, job } = fixture(t);
  job('running', 'imported', 'running', 1);
  job('failed', 'retry', 'failed', 2);
  job('queued', 'retry', 'queued', 3);
  const manager = managerFor(db, ['imported', 'retry']);
  manager.launch = () => assert.fail('must not launch while a job is running');
  await manager.launchNext();
  // Also cover the interval between process spawn and its DB status update.
  manager.children.set('starting', {});
  manager.database = { db: { get: () => assert.fail('local worker still active') } };
  await manager.launchNext();
});
