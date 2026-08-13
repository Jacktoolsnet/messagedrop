const test = require('node:test');
const assert = require('node:assert/strict');
const { coalesce } = require('../routes/overpass');

test('coalesces identical in-flight requests', async () => {
  const inFlight = new Map();
  let calls = 0;
  let resolveFactory;
  const factory = () => {
    calls += 1;
    return new Promise((resolve) => { resolveFactory = resolve; });
  };
  const first = coalesce(inFlight, 'same', 2, factory);
  const second = coalesce(inFlight, 'same', 2, factory);
  await Promise.resolve();
  resolveFactory({ status: 200 });
  assert.deepEqual(await Promise.all([first, second]), [{ status: 200 }, { status: 200 }]);
  assert.equal(calls, 1);
  assert.equal(inFlight.size, 0);
});

test('rejects excess distinct in-flight requests', async () => {
  const inFlight = new Map([['busy', new Promise(() => {})]]);
  await assert.rejects(
    coalesce(inFlight, 'new', 1, async () => ({})),
    (error) => error.message === 'overpass_service_busy' && error.status === 503
  );
});
