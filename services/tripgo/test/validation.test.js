const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRouteRequest } = require('../validation');

test('validates and normalizes a route request', () => {
  const result = validateRouteRequest({
    from: { latitude: '52.52', longitude: 13.405 },
    to: { latitude: 52.509, longitude: 13.376 },
    locale: 'de-DE',
    modes: ['pt_pub', 'wa_wal', 'pt_pub'],
    time: { type: 'departAfter', value: new Date(Date.now() + 60_000).toISOString() }
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.modes, ['pt_pub', 'wa_wal']);
  assert.equal(result.value.time.type, 'departAfter');
  assert.equal(Number.isInteger(result.value.time.epochSeconds), true);
});

test('rejects invalid coordinates and modes', () => {
  assert.equal(validateRouteRequest({
    from: { latitude: 100, longitude: 13 },
    to: { latitude: 52, longitude: 13 },
    modes: ['pt_pub']
  }).ok, false);
  assert.equal(validateRouteRequest({
    from: { latitude: 52, longitude: 13 },
    to: { latitude: 53, longitude: 14 },
    modes: ['not a mode']
  }).ok, false);
});
