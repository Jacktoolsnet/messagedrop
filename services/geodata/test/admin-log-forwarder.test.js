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
