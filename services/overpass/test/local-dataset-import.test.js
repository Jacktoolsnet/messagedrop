const test = require('node:test');
const assert = require('node:assert/strict');
const {
  featureToElement,
  filterExpressions,
  geometryCenter,
  parseArguments
} = require('../scripts/import-local-dataset');
const { normalizeElement } = require('../normalizer');

test('creates Osmium filters from the shared category definitions', () => {
  const expressions = filterExpressions();
  assert.ok(expressions.includes('nwr/tourism=hotel'));
  assert.ok(expressions.includes('nwr/building=hotel'));
  assert.ok(expressions.includes('nwr/amenity=toilets'));
  assert.equal(new Set(expressions).size, expressions.length);
});

test('converts exported GeoJSON points into normalizable OSM elements', () => {
  const element = featureToElement({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [10.54082, 52.15889] },
    properties: { '@type': 'node', '@id': 42, tourism: 'hotel', name: 'Altes Kaffeehaus' }
  });
  const poi = normalizeElement(element, ['accommodation'], { accommodation: ['hotel'] });
  assert.equal(poi.id, 'osm:node:42');
  assert.equal(poi.name, 'Altes Kaffeehaus');
  assert.equal(poi.latitude, 52.15889);
  assert.equal(poi.longitude, 10.54082);
});

test('uses the Overpass-compatible bounding-box centre for polygon features', () => {
  assert.deepEqual(geometryCenter({
    type: 'Polygon',
    coordinates: [[[10, 52], [12, 52], [12, 54], [10, 52]]]
  }), { latitude: 53, longitude: 11 });
});

test('parses the repeatable Wolfenbuettel import options', () => {
  const defaults = parseArguments([]);
  assert.equal(defaults.dataset, 'wolfenbuettel');
  assert.equal(defaults.refresh, false);
  assert.equal(defaults.keepVersions, 0);
  assert.ok(defaults.categories.includes('accommodation'));
  assert.deepEqual(
    parseArguments(['--refresh', '--categories', 'accommodation,amenities', '--keep-versions', '1']),
    {
      dataset: 'wolfenbuettel',
      refresh: true,
      categories: ['accommodation', 'amenities'],
      keepVersions: 1
    }
  );
  assert.throws(() => parseArguments(['--unknown']), /Unknown argument/u);
  assert.throws(() => parseArguments(['--categories', 'invalid']), /Categories/u);
});
