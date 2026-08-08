const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cellIDsForBounds, decodePolyline, normalizeLocationsResponse, resolveRegion
} = require('../locations');

test('builds TripGo level-two cells for a viewport', () => {
  assert.deepEqual(cellIDsForBounds([{
    latMin: 52.14, lonMin: 10.54, latMax: 52.145, lonMax: 10.545
  }]), ['3910#790']);
});

test('resolves the smallest region polygon containing the viewport', () => {
  const polygon = 'nwcvE_fno[owyR??mcjRnwyR?';
  assert.deepEqual(decodePolyline(polygon), [
    { latitude: -35.25, longitude: 149.5 },
    { latitude: -32, longitude: 149.5 },
    { latitude: -32, longitude: 152.66999 },
    { latitude: -35.25, longitude: 152.66999 }
  ]);
  assert.equal(resolveRegion({ regions: [{ name: 'AU_NSW_Sydney', polygon }] }, [{
    latMin: -33.89, lonMin: 151.19, latMax: -33.85, lonMax: 151.22
  }]), 'AU_NSW_Sydney');
});

test('normalizes and combines platforms of the same stop', () => {
  const data = normalizeLocationsResponse({ groups: [{ stops: [{
    lat: 52.14185,
    lng: 10.54259,
    address: 'Halchter, Bernardusring',
    region: 'DE_NI_Hanover',
    name: 'Halchter, Bernardusring',
    stopCode: 'de:03158:1744:0:1',
    services: '794',
    modeInfo: { identifier: 'pt_pub_bus', alt: 'Bus', localIcon: 'bus' },
    publicTransportMode: 'pt_pub_bus',
    stopType: 'bus',
    operators: [{ id: 'operator', name: 'KVG Braunschweig' }]
  }, {
    lat: 52.14195,
    lng: 10.54269,
    address: 'Halchter, Bernardusring',
    region: 'DE_NI_Hanover',
    name: 'Halchter, Bernardusring',
    stopCode: 'de:03158:1744:0:2',
    services: '794, 795',
    modeInfo: { identifier: 'pt_pub_bus', alt: 'Bus', localIcon: 'bus' },
    publicTransportMode: 'pt_pub_bus',
    stopType: 'bus',
    operators: [{ id: 'operator', name: 'KVG Braunschweig' }]
  }] }] }, 'DE_NI_Hanover', [{
    latMin: 52.13, lonMin: 10.53, latMax: 52.15, lonMax: 10.55
  }]);
  assert.equal(data.stops.length, 1);
  assert.deepEqual(data.stops[0].modeIcons, ['bus']);
  assert.deepEqual(data.stops[0].services, ['794', '795']);
  assert.deepEqual(data.stops[0].platforms.map((platform) => platform.platform), ['1', '2']);
});

test('includes transport modes and platforms nested below a parent stop', () => {
  const data = normalizeLocationsResponse({ groups: [{ stops: [{
    lat: 59.91059,
    lng: 10.72966,
    name: 'Aker brygge',
    region: 'NO_Oslo',
    stopCode: 'NSR:StopPlace:58382',
    modeInfo: { identifier: 'pt_pub_tram', alt: 'tram', localIcon: 'tram' },
    publicTransportMode: 'pt_pub_tram',
    stopType: 'tram',
    children: [{
      lat: 59.91037,
      lng: 10.72918,
      name: 'Aker brygge',
      region: 'NO_Oslo',
      stopCode: 'NSR:Quay:7478',
      platformCode: 'BC',
      services: 'B10',
      modeInfo: { identifier: 'pt_pub_ferry', alt: 'ferry', localIcon: 'ferry' },
      publicTransportMode: 'pt_pub_ferry',
      stopType: 'ferry'
    }]
  }] }] }, 'NO_Oslo', [{
    latMin: 59.90, lonMin: 10.72, latMax: 59.92, lonMax: 10.74
  }]);

  assert.equal(data.stops.length, 1);
  assert.deepEqual(data.stops[0].modeIdentifiers, ['pt_pub_ferry', 'pt_pub_tram']);
  assert.deepEqual(data.stops[0].modeIcons, ['ferry', 'tram']);
  assert.deepEqual(data.stops[0].platforms.map((platform) => platform.stopCode), [
    'NSR:Quay:7478', 'NSR:StopPlace:58382'
  ]);
  assert.equal(data.stops[0].platforms[0].platform, 'BC');
});
