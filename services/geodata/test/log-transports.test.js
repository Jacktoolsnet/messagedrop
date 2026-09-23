const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const winston = require('winston');
const { createFileTransports } = require('../utils/logTransports');

test('writes each severity only to its own daily file, including metadata', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'geodata-log-test-'));
  const transports = createFileTransports(directory, {
    LOG_RETENTION_INFO: '3d', LOG_RETENTION_WARN: '5d', LOG_RETENTION_ERROR: '7d'
  });
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    transports
  });
  try {
    assert.deepEqual(transports.map(transport => transport.options.maxFiles), ['3d', '5d', '7d']);
    logger.info('test-info', { datasetId: 'germany' });
    logger.warn('test-warn', { datasetId: 'germany' });
    logger.error('test-error', { datasetId: 'germany' });
    // File writes are asynchronous; wait for the real transport output.
    for (let attempt = 0; attempt < 100; attempt++) {
      const files = (await fs.readdir(directory)).filter(file => file.endsWith('.log'));
      const content = await Promise.all(files.map(file => fs.readFile(path.join(directory, file), 'utf8')));
      if (files.length === 3 && content.every(text => text.includes('test-'))) break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const files = (await fs.readdir(directory)).filter(file => file.endsWith('.log'));
    assert.equal(files.length, 3);
    for (const level of ['info', 'warn', 'error']) {
      const file = files.find(name => name.startsWith(`geodata-${level}-`));
      assert.ok(file);
      const lines = (await fs.readFile(path.join(directory, file), 'utf8')).trim().split('\n');
      assert.equal(lines.length, 1);
      assert.match(lines[0], new RegExp(`\\[${level.toUpperCase()}\\] test-${level}`));
      assert.match(lines[0], /"datasetId":"germany"/);
    }
  } finally {
    logger.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('warn retention falls back to info; error keeps its own default', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'geodata-retention-test-'));
  const transports = createFileTransports(directory, { LOG_RETENTION_INFO: '4d' });
  try {
    assert.deepEqual(transports.map(transport => transport.options.maxFiles), ['4d', '4d', '2d']);
  } finally {
    await Promise.all(transports.map(transport => new Promise(resolve => {
      transport.logStream.end(resolve);
    })));
    for (const transport of transports) transport.close();
    await fs.rm(directory, { recursive: true, force: true });
  }
});
