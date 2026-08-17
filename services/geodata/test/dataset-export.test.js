const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { generateDatasetExport, serializePoi, validateJsonlGzip } = require('../dataset-export');

function poi(id, category = 'accommodation', subtype = 'hotel') {
  return {
    id: `osm:node:${id}`, osmType: 'node', osmId: id, category, subtype,
    name: `POI ${id}`, latitude: 52 + id / 100, longitude: 10 + id / 100,
    address: {}, contact: {}, properties: {},
    source: { provider: 'OpenStreetMap', url: `https://www.openstreetmap.org/node/${id}` }
  };
}

test('creates and validates an immutable versioned JSONL gzip export', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'geodata-export-'));
  const previous = process.env.GEODATA_EXPORT_DIR;
  process.env.GEODATA_EXPORT_DIR = root;
  t.after(async () => {
    if (previous === undefined) delete process.env.GEODATA_EXPORT_DIR;
    else process.env.GEODATA_EXPORT_DIR = previous;
    await fs.rm(root, { recursive: true, force: true });
  });
  const rows = [poi(1), poi(2, 'amenities', 'toilets')]
    .map((payload) => ({ osmType: payload.osmType, osmId: payload.osmId, payload }));
  let page = 0;
  let completed;
  const db = {
    run(sql, params, callback) {
      if (sql.includes("SET status = 'ready'")) completed = params;
      callback(null);
    },
    all(sql, _params, callback) {
      if (!sql.includes('FROM tableGeodataPoiVersion')) return callback(null, []);
      callback(null, page++ === 0 ? rows : []);
    }
  };
  const result = await generateDatasetExport({
    database: { db }, versionId: 'version-1', expectedCount: 2,
    dataset: {
      id: 'germany', countryCode: 'DE', sourceUrl: 'https://download.test/germany.osm.pbf',
      sourceTimestamp: '2026-08-17T00:00:00.000Z', sourceEtag: '"v1"',
      bounds: { south: 47, west: 5, north: 56, east: 16 },
      importConfig: { categories: ['accommodation', 'amenities'], subcategories: {
        accommodation: ['hotel'], amenities: ['toilets']
      } }
    }
  });

  assert.equal(result.databaseVersion, 'version-1');
  assert.equal(result.exportVersion, 'version-1');
  assert.equal(result.recordCount, 2);
  assert.equal(result.countryCodes[0], 'DE');
  assert.match(result.sha256, /^[a-f0-9]{64}$/u);
  assert.ok(completed);
  const directory = path.join(root, 'datasets', 'germany', 'version-1');
  assert.equal((await validateJsonlGzip(path.join(directory, 'pois.jsonl.gz'), 2)).recordCount, 2);
  const metadata = JSON.parse(await fs.readFile(path.join(directory, 'metadata.json'), 'utf8'));
  assert.equal(metadata.sha256, result.sha256);
  assert.match(await fs.readFile(path.join(directory, 'LICENSE.txt'), 'utf8'), /Open Database License 1\.0/u);
});

test('rejects an export when the database count does not match', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'geodata-export-failed-'));
  const previous = process.env.GEODATA_EXPORT_DIR;
  process.env.GEODATA_EXPORT_DIR = root;
  t.after(async () => {
    if (previous === undefined) delete process.env.GEODATA_EXPORT_DIR;
    else process.env.GEODATA_EXPORT_DIR = previous;
    await fs.rm(root, { recursive: true, force: true });
  });
  let page = 0;
  const db = {
    run(_sql, _params, callback) { callback(null); },
    all(_sql, _params, callback) { callback(null, page++ === 0 ? [{ osmType: 'node', osmId: 1, payload: poi(1) }] : []); }
  };
  await assert.rejects(() => generateDatasetExport({
    database: { db }, versionId: 'version-2', expectedCount: 2,
    dataset: { id: 'germany', sourceUrl: 'https://download.test/germany.osm.pbf', bounds: {} }
  }), /Exported 1 POIs/u);
});

test('serializes Unicode line separators without breaking JSONL records', () => {
  const value = poi(3);
  value.properties.description = 'first\u2028second\u2029third\nlast';
  const serialized = serializePoi(value);
  assert.ok(!serialized.includes('\u2028'));
  assert.ok(!serialized.includes('\u2029'));
  assert.equal(JSON.parse(serialized).properties.description, value.properties.description);
});
