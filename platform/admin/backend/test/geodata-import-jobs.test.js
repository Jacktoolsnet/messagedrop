const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const dispatchTable = require('../db/tableGeodataImportDispatch');

function loadUtility(dispatches, request, create = () => {}, retry = {}) {
  const settingsTable = { markTriggered: (_db, _time, cb) => cb(null) };
  const mocks = {
    axios: request,
    './importJobEvents': { emit() { retry.changed?.(); } },
    'node:crypto': require('node:crypto'),
    './serviceJwt': { signServiceJwt: async () => 'token' },
    './adminLogForwarder': { resolveBaseUrl: () => 'http://geodata.test' },
    '../db/tableGeodataImportSettings': settingsTable,
    '../db/tableGeodataImportDispatch': {
      findForRetry: (_db, _id, cb) => cb(null, retry.dispatch),
      replaceJob: (_db, id, job, cb) => { retry.replace?.(id, job); cb(null); },
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

const failedJobId = 'cc9d9e22-d5ac-4ccd-adbe-df0a03c6499d';
const retryConfig = { categories: ['tourism'], subcategories: { tourism: ['museum'] }, refresh: false, force: true };

test('retry sends only the failed country with its original configuration and preserves the batch', async () => {
  const calls = [];
  let changed = 0;
  let replaced;
  const job = { jobId: 'retry', datasetId: 'canada', status: 'queued' };
  const { retryImport } = loadUtility([], async ({ method, url, data }) => {
    calls.push({ method, url, data });
    return { data: method === 'get'
      ? { job: { jobId: failedJobId, datasetId: 'canada', status: 'failed', requestedConfig: retryConfig } }
      : { job, created: true } };
  }, () => assert.fail('must not create a new batch'), {
    dispatch: { dispatchId: 'dispatch', serviceJobId: failedJobId, batchId: 'original-run' },
    replace: (id, value) => { replaced = { id, value }; }, changed: () => changed++
  });
  assert.equal((await retryImport({}, failedJobId)).job.jobId, 'retry');
  assert.equal(calls.length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1].data)), { datasetId: 'canada', ...retryConfig });
  assert.deepEqual(replaced, { id: 'dispatch', value: job });
  assert.equal(changed, 1);
});

test('retry supports failed hand-offs and expired service history using stored configuration', async () => {
  for (const serviceJobId of [null, failedJobId]) {
    const { retryImport } = loadUtility([], async ({ method, data }) => {
      if (method === 'get') throw Object.assign(new Error('gone'), { status: 404 });
      assert.deepEqual(JSON.parse(JSON.stringify(data)), { datasetId: 'canada', ...retryConfig });
      return { data: { job: { jobId: 'new', status: 'queued' }, created: true } };
    }, () => {}, {
      dispatch: { dispatchId: failedJobId, serviceJobId, datasetId: 'canada', status: 'failed',
        requestedConfig: JSON.stringify(retryConfig) }
    });
    await retryImport({}, failedJobId);
  }
});

test('retry rejects non-failed jobs, bad IDs, missing jobs and upstream errors without starting an import', async () => {
  for (const status of ['running', 'queued', 'succeeded']) {
    const { retryImport } = loadUtility([], async ({ method }) => {
      assert.equal(method, 'get');
      return { data: { job: { status } } };
    });
    await assert.rejects(retryImport({}, failedJobId), error => error.status === 409);
  }
  const { retryImport } = loadUtility([], async () => { throw Object.assign(new Error('offline'), { status: 503 }); });
  await assert.rejects(retryImport({}, '../invalid'), error => error.status === 400);
  await assert.rejects(retryImport({}, failedJobId), error => error.status === 503);
  const missing = loadUtility([], async () => { throw Object.assign(new Error('gone'), { status: 404 }); });
  await assert.rejects(missing.retryImport({}, failedJobId), error => error.status === 404);
});

test('retry passes through an already active job reused by the service', async () => {
  const job = { jobId: 'existing', status: 'running', datasetId: 'canada' };
  const { retryImport } = loadUtility([], async ({ method }) => ({ data: method === 'get'
    ? { job: { status: 'failed', datasetId: 'canada', requestedConfig: retryConfig } }
    : { job, created: false } }));
  const result = await retryImport({}, failedJobId);
  assert.equal(result.created, false);
  assert.equal(result.job.jobId, 'existing');
});

test('replacing a retry pointer keeps run membership, timestamps and original configuration', () => {
  dispatchTable.replaceJob({ run(sql, params, cb) {
    assert.match(sql, /SET serviceJobId = \?, status = \?, error = NULL, updatedAt = \?/);
    assert.doesNotMatch(sql, /SET.*(?:batchId|createdAt|requestedConfig)\s*=/);
    assert.deepEqual([params[0], params[1], params[3]], ['new', 'queued', 'dispatch']);
    cb(null);
  } }, 'dispatch', { jobId: 'new', status: 'queued' }, () => {});
});

test('statistics sum actual per-job downloads, record counts and processing time, including zero and partial data', () => {
  const { summarizeImportJobs } = loadUtility([], async () => {});
  const now = Date.parse('2026-09-25T10:01:00Z');
  const startedAt = '2026-09-25T10:00:00Z';
  const result = summarizeImportJobs([
    { status: 'succeeded', downloadedBytes: '1500000000', importedRecords: '1000', startedAt, completedAt: '2026-09-25T10:00:10Z' },
    { status: 'succeeded', downloadedBytes: 0, importedRecords: 0, startedAt, completedAt: '2026-09-25T10:00:01Z' },
    { status: 'running', downloadedBytes: '2000000000', importedRecords: null, startedAt },
    { status: 'queued' },
    { status: 'failed', downloadedBytes: '3000000', importedRecords: 10, startedAt, completedAt: '2026-09-25T10:00:05Z' }
  ], now);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    jobCount: 5, downloadedBytes: 3503000000, importedRecords: 1010, durationMs: 76000, incomplete: true
  });
  const old = summarizeImportJobs([{ status: 'succeeded' }], now);
  assert.equal(old.downloadedBytes, null);
  assert.equal(old.importedRecords, null);
  assert.equal(old.durationMs, null);
  assert.equal(old.incomplete, true);
});

test('latest-run statistics exclude active jobs from other runs and deduplicate reused jobs', async () => {
  const dispatch = { batchId: 'run', serviceJobId: 'job', datasetId: 'canada' };
  const job = { jobId: 'job', status: 'succeeded', downloadedBytes: '1000000000', importedRecords: 10,
    startedAt: '2026-09-25T10:00:00Z', completedAt: '2026-09-25T10:00:01Z' };
  const { currentImportJobs } = loadUtility([dispatch, dispatch], async ({ url }) => ({ data: {
    jobs: url.includes('activeOnly') ? [{ ...job, jobId: 'other', downloadedBytes: 5000000000, status: 'running' }] : [job]
  } }));
  const result = await currentImportJobs({});
  assert.equal(result.jobs.length, 2);
  assert.equal(result.runStatistics.jobCount, 1);
  assert.equal(result.runStatistics.downloadedBytes, 1000000000);
  assert.equal(result.runStatistics.importedRecords, 10);
  assert.equal(result.runStatistics.durationMs, 1000);
  assert.equal(result.runStatistics.incomplete, false);
});
