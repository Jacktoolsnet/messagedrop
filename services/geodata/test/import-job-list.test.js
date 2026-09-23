const test = require('node:test');
const assert = require('node:assert/strict');
const table = require('../db/tableGeodataPoi');

test('explicit job IDs are parameterized without the recent-job limit', () => {
  const jobIds = Array.from({ length: 50 }, (_, i) => 'job-' + i);
  table.listJobs({
    all(sql, params, cb) {
      assert.match(sql, /WHERE jobId IN/);
      assert.doesNotMatch(sql, /LIMIT/);
      assert.deepEqual(params, jobIds);
      assert.equal((sql.match(/\?/g) || []).length, 50);
      cb(null, []);
    }
  }, 20, () => {}, { jobIds });
});

test('legacy list includes all active jobs and jobs since the oldest active job', () => {
  table.listJobs({
    all(sql, params, cb) {
      assert.match(sql, /status IN \('queued', 'running'\)/);
      assert.match(sql, /MIN\(createdAt\)/);
      assert.deepEqual(params, [20]);
      cb(null, []);
    }
  }, undefined, () => {}, { includeActive: true });
});

test('ordinary history requests keep their bounded limit', () => {
  table.listJobs({
    all(sql, params, cb) {
      assert.match(sql, /ORDER BY createdAt DESC LIMIT \?/);
      assert.deepEqual(params, [100]);
      cb(null, []);
    }
  }, 999, () => {});
});
