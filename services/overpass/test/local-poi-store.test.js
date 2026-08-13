const test = require('node:test');
const assert = require('node:assert/strict');
const { LocalPoiStore } = require('../local-poi-store');

function request() {
  return {
    bounds: { south: 52.1, west: 10.5, north: 52.2, east: 10.6 },
    categories: ['accommodation'],
    subcategories: { accommodation: ['hotel'] },
    limit: 200
  };
}

test('serves a covered viewport from the local dataset, including empty results', async () => {
  const database = { db: {
    get(_sql, _params, callback) {
      callback(null, {
        datasetId: 'wolfenbuettel', versionId: 'version-2', sourceUrl: 'https://example.test/data.pbf',
        importedAt: '2026-08-13T12:00:00Z', sourceTimestamp: null
      });
    },
    all(_sql, _params, callback) { callback(null, []); }
  } };
  const store = new LocalPoiStore({ database });
  const result = await store.getNearby(request());
  assert.equal(result.status, 200);
  assert.equal(result.count, 0);
  assert.equal(result.source.type, 'local-dataset');
  assert.equal(result.source.versionId, 'version-2');
  assert.equal(store.snapshot().hits, 1);
});

test('returns undefined when no imported dataset covers the viewport', async () => {
  const database = { db: {
    get(_sql, _params, callback) { callback(null, null); }
  } };
  const store = new LocalPoiStore({ database });
  assert.equal(await store.getNearby(request()), undefined);
  assert.equal(store.snapshot().misses, 1);
});

test('returns the PostgreSQL database size as a JSON number', async () => {
  const database = { db: {
    get(_sql, _params, callback) {
      callback(null, {
        datasetCount: 1, poiCount: 91371, websitePoiCount: 2400, websiteMetadataPoiCount: 1800,
        importedAt: '2026-08-13T18:21:33Z', databaseBytes: '73400320'
      });
    }
  } };
  const status = await new LocalPoiStore({ database }).status();
  assert.equal(status.databaseBytes, 73400320);
  assert.equal(status.websitePoiCount, 2400);
  assert.equal(status.websiteMetadataPoiCount, 1800);
});

test('adds stored website metadata to local POI results', async () => {
  const payload = { id: 'osm:node:42', contact: { website: 'https://hotel.example' } };
  const database = { db: {
    get(_sql, _params, callback) {
      callback(null, { datasetId: 'germany', versionId: 'v1', sourceUrl: 'https://example.test/germany.pbf' });
    },
    all(_sql, _params, callback) {
      callback(null, [{ payload, websiteMetadata: { title: 'Example Hotel' } }]);
    }
  } };
  const result = await new LocalPoiStore({ database }).getNearby(request());
  assert.deepEqual(result.pois[0].websiteMetadata, { title: 'Example Hotel' });
});
