const test = require('node:test');
const assert = require('node:assert/strict');
const { buildNearbyQuery } = require('../query-builder');

test('builds a fixed allowlisted query with an output limit', () => {
  const query = buildNearbyQuery({
    bounds: { south: 52.1, west: 10.1, north: 52.2, east: 10.2 },
    categories: ['accommodation'],
    subcategories: { accommodation: ['hotel'] },
    limit: 25
  }, { timeoutSeconds: 12 });
  assert.match(query, /^\[out:json\]\[timeout:12\];/u);
  assert.match(query, /nwr\["tourism"="hotel"\]\(52\.1,10\.1,52\.2,10\.2\);/u);
  assert.match(query, /nwr\["building"="hotel"\]\(52\.1,10\.1,52\.2,10\.2\);/u);
  assert.match(query, /out tags center qt 25;/u);
});

test('only emits selected allowlisted subcategories', () => {
  const query = buildNearbyQuery({
    bounds: { south: 52.1, west: 10.1, north: 52.2, east: 10.2 },
    categories: ['amenities'],
    subcategories: { amenities: ['toilets'] },
    limit: 25
  });
  assert.match(query, /nwr\["amenity"="toilets"\]\["access"!~"\^\(private\|customers\|no\)\$"\]/u);
  assert.doesNotMatch(query, /restaurant/u);
});

test('queries selected religious buildings and places of worship', () => {
  const query = buildNearbyQuery({
    bounds: { south: 52.1, west: 10.1, north: 52.2, east: 10.2 },
    categories: ['religion'],
    subcategories: { religion: ['church', 'place_of_worship'] },
    limit: 25
  });
  assert.match(query, /nwr\["building"="church"\]/u);
  assert.match(query, /nwr\["amenity"="place_of_worship"\]/u);
  assert.doesNotMatch(query, /building"="cathedral/u);
});

test('queries selected public authorities', () => {
  const query = buildNearbyQuery({
    bounds: { south: 52.1, west: 10.1, north: 52.2, east: 10.2 },
    categories: ['amenities'],
    subcategories: { amenities: ['townhall', 'tax_office', 'government_office'] },
    limit: 25
  });
  assert.match(query, /nwr\["amenity"="townhall"\]/u);
  assert.match(query, /nwr\["government"="tax"\]/u);
  assert.match(query, /nwr\["office"="government"\]/u);
  assert.doesNotMatch(query, /courthouse/u);
});
