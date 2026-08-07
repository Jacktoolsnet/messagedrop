const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeRoutingResponse, normalizeServiceResponse, normalizeLatestResponse, rgbHex
} = require('../normalizer');

function trip(id, score, depart, templateHash, overrides = {}) {
  return {
    id, weightedScore: score, depart, arrive: depart + 600, queryTime: 1000,
    availability: 'AVAILABLE', caloriesCost: 12, carbonCost: 0.2,
    segments: [{
      id: `${id}-segment`, segmentTemplateHashCode: templateHash,
      startTime: depart, endTime: depart + 600, availability: 'AVAILABLE',
      serviceNumber: 'U2', serviceDirection: 'Pankow', startPlatform: '1', endPlatform: '2', stops: 4,
      realTime: true, realTimeStatus: 'IS_REAL_TIME', ticketWebsiteURL: 'https://tickets.example.test/journey'
    }],
    ...overrides
  };
}

const scheduledTemplate = {
  hashCode: 10,
  type: 'scheduled',
  modeIdentifier: 'pt_pub',
  modeInfo: { identifier: 'pt_pub_subway', alt: 'U-Bahn', localIcon: 'subway', color: { red: 10, green: 20, blue: 30 } },
  from: { name: 'Alexanderplatz', lat: 52.52, lng: 13.41, stopCode: 'from' },
  to: { name: 'Potsdamer Platz', lat: 52.51, lng: 13.38, stopCode: 'to' },
  operator: 'BVG',
  shapes: [{ encodedWaypoints: 'before', travelled: false }, { encodedWaypoints: 'route', travelled: true }]
};

test('normalizes templates and segment references into compact route options', () => {
  const normalized = normalizeRoutingResponse({
    region: 'DE_BE_Berlin',
    query: {
      depart: '2026-08-05T18:00:00Z',
      from: { address: 'Start', lat: 52.52, lng: 13.40 },
      to: { address: 'Ziel', lat: 52.51, lng: 13.38 }
    },
    groups: [{ frequency: 5, trips: [trip('route-1', 3, 1100, 10)] }],
    segmentTemplates: [scheduledTemplate]
  });

  assert.equal(normalized.region, 'DE_BE_Berlin');
  assert.equal(normalized.routes.length, 1);
  assert.equal(normalized.routes[0].durationSeconds, 600);
  assert.deepEqual(normalized.routes[0].modes, ['pt_pub_subway']);
  assert.equal(normalized.routes[0].segments[0].service.number, 'U2');
  assert.equal(normalized.routes[0].segments[0].service.operator, 'BVG');
  assert.equal(normalized.routes[0].segments[0].service.realTime, true);
  assert.equal(normalized.routes[0].segments[0].service.realTimeStatus, 'IS_REAL_TIME');
  assert.equal(normalized.routes[0].segments[0].service.ticketWebsiteUrl, 'https://tickets.example.test/journey');
  assert.equal(normalized.routes[0].segments[0].color, '#0a141e');
  assert.deepEqual(normalized.routes[0].segments[0].geometry, ['route']);
  assert.equal(normalized.routes[0].cost, undefined);
});

test('uses DB train numbers and specific German rail labels', () => {
  const railCases = [
    {
      hashCode: 101,
      reference: { serviceNumber: '25', serviceShortName: '000784', routeID: '162297_101' },
      modeInfo: { identifier: 'pt_pub_train', alt: 'Zug', localIcon: 'train' },
      operator: 'DB Fernverkehr AG',
      expectedLabel: 'ICE', expectedNumber: '784'
    },
    {
      hashCode: 102,
      reference: { serviceNumber: '56', serviceShortName: '002032', routeID: '162316_102' },
      modeInfo: { identifier: 'pt_pub_train', alt: 'Zug', localIcon: 'train' },
      operator: 'DB Fernverkehr AG',
      expectedLabel: 'IC/EC', expectedNumber: '2032'
    },
    {
      hashCode: 109,
      reference: { serviceNumber: 'S3', serviceShortName: '043230', routeID: '162846_109' },
      modeInfo: { identifier: 'pt_pub_train', alt: 'Zug', localIcon: 'train', remoteIcon: 'train-germany-s' },
      operator: 'S-Bahn Hamburg',
      expectedLabel: 'S-Bahn', expectedNumber: 'S3'
    }
  ];
  const templates = railCases.map(({ hashCode, modeInfo, operator }) => ({
    hashCode, type: 'scheduled', modeInfo, operator
  }));
  const trips = railCases.map(({ hashCode, reference }, index) => trip(`rail-${index}`, index + 1, 1100 + index, hashCode, {
    segments: [{
      id: `rail-${index}-segment`, segmentTemplateHashCode: hashCode,
      startTime: 1100 + index, endTime: 1700 + index,
      ...reference
    }]
  }));

  const normalized = normalizeRoutingResponse({ groups: [{ trips }], segmentTemplates: templates });

  railCases.forEach(({ expectedLabel, expectedNumber }, index) => {
    assert.equal(normalized.routes[index].segments[0].modeLabel, expectedLabel);
    assert.equal(normalized.routes[index].segments[0].service.number, expectedNumber);
  });
});

