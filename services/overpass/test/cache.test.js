const test = require('node:test');
const assert = require('node:assert/strict');
const { BoundedTtlCache } = require('../cache');

test('expires and bounds cached payloads', () => {
  let now = 0;
  const cache = new BoundedTtlCache({ ttlMs: 10, maxEntries: 1, maxBytes: 1000, now: () => now });
  cache.set('one', { value: 1 });
  assert.deepEqual(cache.get('one'), { value: 1 });
  cache.set('two', { value: 2 });
  assert.equal(cache.get('one'), undefined);
  now = 11;
  assert.equal(cache.get('two'), undefined);
});
