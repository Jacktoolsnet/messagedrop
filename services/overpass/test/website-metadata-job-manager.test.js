const test = require('node:test');
const assert = require('node:assert/strict');
const {
  WebsiteMetadataJobManager,
  classifyMetadataError,
  hasUsefulMetadata,
  retryDelayMs
} = require('../website-metadata-job-manager');

function memoryStore(websites) {
  const state = { metadata: new Map(), references: new Map(), job: null, recovered: false };
  const done = (callback, value) => callback(null, value);
  return { state,
    recover(_db, callback) { state.recovered = true; done(callback); },
    runningJob(_db, callback) { done(callback, state.job?.status === 'running' ? state.job : null); },
    discoverWebsites(_db, callback) { done(callback, websites.map((websiteUrl) => ({ websiteUrl }))); },
    ensure(_db, url, callback) { if (!state.metadata.has(url)) state.metadata.set(url, { websiteUrl: url }); done(callback); },
    ensureReference(_db, raw, normalized, callback) { state.references.set(raw, normalized); done(callback); },
    listDue(_db, _days, _limit, callback) {
      done(callback, [...state.metadata.keys()].map((websiteUrl) => ({ websiteUrl })));
    },
    createJob(_db, value, callback) {
      state.job = { metadataJobId: value.jobId, status: 'running', totalUrls: value.total,
        processedUrls: 0, succeededUrls: 0, failedUrls: 0 };
      done(callback);
    },
    updateJob(_db, _id, value, callback) { Object.assign(state.job, {
      processedUrls: value.processed, succeededUrls: value.succeeded, failedUrls: value.failed
    }); done(callback); },
    completeJob(_db, _id, callback) { state.job.status = 'succeeded'; done(callback); },
    failJob(_db, _id, error, callback) { state.job.status = 'failed'; state.job.error = error; done(callback); },
    markFetching(_db, url, callback) {
      const row = state.metadata.get(url);
      row.status = 'fetching'; row.attemptCount = Number(row.attemptCount || 0) + 1; done(callback);
    },
    markSucceeded(_db, url, metadata, _days, callback) {
      Object.assign(state.metadata.get(url), { status: 'succeeded', outcome: 'metadata', metadata }); done(callback);
    },
    markNoMetadata(_db, url, callback) {
      Object.assign(state.metadata.get(url), { status: 'succeeded', outcome: 'no_metadata', metadata: null }); done(callback);
    },
    markRetryableFailed(_db, url, value, callback) {
      Object.assign(state.metadata.get(url), { status: 'failed', outcome: 'retryable_error', ...value }); done(callback);
    },
    markPermanentFailed(_db, url, value, callback) {
      Object.assign(state.metadata.get(url), { status: 'failed', outcome: 'permanent_error', ...value }); done(callback);
    },
    get(_db, url, callback) { done(callback, state.metadata.get(url) || null); },
    listJobs(_db, _limit, callback) { done(callback, state.job ? [state.job] : []); }
  };
}

test('recovers on startup, deduplicates normalized URLs and fetches them sequentially', async () => {
  const store = memoryStore([
    'https://hotel.example', 'https://hotel.example/', 'https://second.example/'
  ]);
  const calls = [];
  const manager = new WebsiteMetadataJobManager({
    database: { db: {} }, store, delayMs: 0,
    client: { async fetch(url) { calls.push(url); return { url, title: url }; } }
  });

  await manager.recoverAndTrigger();
  if (manager.running) await manager.running;

  assert.equal(store.state.recovered, true);
  assert.deepEqual(calls, ['https://hotel.example/', 'https://second.example/']);
  assert.equal(store.state.references.size, 3);
  assert.equal(store.state.job.status, 'succeeded');
  assert.equal(store.state.job.processedUrls, 2);
  assert.equal(store.state.job.succeededUrls, 2);
});

