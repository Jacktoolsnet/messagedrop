const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('worker IPC updates and completion notify the live bridge without parsing log output', async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  let spawnOptions;
  const mocks = {
    'node:path': path, 'node:fs/promises': {}, 'node:crypto': require('node:crypto'),
    'node:child_process': { spawn: (_command, _args, options) => { spawnOptions = options; return child; } },
    './db/tableGeodataPoi': {}, './geofabrik-catalog': {}, './categories': {},
    './storage-paths': {}, './dataset-export': {}
  };
  const context = {
    module: { exports: {} }, require: name => mocks[name],
    process: { execPath: process.execPath, env: {} }, __dirname: '/geodata', Buffer, console
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../import-job-manager.js'), 'utf8'), context);
  const manager = Object.create(context.module.exports.ImportJobManager.prototype);
  let changes = 0;
  manager.children = new Map();
  manager.logger = { info() {}, warn() {} };
  manager.notifier = { changed() { changes++; } };
  manager.launchNext = async () => {};
  manager.launch('job', { id: 'germany' }, { categories: ['tourism'] });
  assert.equal(spawnOptions.stdio[3], 'ipc');
  child.emit('message', { type: 'unrelated' });
  child.stdout.emit('data', Buffer.from('a log message'));
  assert.equal(changes, 0);
  child.emit('message', { type: 'geodata:changed' });
  assert.equal(changes, 1);
  child.emit('exit', 0);
  await Promise.resolve();
  assert.equal(changes, 2);
  assert.equal(manager.children.size, 0);
});
