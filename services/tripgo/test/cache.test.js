const test = require('node:test');
const assert = require('node:assert/strict');
const { BoundedTtlCache } = require('../cache');

test('bounded cache expires entries', () => {
  let now = 1000;
  const cache = new BoundedTtlCache({ ttlMs: 50, maxEntries: 10, maxBytes: 1024, now: () => now });
  cache.set('key', { value: 1 });
  assert.deepEqual(cache.get('key'), { value: 1 });
  now += 51;
  assert.equal(cache.get('key'), undefined);
  assert.equal(cache.snapshot().entries, 0);
});

test('bounded cache evicts least recently used entries', () => {
  const cache = new BoundedTtlCache({ ttlMs: 1000, maxEntries: 2, maxBytes: 1024 });
  cache.set('first', 'one');
  cache.set('second', 'two');
  cache.get('first');
  cache.set('third', 'three');
  assert.equal(cache.get('second'), undefined);
  assert.equal(cache.get('first'), 'one');
  assert.equal(cache.get('third'), 'three');
});

test('bounded cache rejects values larger than its byte budget', () => {
  const cache = new BoundedTtlCache({ ttlMs: 1000, maxEntries: 2, maxBytes: 8 });
  assert.equal(cache.set('large', '123456789'), false);
  assert.equal(cache.snapshot().rejected, 1);
});
