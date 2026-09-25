const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const table = require('../db/tableGeodataPoi');

function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  t.after(() => sqlite.close());
  sqlite.exec(`CREATE TABLE tableGeodataImportJob (
    jobId TEXT, status TEXT, stage TEXT, progress INTEGER, stepNumber INTEGER,
    stepCount INTEGER, stepProgress INTEGER, processedBytes BIGINT, totalBytes BIGINT,
    processedItems BIGINT, stepStartedAt TEXT, startedAt TEXT, completedAt TEXT,
    versionId TEXT, sourceChanged BOOLEAN, error TEXT, downloadedBytes BIGINT, importedRecords BIGINT
  ); INSERT INTO tableGeodataImportJob(jobId, status) VALUES ('job', 'queued')`);
  const db = { run(sql, params, cb) { sqlite.prepare(sql).run(...params); cb?.(null); } };
  const read = () => sqlite.prepare('SELECT * FROM tableGeodataImportJob').get();
  return { db, read };
}

test('download bytes survive phase changes and final records are separate from export progress', (t) => {
  const { db, read } = fixture(t);
  table.startJob(db, 'job');
  assert.equal(read().downloadedBytes, 0);
  table.updateJobProgress(db, 'job', 'downloading', 20, { processedBytes: 1500000000 });
  table.updateJobProgress(db, 'job', 'importing', 50, { processedBytes: 4000000000, processedItems: 500 });
  assert.equal(read().downloadedBytes, 1500000000);
  assert.equal(read().importedRecords, null); // Exact count not finalized yet.
  table.recordImportCount(db, 'job', 490); // Parsed duplicates do not inflate this count.
  table.updateJobProgress(db, 'job', 'exporting', 80, { processedBytes: 999, processedItems: 100 });
  table.updateJobProgress(db, 'job', 'cleanup', 99, {});
  assert.equal(read().downloadedBytes, 1500000000);
  assert.equal(read().importedRecords, 490);
  table.failJob(db, 'job', 'export failed');
  assert.equal(read().downloadedBytes, 1500000000);
  assert.equal(read().importedRecords, 490);
});

test('unchanged countries have zero new downloads and records, not the size of their existing data', (t) => {
  const { db, read } = fixture(t);
  table.startJob(db, 'job');
  table.updateJobProgress(db, 'job', 'exporting', 80, { processedItems: 900 });
  table.completeUnchangedJob(db, 'job', 'existing-version');
  assert.equal(read().status, 'succeeded');
  assert.equal(read().downloadedBytes, 0);
  assert.equal(read().importedRecords, 0);
});

test('old jobs retain unknown metrics and migration adds nullable columns idempotently', (t) => {
  const { read } = fixture(t);
  assert.equal(read().downloadedBytes, null);
  assert.equal(read().importedRecords, null);
  const statements = [];
  table.init({ run(sql, _params, cb) { statements.push(sql); cb(null); } }, () => {});
  for (const column of ['downloadedBytes', 'importedRecords']) {
    assert.ok(statements.some(sql => sql.includes(`ADD COLUMN IF NOT EXISTS ${column} BIGINT`)));
    assert.ok(statements.filter(sql => sql.includes(`ADD COLUMN IF NOT EXISTS ${column}`)).every(sql => !sql.includes('DEFAULT 0')));
  }
});

test('an interrupted download records its final partial file size before cleanup', async (t) => {
  const { spawnSync } = require('node:child_process');
  if (spawnSync('curl', ['--version']).status !== 0) return t.skip('curl unavailable');
  const { createServer } = require('node:http');
  const fs = require('node:fs/promises');
  const path = require('node:path');
  const os = require('node:os');
  const { downloadWithProgress } = require('../scripts/import-local-dataset');
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'geodata-statistics-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Length': '1000' });
    res.write('partial-data');
    setTimeout(() => res.destroy(), 50);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const output = path.join(directory, 'dataset.part');
  const headers = path.join(directory, 'headers');
  const metrics = [];
  await assert.rejects(downloadWithProgress([
    '--silent', '--fail', '--max-time', '5', '--dump-header', headers, '--output', output,
    `http://127.0.0.1:${server.address().port}/data`
  ], output, headers, async (_progress, value) => metrics.push(value)), /curl failed/);
  assert.equal(metrics.at(-1).processedBytes, (await fs.stat(output)).size);
  assert.ok(metrics.at(-1).processedBytes > 0);
  assert.ok(metrics.at(-1).processedBytes < 1000);
});
