const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeRoutingResponse, rgbHex } = require('../normalizer');

function trip(id, score, depart, templateHash, overrides = {}) {
  return {
    id, weightedScore: score, depart, arrive: depart + 600, queryTime: 1000,
    availability: 'AVAILABLE', caloriesCost: 12, carbonCost: 0.2,
    segments: [{
      id: `${id}-segment`, segmentTemplateHashCode: templateHash,
      startTime: depart, endTime: depart + 600, availability: 'AVAILABLE',
      serviceNumber: 'U2', serviceDirection: 'Pankow', startPlatform: '1', endPlatform: '2', stops: 4
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
  assert.equal(normalized.routes[0].segments[0].color, '#0a141e');
  assert.deepEqual(normalized.routes[0].segments[0].geometry, ['route']);
  assert.equal(normalized.routes[0].cost, undefined);
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

test('formats TripGo RGB colors', () => {
  assert.equal(rgbHex({ red: 255, green: 0, blue: 16 }), '#ff0010');
  assert.equal(rgbHex({ red: -1, green: 0, blue: 16 }), null);
});
