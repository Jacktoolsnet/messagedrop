const test = require('node:test');
const assert = require('node:assert/strict');
const { deliverToAnySocket, normalizeAckTimeout } = require('../socketIo/delivery');

function fakeIo(sockets) {
  return { in: () => ({ fetchSockets: async () => sockets }) };
}

function fakeSocket(result, reject = false) {
  return {
    timeout() {
      return {
        emitWithAck: async () => {
          if (reject) throw new Error('timeout');
          return result;
        }
      };
    }
  };
}

test('reports delivery when at least one connected client processes the event', async () => {
  const result = await deliverToAnySocket(fakeIo([
    fakeSocket(null, true),
    fakeSocket({ status: 200, processed: true, messageId: 'message-1' })
  ]), 'user-1', 'message', {}, 500);
  assert.equal(result.delivered, true);
  assert.equal(result.connectedSockets, 2);
});

test('does not report delivery without a positive processing acknowledgement', async () => {
  const result = await deliverToAnySocket(fakeIo([
    fakeSocket({ status: 200, processed: false })
  ]), 'user-1', 'message', {}, 500);
  assert.equal(result.delivered, false);
  assert.equal(normalizeAckTimeout(99999), 3000);
});
