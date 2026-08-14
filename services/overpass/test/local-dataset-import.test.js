const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createProgressTracker,
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

test('limits Osmium filters to the selected subcategories', () => {
  const expressions = filterExpressions(['accommodation'], { accommodation: ['hotel'] });
  assert.ok(expressions.includes('nwr/tourism=hotel'));
  assert.ok(!expressions.includes('nwr/tourism=guest_house'));
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
      keepVersions: 1,
      jobId: null,
      subcategories: null
    }
  );
  assert.throws(() => parseArguments(['--unknown']), /Unknown argument/u);
  assert.throws(() => parseArguments(['--categories', 'invalid']), /Categories/u);
});

test('reports a numbered import step and weighted overall progress', async () => {
  const updates = [];
  const tracker = createProgressTracker({ clipToBounds: true }, async (stage, progress, details) => {
    updates.push({ stage, progress, details });
  });

  await tracker.update('downloading', 50, { processedBytes: 50, totalBytes: 100 });
  await tracker.update('filtering', null);

  assert.equal(updates[0].stage, 'downloading');
  assert.equal(updates[0].details.stepNumber, 1);
  assert.equal(updates[0].details.stepCount, 8);
  assert.equal(updates[0].details.stepProgress, 50);
  assert.equal(updates[0].progress, 22);
  assert.equal(updates[1].details.stepNumber, 3);
  assert.equal(updates[1].details.stepProgress, null);
});
