const test = require('node:test');
const assert = require('node:assert/strict');
const { validateNearbyRequest, bboxArea } = require('../validation');

test('validates and normalizes a bounded nearby request', () => {
  const result = validateNearbyRequest({
    bounds: { south: 52.1, west: 10.1, north: 52.2, east: 10.2 },
    categories: ['hotel', 'hotel', 'tourism'],
    limit: 50
  }, { maxBboxArea: 0.05, maxResults: 100 });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.categories, ['hotel', 'tourism']);
  assert.equal(result.value.limit, 50);
});

test('rejects unknown categories and oversized viewports', () => {
  assert.equal(validateNearbyRequest({
    bounds: { south: 52.1, west: 10.1, north: 52.2, east: 10.2 },
    categories: ['anything']
  }).message, 'invalid_nearby_categories');
  assert.equal(validateNearbyRequest({
    bounds: { south: 50, west: 5, north: 55, east: 15 }, categories: ['hotel']
  }, { maxBboxArea: 0.05 }).message, 'nearby_viewport_too_large');
});

test('calculates the simple viewport area', () => {
  assert.equal(bboxArea({ south: 1, west: 2, north: 1.5, east: 3 }), 0.5);
});
