const test = require('node:test');
const assert = require('node:assert/strict');
const { deliverContactMessage } = require('../utils/socketDelivery');

test('reports an acknowledged live Socket.IO delivery', async () => {
  const previousBaseUrl = process.env.SOCKETIO_BASE_URL;
  const previousPort = process.env.SOCKETIO_PORT;
  process.env.SOCKETIO_BASE_URL = 'https://socket.example.test';
  delete process.env.SOCKETIO_PORT;
  let request;
  try {
    const delivered = await deliverContactMessage(null, {
      contactUserId: 'recipient-1',
      messageId: 'message-1'
    }, {
      signToken: async () => 'service-token',
      client: {
        post: async (...args) => {
          request = args;
          return { status: 200, data: { delivered: true } };
        }
      }
    });
    assert.equal(delivered, true);
    assert.equal(request[0], 'https://socket.example.test/emit/user');
    assert.equal(request[1].event, 'receiveContactMessage:recipient-1');
    assert.equal(request[1].awaitAck, true);
  } finally {
    if (previousBaseUrl === undefined) delete process.env.SOCKETIO_BASE_URL;
    else process.env.SOCKETIO_BASE_URL = previousBaseUrl;
    if (previousPort === undefined) delete process.env.SOCKETIO_PORT;
    else process.env.SOCKETIO_PORT = previousPort;
  }
});
