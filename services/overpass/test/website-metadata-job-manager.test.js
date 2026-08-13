const test = require('node:test');
const assert = require('node:assert/strict');
const { WebsiteMetadataJobManager } = require('../website-metadata-job-manager');

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
    markFetching(_db, url, callback) { state.metadata.get(url).status = 'fetching'; done(callback); },
    markSucceeded(_db, url, metadata, _days, callback) {
      Object.assign(state.metadata.get(url), { status: 'succeeded', metadata }); done(callback);
    },
    markFailed(_db, url, error, _hours, callback) {
      Object.assign(state.metadata.get(url), { status: 'failed', error }); done(callback);
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
  assert.equal(store.state.metadata.get('https://broken.example/').status, 'failed');
});