test('does not report a whole transit route as free from walking cost alone', () => {
  const walkingTemplate = {
    hashCode: 11, type: 'unscheduled', modeIdentifier: 'wa_wal',
    modeInfo: { identifier: 'wa_wal', alt: 'Fußweg' },
    localCost: { cost: 0, currency: 'EUR' }
  };
  const mixedTrip = trip('mixed', 1, 1100, 11, {
    segments: [
      { id: 'walk', segmentTemplateHashCode: 11, startTime: 1100, endTime: 1200 },
      { id: 'transit', segmentTemplateHashCode: 10, startTime: 1200, endTime: 1700 }
    ]
  });
  const normalized = normalizeRoutingResponse({
    groups: [{ trips: [mixedTrip] }], segmentTemplates: [walkingTemplate, scheduledTemplate]
  });
  assert.equal(normalized.routes[0].segments[0].cost.amount, 0);
  assert.equal(normalized.routes[0].cost, undefined);
});

test('keeps route-group diversity before filling remaining result slots', () => {
  const groups = [0, 1, 2].map((group) => ({
    trips: [
      trip(`g${group}-best`, group + 1, 1100, 10),
      trip(`g${group}-second`, group + 10, 1200, 10),
      trip(`g${group}-third`, group + 20, 1300, 10)
    ]
  }));
  const normalized = normalizeRoutingResponse({ groups, segmentTemplates: [scheduledTemplate] }, {
    maxRoutes: 6, routesPerGroup: 2
  });
  assert.equal(normalized.routes.length, 6);
  assert.deepEqual(new Set(normalized.routes.map((route) => route.groupIndex)), new Set([0, 1, 2]));
});

test('rejects responses with missing segment templates', () => {
  assert.throws(() => normalizeRoutingResponse({
    groups: [{ trips: [trip('route-1', 1, 1100, 99)] }],
    segmentTemplates: []
  }), /missing_tripgo_segment_template/);
});

test('accepts an empty routing result without segment templates', () => {
  const normalized = normalizeRoutingResponse({
    groups: [],
    region: 'DE_HH_Hamburg',
    query: {
      from: { address: 'Hamburg Airport', lat: 53.6304, lng: 9.9882 },
      to: { address: 'Munich Airport', lat: 48.3538, lng: 11.7861 }
    }
  });

  assert.equal(normalized.region, 'DE_HH_Hamburg');
  assert.deepEqual(normalized.routes, []);
  assert.deepEqual(normalized.meta, { groups: 0, totalRoutes: 0, returnedRoutes: 0 });
});

test('formats TripGo RGB colors', () => {
  assert.equal(rgbHex({ red: 255, green: 0, blue: 16 }), '#ff0010');
  assert.equal(rgbHex({ red: -1, green: 0, blue: 16 }), null);
});

test('normalizes current service times and calculates a delay', () => {
  const normalized = normalizeServiceResponse({
    shapes: [{
      travelled: true,
      waypoints: [{ lat: 52.1, lng: 10.1 }, { lat: 52.1, lng: 10.1 }, { lat: 52.2, lng: 10.2 }],
      stops: [
        { name: 'Start', code: 'start', lat: 52.1, lng: 10.1, departure: 1_785_956_880 },
        { name: 'Zwischenhalt', code: 'middle', lat: 52.15, lng: 10.15, arrival: 1_785_957_000 },
        { name: 'Ziel', code: 'end', lat: 52.2, lng: 10.2, arrival: 1_785_957_180 }
      ]
    }],
    service: {
      serviceTripID: 'trip-1',
      startTime: 1_785_956_880,
      endTime: 1_785_957_180,
      timetableStartTime: 1_785_956_580,
      timetableEndTime: 1_785_956_880,
      realTime: true,
      platform: '2',
      alerts: [{ title: 'Geänderter Steig' }]
    }
  }, { serviceTripId: 'trip-1' });

  assert.equal(normalized.realTime, true);
  assert.equal(normalized.delaySeconds, 300);
  assert.equal(normalized.platform, '2');
  assert.deepEqual(normalized.alerts, ['Geänderter Steig']);
  assert.deepEqual(normalized.stops.map((stop) => stop.name), ['Start', 'Zwischenhalt', 'Ziel']);
  assert.equal(normalized.stops[1].arrivalTime, '2026-08-05T19:10:00.000Z');
  assert.deepEqual(normalized.geometry, [
    { latitude: 52.1, longitude: 10.1 },
    { latitude: 52.2, longitude: 10.2 }
  ]);
});

test('normalizes latest predictions, update time, stops and vehicle position', () => {
  const normalized = normalizeLatestResponse({
    services: [{
      serviceTripID: 'trip-live',
      startTime: 1_785_956_880,
      endTime: 1_785_957_480,
      lastUpdate: 1_785_956_800,
      stops: [{
        stopCode: 'middle', predictedArrival: 1_785_957_100,
        actualDeparture: 1_785_957_120, lastUpdate: 1_785_957_000
      }],
      realtimeVehicle: {
        id: 'vehicle-1', lastUpdate: 1_785_956_790,
        location: { lat: 52.1, lng: 10.2, bearing: 90, speed: 12.5 }
      },
      alerts: [{ title: 'Changed platform' }]
    }]
  }, {
    serviceTripId: 'trip-live', embarkationTime: 1_785_956_580
  });

  assert.equal(normalized.realTime, true);
  assert.equal(normalized.delaySeconds, 300);
  assert.equal(normalized.updatedAt, '2026-08-05T19:06:40.000Z');
  assert.equal(normalized.stops[0].departureTime, '2026-08-05T19:12:00.000Z');
  assert.equal(normalized.stops[0].actualDepartureTime, '2026-08-05T19:12:00.000Z');
  assert.equal(normalized.vehicle.latitude, 52.1);
  assert.deepEqual(normalized.alerts, ['Changed platform']);
});
