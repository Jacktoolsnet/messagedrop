const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function setup(post) {
  const timers = [];
  const context = {
    module: { exports: {} }, process: { env: {} },
    setTimeout: (fn, delay) => { const timer = { fn, delay, unref() {} }; timers.push(timer); return timer; },
    clearTimeout() {},
    require: name => name === 'axios' ? { post } : name === './serviceJwt'
      ? { signServiceJwt: async ({ audience }) => { assert.equal(audience, 'service.admin-backend'); return 'signed'; } }
      : { resolveBaseUrl: () => 'https://admin.test' }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../utils/importNotifier.js'), 'utf8'), context);
  return { notifier: context.module.exports.createImportNotifier({ warn() {} }), timers };
}

test('notifier coalesces bursts and authenticates the push, without periodic polling', async () => {
  let calls = 0;
  const { notifier, timers } = setup(async (url, _body, options) => {
    calls++;
    assert.equal(url, 'https://admin.test/geodata-import/events');
    assert.equal(options.headers.Authorization, 'Bearer signed');
  });
  for (let i = 0; i < 100; i++) notifier.changed();
  assert.equal(timers.length, 1);
  await timers.shift().fn();
  assert.equal(calls, 1);
  assert.equal(timers.length, 0);
});

test('delivery failure retries, and changes during an in-flight request are retained', async () => {
  let calls = 0;
  const { notifier, timers } = setup(async () => {
    if (++calls === 1) throw new Error('offline');
    if (calls === 2) notifier.changed();
  });
  notifier.changed();
  await timers.shift().fn();
  assert.equal(timers.length, 1);
  await timers.shift().fn();
  assert.equal(timers.length, 1);
  await timers.shift().fn();
  assert.equal(calls, 3);
  assert.equal(timers.length, 0);
  notifier.close();
  notifier.changed();
  assert.equal(timers.length, 0);
});
