const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createGeodataImportKeepAlive } = require('../utils/geodataImportKeepAlive');

function setup(t, request = async () => ({ jobs: [] })) {
  const scheduled = new Set();
  const events = new EventEmitter();
  const calls = [];
  const info = [];
  const warnings = [];
  const timers = {
    setTimeout(callback, delay) {
      const timer = { callback, delay, unref() { this.unreferenced = true; } };
      scheduled.add(timer);
      return timer;
    },
    clearTimeout(timer) { scheduled.delete(timer); }
  };
  const monitor = createGeodataImportKeepAlive({
    events, timers,
    requestService: async (...args) => { calls.push(args); return request(...args); },
    logger: { info: (...args) => info.push(args), warn: (...args) => warnings.push(args) }
  });
  t.after(() => monitor.close());
  function fire(delay) {
    assert.equal(scheduled.size, 1, 'exactly one timer, no overlapping loops');
    const [timer] = scheduled;
    assert.equal(timer.delay, delay);
    assert.equal(timer.unreferenced, true);
    scheduled.delete(timer);
    return timer.callback();
  }
  return { monitor, events, calls, info, warnings, scheduled, fire };
}

const queued = { jobs: [{ status: 'queued' }] };
const running = { jobs: [{ status: 'running' }] };
const empty = { jobs: [] };

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test('startup checks once and an empty queue does not cause periodic idle requests', async (t) => {
  const ctx = setup(t);
  ctx.monitor.start();
  ctx.monitor.start();
  assert.equal(ctx.events.listenerCount('changed'), 1);
  await ctx.fire(0);
  assert.deepEqual(ctx.calls, [['get', '/geodata/import-jobs?activeOnly=true', undefined, { timeoutMs: 10000 }]]);
  assert.equal(ctx.scheduled.size, 0);
  assert.equal(ctx.info.length, 0);
});

test('admin restart resumes keep-alive for an existing queue, without browser subscribers', async (t) => {
  const responses = [queued, running, running, empty];
  const ctx = setup(t, async () => responses.shift());
  ctx.monitor.start();
  await ctx.fire(0);
  await ctx.fire(60000);
  await ctx.fire(60000);
  await ctx.fire(60000);
  assert.equal(ctx.calls.length, 4);
  assert.equal(ctx.scheduled.size, 0);
  assert.deepEqual(ctx.info.map(args => args[0]), [
    'Geodata import keep-alive started', 'Geodata import keep-alive stopped: queue empty'
  ]);
});

test('dispatch and service events wake an idle monitor; progress bursts neither multiply nor delay heartbeats', async (t) => {
  let response = empty;
  const ctx = setup(t, async () => response);
  ctx.monitor.start();
  await ctx.fire(0);
  response = queued;
  for (let i = 0; i < 100; i++) ctx.events.emit('changed');
  await ctx.fire(1000);
  for (let i = 0; i < 100; i++) ctx.events.emit('changed');
  await ctx.fire(60000);
  assert.equal(ctx.calls.length, 3);
  response = empty;
  ctx.events.emit('changed');
  await ctx.fire(60000);
  assert.equal(ctx.scheduled.size, 0);
  // A later, separate import starts monitoring again.
  response = running;
  ctx.events.emit('changed');
  await ctx.fire(1000);
  assert.equal(ctx.scheduled.size, 1);
});

test('an event during an empty-queue read is not lost and does not start a parallel request', async (t) => {
  const pending = deferred();
  let response = pending.promise;
  const ctx = setup(t, () => response);
  ctx.monitor.start();
  const check = ctx.fire(0);
  for (let i = 0; i < 100; i++) ctx.events.emit('changed');
  assert.equal(ctx.calls.length, 1);
  assert.equal(ctx.scheduled.size, 0);
  pending.resolve(empty);
  await check;
  response = running;
  await ctx.fire(1000);
  await ctx.fire(60000);
  assert.equal(ctx.calls.length, 3);
});

test('timeouts and HTTP errors do not stop active keep-alive or escape as unhandled rejections', async (t) => {
  let fail = false;
  let response = running;
  const ctx = setup(t, async () => {
    if (fail) throw Object.assign(new Error('unavailable'), { status: 503 });
    return response;
  });
  ctx.monitor.start();
  await ctx.fire(0);
  fail = true;
  for (let i = 0; i < 6; i++) await ctx.fire(60000);
  assert.equal(ctx.warnings.length, 2); // first and fifth failure only
  fail = false;
  response = empty;
  await ctx.fire(60000);
  assert.equal(ctx.scheduled.size, 0);
});

test('startup failures and malformed responses retry until the queue can be reconciled', async (t) => {
  const responses = [() => { throw new Error('timeout'); }, () => ({}), () => empty];
  const ctx = setup(t, async () => responses.shift()());
  ctx.monitor.start();
  await ctx.fire(0);
  await ctx.fire(60000);
  await ctx.fire(60000);
  assert.equal(ctx.scheduled.size, 0);
  assert.equal(ctx.calls.length, 3);
});

test('closing removes timers and listeners and cannot restart the monitor', async (t) => {
  const ctx = setup(t, async () => running);
  ctx.monitor.start();
  await ctx.fire(0);
  ctx.monitor.close();
  ctx.events.emit('changed');
  ctx.monitor.start();
  assert.equal(ctx.scheduled.size, 0);
  assert.equal(ctx.events.listenerCount('changed'), 0);
});

test('closing during a pending request prevents retries, events and logs after completion', async (t) => {
  for (const fail of [false, true]) {
    const pending = deferred();
    const ctx = setup(t, () => pending.promise);
    ctx.monitor.start();
    const check = ctx.fire(0);
    ctx.events.emit('changed');
    ctx.monitor.close();
    if (fail) pending.reject(new Error('offline'));
    else pending.resolve(running);
    await check;
    assert.equal(ctx.scheduled.size, 0);
    assert.equal(ctx.info.length, 0);
    assert.equal(ctx.warnings.length, 0);
  }
});
