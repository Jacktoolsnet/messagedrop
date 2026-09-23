const test = require('node:test');
const assert = require('node:assert/strict');
const { formatForwardMessage } = require('../utils/adminLogForwarder');

test('includes Winston metadata in forwarded administration log messages', () => {
  const message = formatForwardMessage(['Request error', {
    traceId: 'trace-1', status: 400, errorCode: 'BAD_REQUEST', detail: 'unknown_import_dataset'
  }]);

  assert.match(message, /^Request error /);
  assert.match(message, /"traceId":"trace-1"/);
  assert.match(message, /"status":400/);
  assert.match(message, /"detail":"unknown_import_dataset"/);
});

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function forwardingWith(post) {
  const context = {
    module: { exports: {} },
    require: name => name === 'axios' ? { post } : { signServiceJwt: async () => 'signed' }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../utils/adminLogForwarder.js'), 'utf8'), context);
  const local = [];
  const logger = Object.fromEntries(['info', 'warn', 'error'].map(level => [level, (...args) => local.push({ level, args })]));
  context.module.exports.attachForwarding(logger, { baseUrl: 'http://admin.test', audience: 'service.admin-backend' });
  return { logger, local };
}

test('forwarding limits concurrent requests while keeping every original local entry', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let requests = 0;
  const { logger, local } = forwardingWith(async () => {
    requests++;
    await gate;
    return { status: 201 };
  });
  for (let i = 0; i < 250; i++) logger.info('Import', { country: i });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 4);
  assert.equal(local.filter(row => row.level === 'info').length, 250);
  assert.equal(local.filter(row => row.level === 'warn').length, 1);
  release();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 204); // Four in-flight requests plus bounded queue.

});

test('HTTP 429 triggers a cooldown without throwing or recursively forwarding the warning', async () => {
  let requests = 0;
  const { logger, local } = forwardingWith(async () => {
    requests++;
    return { status: 429, headers: { 'retry-after': '120' } };
  });
  logger.info('first');
  await new Promise(resolve => setImmediate(resolve));
  logger.info('second');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(requests, 1);
  assert.equal(local.filter(row => row.level === 'info').length, 2);
  assert.match(local.find(row => row.level === 'warn').args[0], /HTTP 429/);
});

test('network and serialization errors in forwarding do not escape the logger call', async () => {
  const { logger, local } = forwardingWith(async () => { throw new Error('offline'); });
  assert.doesNotThrow(() => logger.error('import error'));
  await new Promise(resolve => setImmediate(resolve));
  const cyclic = {};
  cyclic.self = cyclic;
  assert.doesNotThrow(() => logger.info(cyclic));
  assert.ok(local.some(row => row.level === 'warn'));
});
