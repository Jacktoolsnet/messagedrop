const test = require('node:test');
const assert = require('node:assert/strict');
const {
  validateRouteRequest, validateServiceRequest, validateLatestRequest, validateRegionRequest
} = require('../validation');

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

test('validates a live service request', () => {
  const result = validateServiceRequest({
    region: 'DE_NI_Hanover',
    serviceTripId: '3245078301',
    operator: 'de-delfi-gtfs-12096',
    startStopCode: 'de:03158:1701:0:2',
    endStopCode: 'de:03158:458:1:C',
    embarkationTime: new Date(Date.now() + 60_000).toISOString(),
    locale: 'de'
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.serviceTripId, '3245078301');
  assert.equal(Number.isInteger(result.value.embarkationTime), true);
});

test('rejects incomplete live service requests', () => {
  assert.equal(validateServiceRequest({ region: 'DE_NI_Hanover' }).ok, false);
});

test('requires an operator for latest real-time requests', () => {
  const input = {
    region: 'SE_Stockholm',
    serviceTripId: 'VYB:ServiceJourney:123',
    startStopCode: 'NSR:Quay:99386',
    embarkationTime: new Date(Date.now() + 60_000).toISOString(),
    locale: 'en'
  };
  assert.equal(validateLatestRequest(input).ok, false);
  assert.equal(validateLatestRequest({ ...input, operator: 'VYB:Operator:Vybus4you' }).ok, true);
});

test('validates region provider query options', () => {
  const result = validateRegionRequest({
    region: 'SE_Stockholm', locale: 'en', onlyRealTime: 'true', full: '1'
  });
  assert.deepEqual(result, {
    ok: true,
    value: { region: 'SE_Stockholm', locale: 'en', onlyRealTime: true, full: true }
  });
  assert.equal(validateRegionRequest({ region: '../invalid' }).ok, false);
  assert.equal(validateRegionRequest({ region: 'SE_Stockholm', onlyRealTime: 'perhaps' }).ok, false);
});
