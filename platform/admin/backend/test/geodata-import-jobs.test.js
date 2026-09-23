const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const dispatchTable = require('../db/tableGeodataImportDispatch');

function loadUtility(dispatches, request, create = () => {}) {
  const settingsTable = { markTriggered: (_db, _time, cb) => cb(null) };
  const mocks = {
    axios: request,
    'node:crypto': require('node:crypto'),
    './serviceJwt': { signServiceJwt: async () => 'token' },
    './adminLogForwarder': { resolveBaseUrl: () => 'http://geodata.test' },
    '../db/tableGeodataImportSettings': settingsTable,
    '../db/tableGeodataImportDispatch': {
      latestBatch: (_db, cb) => cb(null, dispatches),
      create: (_db, row, cb) => { create(row); cb(null); }
    }
  };
  const context = {
    module: { exports: {} }, require: name => mocks[name],
    process: { env: {} }, URLSearchParams, console
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../utils/geodataImport.js'), 'utf8'), context);
  return context.module.exports;
}

test('current import run returns all 135 jobs in bounded queries, including old reused jobs', async () => {
  const dispatches = Array.from({ length: 135 }, (_, i) => ({
    batchId: 'batch', dispatchId: 'dispatch-' + i, serviceJobId: 'job-' + i, datasetId: 'country-' + i
  }));
  const requests = [];
  const { currentImportJobs } = loadUtility(dispatches, async ({ url }) => {
    const ids = new URL(url).searchParams.get('jobIds').split(',');
    requests.push(ids.length);
    return { data: { jobs: ids.map(jobId => ({ jobId, status: jobId === 'job-0' ? 'running' : 'queued' })) } };
  });
  const result = await currentImportJobs({});
  assert.equal(result.batchId, 'batch');
  assert.equal(result.jobs.length, 135);
  assert.equal(result.jobs[0].status, 'running');
  assert.deepEqual(requests, [50, 50, 35]);
});

test('failed dispatches stay visible and missing jobs do not disappear', async () => {
  const { currentImportJobs } = loadUtility([
    { batchId: 'batch', dispatchId: 'failed', datasetId: 'a', error: 'Unavailable', createdAt: 1000 },
    { batchId: 'batch', dispatchId: 'missing', datasetId: 'b', serviceJobId: 'old', createdAt: 1000 }
  ], async () => ({ data: { jobs: [] } }));
  const result = await currentImportJobs({});
  assert.equal(result.jobs.length, 2);
  assert.equal(result.jobs[0].error, 'Unavailable');
  assert.equal(result.jobs[1].status, 'failed');
});

test('legacy data uses active queue fallback', async () => {
  const { currentImportJobs } = loadUtility([], async ({ url }) => {
    assert.equal(new URL(url).searchParams.get('includeActive'), 'true');
    return { data: { jobs: [{ jobId: 'active' }] } };
  });
  const result = await currentImportJobs({});
  assert.equal(result.batchId, null);
  assert.equal(result.jobs.length, 1);
});

test('manual and scheduled dispatches persist a shared ID per run, including reused jobs', async () => {
  const rows = [];
  const { dispatchImports } = loadUtility([], async ({ data }) => ({
    data: { job: { jobId: data.datasetId, status: 'queued' }, created: false }
  }), row => rows.push(row));
  const config = { datasets: ['a', 'b'], categories: ['tourism'], refreshSource: true };
  await dispatchImports({}, config, 'manual');
  await dispatchImports({}, config, 'scheduled');
  assert.equal(rows[0].batchId, rows[1].batchId);
  assert.equal(rows[2].batchId, rows[3].batchId);
  assert.notEqual(rows[0].batchId, rows[2].batchId);
  assert.equal(rows[0].serviceJobId, 'a');
});

test('dispatch failure is recorded with the batch ID', async () => {
  const rows = [];
  const { dispatchImports } = loadUtility([], async () => { throw new Error('offline'); }, row => rows.push(row));
  await assert.rejects(dispatchImports({}, { datasets: ['a'], categories: ['tourism'] }, 'manual'));
  assert.equal(rows[0].status, 'failed');
  assert.ok(rows[0].batchId);
});

test('latest batch query does not limit its members', () => {
  dispatchTable.latestBatch({
    all(sql, params, cb) {
      assert.match(sql, /WHERE batchId = \(SELECT batchId/);
      assert.equal((sql.match(/LIMIT/g) || []).length, 1);
      assert.match(sql, /LIMIT 1\)/);
      cb(null, []);
    }
  });
});

test('a Geodata HTTP 429 rejects only that request and later requests still succeed', async () => {
  let calls = 0;
  const { requestService } = loadUtility([], async () => {
    if (++calls === 1) {
      throw Object.assign(new Error('Too many requests'), {
        response: { status: 429, data: { message: 'Too many requests' } }
      });
    }
    return { data: { jobs: [] } };
  });
  await assert.rejects(requestService('get', '/geodata/import-jobs'), error => error.status === 429);
  const result = await requestService('get', '/geodata/import-jobs');
  assert.equal(result.jobs.length, 0);
});
