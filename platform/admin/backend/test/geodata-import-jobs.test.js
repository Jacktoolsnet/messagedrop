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
    './importJobEvents': { emit() {} },
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
    if (new URL(url).searchParams.get('activeOnly')) return { data: { jobs: [] } };
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
    data: data.datasetIds
      ? { datasets: data.datasetIds.map(datasetId => ({ datasetId })) }
      : { job: { jobId: data.datasetId, status: 'queued' }, created: false }
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
  const { dispatchImports } = loadUtility([], async ({ data }) => {
    if (data.datasetIds) return { data: { datasets: [{ datasetId: 'a' }] } };
    throw new Error('offline');
  }, row => rows.push(row));
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

test('restart: completed latest batch cannot hide running and queued jobs from other runs', async () => {
  const dispatches = [{
    batchId: 'last-run', dispatchId: 'dispatch', serviceJobId: 'finished', datasetId: 'germany'
  }];
  const jobs = Array.from({ length: 135 }, (_, i) => ({
    jobId: 'active-' + i, datasetId: 'country-' + i, status: i === 0 ? 'running' : 'queued'
  }));
  const request = async ({ url }) => ({
    data: { jobs: new URL(url).searchParams.has('activeOnly')
      ? jobs : [{ jobId: 'finished', datasetId: 'germany', status: 'succeeded' }] }
  });
  // A fresh module instance models restart/reload without any previous in-memory state.
  for (let restart = 0; restart < 2; restart++) {
    const result = await loadUtility(dispatches, request).currentImportJobs({});
    assert.equal(result.jobs.length, 136);
    assert.equal(result.jobs.filter(job => job.status === 'running').length, 1);
    assert.equal(result.jobs.filter(job => job.status === 'queued').length, 134);
  }
});

test('live queue updates existing batch jobs without duplicate entries', async () => {
  const { currentImportJobs } = loadUtility([{
    batchId: 'run', dispatchId: 'dispatch', serviceJobId: 'same', datasetId: 'germany'
  }], async ({ url }) => ({
    data: { jobs: [{ jobId: 'same', datasetId: 'germany',
      status: new URL(url).searchParams.has('activeOnly') ? 'running' : 'queued' }] }
  }));
  const result = await currentImportJobs({});
  assert.equal(result.jobs.length, 1);
  assert.equal(result.jobs[0].status, 'running');
});

test('live queue failure is reported instead of returning a misleading completed-only list', async () => {
  const { currentImportJobs } = loadUtility([{
    batchId: 'run', dispatchId: 'dispatch', serviceJobId: 'finished', datasetId: 'germany'
  }], async ({ url }) => {
    if (new URL(url).searchParams.has('activeOnly')) throw new Error('service unavailable');
    return { data: { jobs: [{ jobId: 'finished', status: 'succeeded' }] } };
  });
  await assert.rejects(currentImportJobs({}), /geodata_service_unavailable/);
});

for (const triggerType of ['manual', 'scheduled']) {
  test(`${triggerType} dispatch plans all countries before starting the first import`, async () => {
    const rows = [];
    const selected = Array.from({ length: 166 }, (_, i) => 'country-' + i);
    const ordered = [...selected].reverse();
    const requests = [];
    const { dispatchImports } = loadUtility([], async ({ url, data }) => {
      requests.push(new URL(url).pathname);
      if (url.endsWith('/import-plan')) {
        assert.deepEqual(Array.from(data.datasetIds), selected);
        return { data: { datasets: ordered.map(datasetId => ({ datasetId })) } };
      }
      return { data: { job: { jobId: data.datasetId, status: 'queued' }, created: true } };
    }, row => rows.push(row));
    await dispatchImports({}, { datasets: selected, categories: ['tourism'], refreshSource: true }, triggerType, { force: true });
    assert.equal(requests[0], '/geodata/import-plan');
    assert.equal(requests.length, 167);
    assert.deepEqual(rows.map(row => row.datasetId), ordered);
    assert.ok(rows.every(row => row.requestedConfig.force && row.requestedConfig.refresh));
    assert.equal(new Set(rows.map(row => row.batchId)).size, 1);
  });
}

test('unavailable or invalid plans fail before creating any import jobs', async () => {
  for (const datasets of [null, {}, [], [null], [{ datasetId: 'other' }],
    [{ datasetId: 'a' }, { datasetId: 'a' }], [{ datasetId: 'a' }]]) {
    let calls = 0;
    const { dispatchImports } = loadUtility([], async () => {
      calls++;
      return { data: { datasets } };
    }, () => assert.fail('no dispatch should have been created'));
    await assert.rejects(dispatchImports({}, { datasets: ['a', 'b'] }, 'manual'), /invalid_geodata_import_plan/);
    assert.equal(calls, 1);
  }
  const { dispatchImports } = loadUtility([], async () => { throw new Error('offline'); },
    () => assert.fail('no dispatch should have been created'));
  await assert.rejects(dispatchImports({}, { datasets: ['a'] }, 'manual'), /geodata_service_unavailable/);
});
