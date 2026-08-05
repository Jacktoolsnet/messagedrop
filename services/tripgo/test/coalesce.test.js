const test = require('node:test');
const assert = require('node:assert/strict');
const { coalesce } = require('../routes/tripgo');

test('coalesces identical requests and removes them after completion', async () => {
  const inFlight = new Map();
  let calls = 0;
  let resolveRequest;
  const factory = () => {
    calls += 1;
    return new Promise((resolve) => { resolveRequest = resolve; });
  };
  const first = coalesce(inFlight, 'same', 10, factory);
  const second = coalesce(inFlight, 'same', 10, factory);
  assert.equal(calls, 1);
  resolveRequest({ ok: true });
  assert.deepEqual(await first, { ok: true });
  assert.deepEqual(await second, { ok: true });
  assert.equal(inFlight.size, 0);
});

test('rejects new work at the concurrency limit', async () => {
  const inFlight = new Map([['busy', new Promise(() => {})]]);
  await assert.rejects(() => coalesce(inFlight, 'new', 1, async () => ({})), {
    message: 'tripgo_service_busy', status: 503
  });
});
