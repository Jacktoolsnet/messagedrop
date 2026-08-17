const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { downloadDirectory, ensureDownloadDirectory } = require('../storage-paths');

test('creates the configured download directory recursively', async () => {
  const previous = process.env.GEODATA_DOWNLOAD_DIR;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'geodata-downloads-'));
  const expected = path.join(root, 'nested', 'downloads');
  try {
    process.env.GEODATA_DOWNLOAD_DIR = expected;
    assert.equal(downloadDirectory(), expected);
    assert.equal(await ensureDownloadDirectory(), expected);
    assert.equal((await fs.stat(expected)).isDirectory(), true);
  } finally {
    if (previous === undefined) delete process.env.GEODATA_DOWNLOAD_DIR;
    else process.env.GEODATA_DOWNLOAD_DIR = previous;
    await fs.rm(root, { recursive: true, force: true });
  }
});
