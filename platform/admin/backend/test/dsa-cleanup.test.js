const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { cleanupClosedDsaCases } = require('../utils/dsaCleanup');

test('cleanup uses the aggregate expression rather than a SELECT alias in HAVING', async () => {
  const queries = [];
  const result = await cleanupClosedDsaCases({
    all(sql, params, callback) {
      queries.push({ sql, params });
      callback(null, []);
    },
    run() { assert.fail('No cases selected; nothing should be deleted'); }
  }, { info() {} });
  const { sql, params } = queries[0];
  assert.match(sql, /HAVING COALESCE\(MAX\(d\.decidedAt\), n\.updatedAt\) <= \?/);
  assert.doesNotMatch(sql, /HAVING\s+closedAt/i);
  assert.equal(params[0], 'FORWARD_TO_AUTHORITY');
  assert.ok(Number.isFinite(params[1]));
  assert.equal(result.notices, 0);
  assert.equal(result.signals, 0);

  // Verify selection semantics against isolated fixtures; no application DB is used.
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`
      CREATE TABLE tableDsaNotice (id TEXT PRIMARY KEY, status TEXT, updatedAt INTEGER);
      CREATE TABLE tableDsaDecision (id TEXT PRIMARY KEY, noticeId TEXT, decidedAt INTEGER, outcome TEXT);
    `);
    const threshold = params[1];
    const notice = db.prepare('INSERT INTO tableDsaNotice VALUES (?, ?, ?)');
    for (const [id, status, time] of [
      ['old', 'DECIDED', threshold - 10],
      ['recent', 'DECIDED', threshold + 10],
      ['fallback', 'DECIDED', threshold - 10],
      ['boundary', 'DECIDED', threshold],
      ['open', 'UNDER_REVIEW', threshold - 10],
      ['held', 'DECIDED', threshold - 10],
      ['multiple', 'DECIDED', threshold - 10]
    ]) notice.run(id, status, time);
    const decision = db.prepare('INSERT INTO tableDsaDecision VALUES (?, ?, ?, ?)');
    decision.run('d1', 'old', threshold - 10, 'NO_ACTION');
    decision.run('d2', 'recent', threshold + 10, 'NO_ACTION');
    decision.run('d3', 'held', threshold - 10, 'FORWARD_TO_AUTHORITY');
    decision.run('d4', 'multiple', threshold - 20, 'NO_ACTION');
    decision.run('d5', 'multiple', threshold + 10, 'NO_ACTION');
    assert.deepEqual(db.prepare(sql).all(...params).map(row => row.id).sort(), ['boundary', 'fallback', 'old']);
  } finally {
    db.close();
  }
});

test('a failed selection stops cleanup before any deletion', async () => {
  await assert.rejects(cleanupClosedDsaCases({
    all(_sql, _params, callback) { callback(new Error('query failed')); },
    run() { assert.fail('Must not delete after a query failure'); }
  }, { info() {} }), /query failed/);
});
