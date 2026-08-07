const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeDeparturesResponse } = require('../departures');

test('normalizes scheduled and real-time stop departures', () => {
  const result = normalizeDeparturesResponse({
    embarkationStops: [{
      stopCode: '2035143',
      services: [{
        startTime: 1_800_000_000,
        realTimeDeparture: 1_800_000_300,
        realTimeStatus: 'IS_REAL_TIME',
        modeInfo: { identifier: 'pt_pub_bus', alt: 'Bus', localIcon: 'bus' },
        operator: 'Sydney Buses',
        operatorID: 'operator-1',
        routeID: 'route-377',
        serviceDirection: 'CITY Circular Quay',
        serviceName: 'Maroubra Beach - Circular Quay',
        serviceNumber: '377',
        serviceTripID: 'trip-1',
        startPlatform: 'A',
        serviceColor: { red: 0, green: 128, blue: 255 }
      }]
    }]
  }, 'AU_NSW_Sydney');

  assert.equal(result.departures.length, 1);
  assert.deepEqual(result.departures[0], {
    id: '2035143:trip-1:1800000000',
    region: 'AU_NSW_Sydney',
    stopCode: '2035143',
    serviceTripId: 'trip-1',
    routeId: 'route-377',
    operator: 'Sydney Buses',
    operatorId: 'operator-1',
    line: '377',
    serviceName: 'Maroubra Beach - Circular Quay',
    direction: 'CITY Circular Quay',
    modeIdentifier: 'pt_pub_bus',
    modeLabel: 'Bus',
    icon: 'bus',
    color: '#0080ff',
    textColor: undefined,
    scheduledDepartureTime: '2027-01-15T08:00:00.000Z',
    departureTime: '2027-01-15T08:05:00.000Z',
    delaySeconds: 300,
    platform: 'A',
    scheduledPlatform: undefined,
    realTime: true,
    realTimeStatus: 'IS_REAL_TIME',
    cancelled: false,
    wheelchairAccessible: undefined,
    bicycleAccessible: undefined,
    alerts: []
  });
});
