const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {
  createProgressTracker,
  createImportConfigHash,
  featureToElement,
  filterExpressions,
  geometryCenter,
  isImportCurrent,
  isSourceCurrent,
  parseArguments,
  readPois,
  sourceInfoFromHeaders
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

test('uses the Geodata-compatible bounding-box centre for polygon features', () => {
  assert.deepEqual(geometryCenter({
    type: 'Polygon',
    coordinates: [[[10, 52], [12, 52], [12, 54], [10, 52]]]
  }), { latitude: 53, longitude: 11 });
});

test('parses the repeatable Wolfenbuettel import options', () => {
  const defaults = parseArguments([]);
  assert.equal(defaults.dataset, 'wolfenbuettel');
  assert.equal(defaults.refresh, false);
  assert.equal(defaults.force, false);
  assert.equal(defaults.keepVersions, 0);
  assert.ok(defaults.categories.includes('accommodation'));
  assert.deepEqual(
    parseArguments(['--refresh', '--categories', 'accommodation,amenities', '--keep-versions', '1']),
    {
      dataset: 'wolfenbuettel',
      refresh: true,
      force: false,
      categories: ['accommodation', 'amenities'],
      keepVersions: 1,
      jobId: null,
      subcategories: null
    }
  );
  assert.equal(parseArguments(['--force']).force, true);
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
  assert.equal(updates[0].details.stepNumber, 2);
  assert.equal(updates[0].details.stepCount, 11);
  assert.equal(updates[0].details.stepProgress, 50);
  assert.equal(updates[0].progress, 20);
  assert.equal(updates[1].details.stepNumber, 4);
  assert.equal(updates[1].details.stepProgress, null);
});

test('detects unchanged sources only when source and import configuration match', () => {
  const configHash = createImportConfigHash(['amenities', 'accommodation'], {
    accommodation: ['hotel'], amenities: ['toilets']
  });
  assert.equal(configHash, createImportConfigHash(['accommodation', 'amenities'], {
    amenities: ['toilets'], accommodation: ['hotel']
  }));
  const active = {
    sourceUrl: 'https://download.test/germany-latest.osm.pbf', sourceEtag: '"v2"',
    sourceTimestamp: '2026-08-17T04:00:00.000Z', importConfigHash: configHash,
    exportStatus: 'ready'
  };
  assert.equal(isImportCurrent(active, { etag: '"v2"' }, configHash, active.sourceUrl), true);
  assert.equal(isImportCurrent(active, { etag: '"v3"' }, configHash, active.sourceUrl), false);
  assert.equal(isImportCurrent(active, { etag: '"v2"' }, 'different', active.sourceUrl), false);
  assert.equal(isImportCurrent({ ...active, exportStatus: null }, { etag: '"v2"' }, configHash, active.sourceUrl), false);
  assert.equal(isSourceCurrent({ ...active, exportStatus: null }, { etag: '"v2"' }, configHash, active.sourceUrl), true);
});

test('reads ETag, timestamp and size from the final successful HTTP response', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'geodata-headers-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const headersPath = path.join(directory, 'headers.txt');
  await fs.writeFile(headersPath, [
    'HTTP/1.1 302 Found', 'location: https://download.test/current.pbf', '',
    'HTTP/2 200', 'etag: "source-v2"', 'last-modified: Sun, 17 Aug 2026 04:00:00 GMT',
    'content-length: 4294967296', '', ''
  ].join('\r\n'));
  assert.deepEqual(await sourceInfoFromHeaders(headersPath), {
    etag: '"source-v2"', lastModified: '2026-08-17T04:00:00.000Z', contentLength: 4294967296
  });
});

test('reads record-separated GeoJSON with line breaks in OSM tag values', async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'geodata-geojsonseq-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const inputPath = path.join(directory, 'pois.geojsonseq');
  const records = [
    '{"type":"Feature","geometry":{"type":"Point","coordinates":[10.5,52.1]},"properties":{"@type":"node","@id":1,"tourism":"hotel","name":"Hotel first line\nsecond line"}}',
    '{"type":"Feature","geometry":{"type":"Point","coordinates":[10.6,52.2]},"properties":{"@type":"node","@id":2,"amenity":"toilets","name":"WC"}}'
  ];
  await fs.writeFile(inputPath, `\x1e${records[0]}\n\x1e${records[1]}\n`);

  const batches = [];
  const count = await readPois(inputPath, ['accommodation', 'amenities'], {
    accommodation: ['hotel'], amenities: ['toilets']
  }, async (batch) => batches.push(...batch));

  assert.equal(count, 2);
  assert.equal(batches[0].name, 'Hotel first line\nsecond line');
  assert.equal(batches[1].subtype, 'toilets');
});
