const test = require('node:test');
const assert = require('node:assert/strict');
const { isDatabaseConnected } = require('../routes/root');

test('reports an established database connection after a successful probe', async () => {
  const database = {
    db: {
      get(sql, callback) {
        assert.equal(sql, 'SELECT 1 AS ok');
        callback(null, { ok: 1 });
      }
    }
  };

  assert.equal(await isDatabaseConnected(database), true);
});

test('reports a missing database connection when the probe fails', async () => {
  const database = {
    db: {
      get(_sql, callback) {
        callback(new Error('database unavailable'));
      }
    }
  };

  assert.equal(await isDatabaseConnected(database), false);
  assert.equal(await isDatabaseConnected(null), false);
});
