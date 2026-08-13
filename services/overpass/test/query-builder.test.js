const test = require('node:test');
const assert = require('node:assert/strict');
const { buildNearbyQuery } = require('../query-builder');

test('builds a fixed allowlisted query with an output limit', () => {
  const query = buildNearbyQuery({
    bounds: { south: 52.1, west: 10.1, north: 52.2, east: 10.2 },
    categories: ['hotel'],
    limit: 25
  }, { timeoutSeconds: 12 });
  assert.match(query, /^\[out:json\]\[timeout:12\];/u);
  assert.match(query, /nwr\["tourism"="hotel"\]\(52\.1,10\.1,52\.2,10\.2\);/u);
  assert.match(query, /nwr\["building"="hotel"\]\(52\.1,10\.1,52\.2,10\.2\);/u);
  assert.match(query, /out tags center qt 25;/u);
});
