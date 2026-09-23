const test = require('node:test');
const assert = require('node:assert/strict');
const { createGeodataUpdates } = require('../socketIo/geodataHandlers');

const wait = () => new Promise(resolve => setTimeout(resolve, 25));
function setup(loadJobs) {
  const rooms = new Map();
  const events = [];
  const io = { sockets: { adapter: { rooms } }, to: () => ({ emit: (name, data) => events.push({ name, data }) }) };
  const updates = createGeodataUpdates(io, loadJobs, { warn() {} });
  const handlers = {};
  const socket = {
    admin: { roles: ['admin'], exp: Math.floor(Date.now() / 1000) + 100 },
    on: (name, handler) => { handlers[name] = handler; },
    emit: (name, data) => events.push({ name, data }),
    join: () => rooms.set('geodata:imports', new Set(['socket'])),
    leave: () => rooms.delete('geodata:imports'),
    disconnect: () => handlers.disconnect()
  };
  updates.attach(socket);
  return { updates, handlers, socket, events, rooms };
}

test('subscribe sends full snapshot; changes are coalesced; idle and unsubscribed views do not fetch', async () => {
  let calls = 0;
  const value = setup(async () => { calls++; return { batchId: 'run', jobs: [{ jobId: 'a', status: 'running' }] }; });
  try {
    value.updates.changed(0);
    await wait();
    assert.equal(calls, 0);
    await value.handlers['geodata:subscribe']();
    await wait();
    assert.equal(value.events[0].name, 'geodata:snapshot');
    assert.equal(value.events[0].data.jobs[0].status, 'running');
    value.updates.changed(0);
    value.updates.changed(0);
    await wait();
    assert.equal(calls, 2);
    await wait();
    assert.equal(calls, 2);
    value.handlers['geodata:unsubscribe']();
    value.updates.changed(0);
    await wait();
    assert.equal(calls, 2);
    await value.handlers['geodata:subscribe']();
    await wait();
    assert.equal(calls, 3);
  } finally { value.handlers.disconnect(); value.updates.close(); }
});

test('unauthorized roles and expired tokens cannot subscribe', async () => {
  const value = setup(() => assert.fail('must not load'));
  try {
    value.socket.admin.roles = ['author'];
    await value.handlers['geodata:subscribe']();
    value.socket.admin.roles = ['root'];
    value.socket.admin.exp = 1;
    await value.handlers['geodata:subscribe']();
    assert.equal(value.rooms.size, 0);
    assert.equal(value.events.length, 2);
    assert.ok(value.events.every(event => event.name === 'geodata:unavailable'));
  } finally { value.updates.close(); }
});

test('snapshot failure is reported without an unhandled rejection', async () => {
  const value = setup(async () => { throw new Error('offline'); });
  try {
    await value.handlers['geodata:subscribe']();
    await wait();
    assert.equal(value.events[0].name, 'geodata:unavailable');
  } finally { value.handlers.disconnect(); value.updates.close(); }
});