test('records individual website failures without failing the complete metadata job', async () => {
  const store = memoryStore(['https://broken.example/', 'https://working.example/']);
  const manager = new WebsiteMetadataJobManager({
    database: { db: {} }, store, delayMs: 0,
    logger: { info() {}, warn() {}, error() {} },
    client: { async fetch(url) {
      if (url.includes('broken')) throw new Error('unavailable');
      return { url, title: 'Working' };
    } }
  });

  await manager.trigger('import-completed');
  if (manager.running) await manager.running;

  assert.equal(store.state.job.status, 'succeeded');
  assert.equal(store.state.job.succeededUrls, 1);
  assert.equal(store.state.job.failedUrls, 1);
  assert.equal(store.state.metadata.get('https://broken.example/').outcome, 'retryable_error');
});

test('returns the running job immediately when a scheduled check overlaps with enrichment', async () => {
  const store = memoryStore(['https://slow.example/']);
  let finishFetch;
  const fetchFinished = new Promise((resolve) => { finishFetch = resolve; });
  const manager = new WebsiteMetadataJobManager({
    database: { db: {} }, store, delayMs: 0,
    client: { fetch() { return fetchFinished; } }
  });

  const started = await manager.trigger('service-start');
  const overlapping = await manager.trigger('daily-cron');

  assert.equal(started.status, 'running');
  assert.equal(overlapping.metadataJobId, started.metadataJobId);
  finishFetch({ title: 'Slow website' });
  await manager.running;
});

test('stores reachable pages without useful head metadata as terminal no-metadata results', async () => {
  const store = memoryStore(['https://empty.example/']);
  const manager = new WebsiteMetadataJobManager({
    database: { db: {} }, store, delayMs: 0,
    client: { async fetch(url) { return { url, fetchedAt: new Date().toISOString() }; } }
  });

  await manager.trigger('daily-cron');
  if (manager.running) await manager.running;

  assert.equal(store.state.metadata.get('https://empty.example/').outcome, 'no_metadata');
  assert.equal(store.state.metadata.get('https://empty.example/').metadata, null);
});

test('stores HTTP 404 as a permanent failure without another retry time', async () => {
  const store = memoryStore(['https://missing.example/']);
  const manager = new WebsiteMetadataJobManager({
    database: { db: {} }, store, delayMs: 0,
    logger: { info() {}, warn() {}, error() {} },
    client: { async fetch() {
      throw Object.assign(new Error('website_metadata_http_error'), {
        errorCode: 'website_metadata_http_error', httpStatus: 404, status: 404
      });
    } }
  });

  await manager.trigger('daily-cron');
  if (manager.running) await manager.running;

  const row = store.state.metadata.get('https://missing.example/');
  assert.equal(row.outcome, 'permanent_error');
  assert.equal(row.retryAt, undefined);
});

test('classifies permanent and retryable metadata failures', () => {
  assert.equal(classifyMetadataError({
    message: 'website_metadata_http_error', errorCode: 'website_metadata_http_error', httpStatus: 404
  }).kind, 'permanent');
  assert.equal(classifyMetadataError({
    message: 'website_metadata_upstream_error', cause: { code: 'ENOTFOUND' }
  }).kind, 'permanent');
  const retryable = classifyMetadataError({
    message: 'website_metadata_http_error', errorCode: 'website_metadata_http_error',
    httpStatus: 429, retryAfterMs: 120000
  });
  assert.equal(retryable.kind, 'retryable');
  assert.ok(new Date(retryable.retryAt).getTime() > Date.now());
  assert.equal(retryDelayMs(1), 60 * 60 * 1000);
  assert.equal(retryDelayMs(2), 6 * 60 * 60 * 1000);
  assert.equal(retryDelayMs(5), 7 * 24 * 60 * 60 * 1000);
  assert.equal(hasUsefulMetadata({ url: 'https://empty.example/', fetchedAt: 'now' }), false);
  assert.equal(hasUsefulMetadata({ url: 'https://hotel.example/', title: 'Hotel' }), true);
});
