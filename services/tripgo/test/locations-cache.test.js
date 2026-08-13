const test = require('node:test');
const assert = require('node:assert/strict');
const { PersistentLocationsCache } = require('../locations-cache');

function fakeDatabase() {
  const rows = new Map();
  return {
    rows,
    database: {
      db: {
        get(_sql, [key], callback) {
          callback(null, rows.get(key) || null);
        },
        run(sql, params, callback) {
          if (sql.includes('INSERT INTO')) {
            rows.set(params[0], {
              cacheKey: params[0],
              payload: JSON.parse(params[1]),
              fetchedAt: new Date('2026-08-13T08:00:00Z'),
              lastAccessed: new Date('2026-08-13T08:00:00Z')
            });
          }
          callback?.(null);
        }
      }
    }
  };
}

test('stores and reads persistent location payloads with their age', async () => {
  const fake = fakeDatabase();
  const cache = new PersistentLocationsCache({
    database: fake.database,
    now: () => Date.parse('2026-08-13T10:00:00Z')
  });
  const payload = { status: 200, data: { region: 'DE_NI_Hanover', stops: [] } };

  assert.equal(await cache.set('cell-key', payload), true);
  assert.deepEqual(await cache.get('cell-key'), {
    payload,
    fetchedAt: Date.parse('2026-08-13T08:00:00Z'),
    ageMs: 2 * 60 * 60 * 1000
  });
  assert.equal(cache.snapshot().writes, 1);
  assert.equal(cache.snapshot().hits, 1);
});

test('treats database failures as cache misses', async () => {
  const warnings = [];
  const cache = new PersistentLocationsCache({
    database: {
      db: {
        get(_sql, _params, callback) { callback(new Error('offline')); }
      }
    },
    logger: { warn: (...args) => warnings.push(args) }
  });

  assert.equal(await cache.get('missing'), undefined);
  assert.equal(cache.snapshot().errors, 1);
  assert.equal(warnings.length, 1);
});
