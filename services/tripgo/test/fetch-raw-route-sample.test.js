const test = require('node:test');
const assert = require('node:assert/strict');
const { buildGeometryDiagnostics, fetchServiceSamples } = require('../scripts/fetch-raw-route-sample');

test('fetches one representative trip for each scheduled mode combination', async () => {
  const previous = process.env.TRIPGO_SAMPLE_PREFER_DIVERSE_MODES;
  process.env.TRIPGO_SAMPLE_PREFER_DIVERSE_MODES = '1';
  const requestedServices = [];
  const requestedRoutes = [];
  const client = {
    service: async (query) => {
      requestedServices.push(query.serviceTripId);
      return { status: 200, data: { shapes: [] } };
    },
    latest: async () => ({ status: 200, data: { services: [] } }),
    routeInfo: async (query) => {
      requestedRoutes.push(query);
      return { status: 200, data: { id: query.routeId, directions: [] } };
    }
  };
  const template = (hashCode, identifier) => ({
    hashCode,
    type: 'scheduled',
    stopCode: `start-${hashCode}`,
    endStopCode: `end-${hashCode}`,
    operatorID: `operator-${hashCode}`,
    modeInfo: { identifier, localIcon: identifier },
    from: { name: 'Start' },
    to: { name: 'Ziel' },
    shapes: []
  });
  const trip = (id, hashCode, serviceTripID, weightedScore) => ({
    id,
    weightedScore,
    segments: [{
      segmentTemplateHashCode: hashCode,
      serviceTripID,
      routeID: `route-${hashCode}`,
      startTime: 1_787_100_000
    }]
  });

  try {
    const result = await fetchServiceSamples(client, {
      region: 'DE_NI_Hanover',
      segmentTemplates: [template(1, 'pt_pub_bus'), template(2, 'pt_pub_train')],
      groups: [{ trips: [trip('bus', 1, 'bus-trip', 10), trip('train', 2, 'train-trip', 20)] }]
    });

    assert.deepEqual(result.tripIds, ['bus', 'train']);
    assert.deepEqual(requestedServices, ['bus-trip', 'train-trip']);
    assert.deepEqual(requestedRoutes.map(({ routeId }) => routeId), ['route-1', 'route-2']);
    assert.equal(result.services.length, 2);
  } finally {
    if (previous === undefined) delete process.env.TRIPGO_SAMPLE_PREFER_DIVERSE_MODES;
    else process.env.TRIPGO_SAMPLE_PREFER_DIVERSE_MODES = previous;
  }
});

test('does not treat repeated stop coordinates as useful detailed route geometry', () => {
  const result = buildGeometryDiagnostics({
    tripId: 'trip',
    tripIds: ['trip'],
    trips: [],
    services: [{
      tripId: 'trip',
      description: { serviceNumber: '420' },
      query: {},
      routingGeometry: { pointCount: 2 },
      serviceGeometry: { pointCount: 2, stopCount: 1 },
      routeInfo: {
        data: {
          id: 'route',
          operatorId: 'operator',
          directions: [{
            id: '1',
            shapeIsDetailed: true,
            encodedShape: '????',
            stops: [{ lat: 0, lng: 0 }]
          }]
        }
      }
    }]
  });

  assert.equal(result.summary.segmentsClaimingDetailedRouteInfoGeometry, 1);
  assert.equal(result.summary.segmentsWithUsableDetailedRouteInfoGeometry, 0);
  assert.equal(result.segments[0].routeInfo.directions[0].uniquePointCount, 1);
  assert.equal(result.segments[0].routeInfo.directions[0].intermediatePointCount, 0);
});
