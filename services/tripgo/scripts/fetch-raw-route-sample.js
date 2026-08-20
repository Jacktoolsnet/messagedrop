#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
const { createTripGoClient } = require('../clients/tripgo-client');
const { normalizeLatestResponse, normalizeServiceResponse } = require('../normalizer');

function coordinate(name) {
  const value = process.env[name];
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a finite number`);
  return parsed;
}

async function main() {
  const outputPath = process.argv[2];
  const serviceOutputPath = process.argv[3];
  const latestOutputPath = process.argv[4];
  const geometryOutputPath = process.argv[5];
  if (!outputPath) throw new Error('Output path is required');

  const client = createTripGoClient();
  const response = await client.routes({
    from: {
      latitude: coordinate('TRIPGO_SAMPLE_FROM_LAT'),
      longitude: coordinate('TRIPGO_SAMPLE_FROM_LNG')
    },
    to: {
      latitude: coordinate('TRIPGO_SAMPLE_TO_LAT'),
      longitude: coordinate('TRIPGO_SAMPLE_TO_LNG')
    },
    locale: process.env.TRIPGO_SAMPLE_LOCALE || 'de',
    modes: (process.env.TRIPGO_SAMPLE_MODES || 'pt_pub').split(',').map((mode) => mode.trim()).filter(Boolean),
    time: sampleTime(),
    avoidStops: []
  });

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(response.data, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`Raw TripGo route written to ${outputPath}\n`);

  if (serviceOutputPath) {
    const serviceSamples = await fetchServiceSamples(client, response.data);
    await fs.mkdir(path.dirname(serviceOutputPath), { recursive: true });
    await fs.writeFile(serviceOutputPath, `${JSON.stringify(serviceSamples, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`Raw TripGo service details written to ${serviceOutputPath}\n`);

    if (geometryOutputPath) {
      const geometryDiagnostics = buildGeometryDiagnostics(serviceSamples);
      await fs.mkdir(path.dirname(geometryOutputPath), { recursive: true });
      await fs.writeFile(geometryOutputPath, `${JSON.stringify(geometryDiagnostics, null, 2)}\n`, { mode: 0o600 });
      process.stdout.write(`TripGo geometry diagnostics written to ${geometryOutputPath}\n`);
    }

    if (latestOutputPath) {
      const latestSamples = {
        tripId: serviceSamples.tripId,
        tripIds: serviceSamples.tripIds,
        services: serviceSamples.services.map(({ tripId, description, query, latest, latestError }) => ({
          tripId,
          description,
          query,
          latest,
          latestError
        }))
      };
      await fs.mkdir(path.dirname(latestOutputPath), { recursive: true });
      await fs.writeFile(latestOutputPath, `${JSON.stringify(latestSamples, null, 2)}\n`, { mode: 0o600 });
      process.stdout.write(`Raw TripGo latest details written to ${latestOutputPath}\n`);
    }
  }
}

function sampleTime() {
  const value = process.env.TRIPGO_SAMPLE_DEPART_AFTER?.trim();
  if (!value) return null;
  const epochSeconds = /^\d+$/u.test(value)
    ? Number(value)
    : Math.floor(Date.parse(value) / 1000);
  if (!Number.isFinite(epochSeconds)) throw new Error('TRIPGO_SAMPLE_DEPART_AFTER must be an epoch or date');
  return { type: 'departAfter', epochSeconds };
}

async function fetchServiceSamples(client, routeResponse) {
  const templates = new Map((routeResponse.segmentTemplates || [])
    .map((template) => [template.hashCode, template]));
  const trips = (routeResponse.groups || []).flatMap((group) => group.trips || []);
  const preferredOperator = process.env.TRIPGO_SAMPLE_OPERATOR?.trim();
  const preferDiverseModes = process.env.TRIPGO_SAMPLE_PREFER_DIVERSE_MODES === '1';
  const candidates = trips
    .map((trip) => ({ trip, scheduled: scheduledSegments(trip, templates) }))
    .filter(({ scheduled }) => scheduled.length > 0)
    .sort((left, right) => operatorPriority(right.scheduled, preferredOperator)
      - operatorPriority(left.scheduled, preferredOperator)
      || Number(left.trip.weightedScore ?? Number.MAX_SAFE_INTEGER)
        - Number(right.trip.weightedScore ?? Number.MAX_SAFE_INTEGER)
      || left.scheduled.length - right.scheduled.length);
  const selectedTrips = preferDiverseModes
    ? selectRepresentativeTrips(candidates)
    : candidates.slice(0, 1);

  if (selectedTrips.length === 0) return { tripId: null, tripIds: [], trips: [], services: [] };

  const services = [];
  const routeInfoRequests = new Map();
  for (const selectedTrip of selectedTrips) {
    for (const { reference, template } of selectedTrip.scheduled) {
      const query = {
        region: routeResponse.region,
        serviceTripId: reference.serviceTripID,
        operator: template.operatorID || null,
        startStopCode: template.stopCode || template.from?.stopCode || template.from?.code,
        endStopCode: template.endStopCode || template.to?.stopCode || template.to?.code || null,
        embarkationTime: reference.startTime,
        locale: process.env.TRIPGO_SAMPLE_LOCALE || 'de'
      };
      const description = {
        modeIdentifier: template.modeInfo?.identifier || template.modeIdentifier,
        modeLabel: template.modeInfo?.alt,
        localIcon: template.modeInfo?.localIcon,
        remoteIcon: template.modeInfo?.remoteIcon,
        serviceNumber: reference.serviceNumber,
        serviceShortName: reference.serviceShortName,
        serviceName: reference.serviceName,
        direction: reference.serviceDirection,
        routeId: reference.routeID || reference.routeId,
        operator: template.serviceOperator || template.operator || reference.externalData?.operatorName,
        from: template.from?.name,
        to: template.to?.name
      };
      const sample = {
        tripId: selectedTrip.trip.id,
        description,
        query,
        routingGeometry: analyzeRoutingGeometry(template)
      };
      try {
        const response = await client.service(query);
        sample.status = response.status;
        sample.data = response.data;
        sample.serviceGeometry = analyzeServiceGeometry(response.data, query);
      } catch (error) {
        sample.error = requestError(error);
      }
      try {
        const latestResponse = await client.latest(query);
        sample.latest = { status: latestResponse.status, data: latestResponse.data };
      } catch (error) {
        sample.latestError = requestError(error);
      }
      const routeInfoQuery = {
        region: routeResponse.region,
        operator: template.operatorID || null,
        routeId: reference.routeID || reference.routeId || null,
        locale: process.env.TRIPGO_SAMPLE_LOCALE || 'de'
      };
      if (routeInfoQuery.operator && routeInfoQuery.routeId) {
        const key = `${routeInfoQuery.region}\u0000${routeInfoQuery.operator}\u0000${routeInfoQuery.routeId}`;
        if (!routeInfoRequests.has(key)) {
          routeInfoRequests.set(key, fetchRouteInfo(client, routeInfoQuery));
        }
        const routeInfo = await routeInfoRequests.get(key);
        sample.routeInfoQuery = routeInfoQuery;
        sample.routeInfo = routeInfo.response;
        sample.routeInfoError = routeInfo.error;
      }
      services.push(sample);
    }
  }
  return {
    tripId: selectedTrips[0].trip.id,
    tripIds: selectedTrips.map(({ trip }) => trip.id),
    trips: selectedTrips.map(({ trip, scheduled }) => ({
      tripId: trip.id,
      weightedScore: trip.weightedScore,
      scheduledModes: [...new Set(scheduled.map(({ template }) => scheduledMode(template)))]
    })),
    services
  };
}

async function fetchRouteInfo(client, query) {
  try {
    const response = await client.routeInfo(query);
    return { response: { status: response.status, data: response.data }, error: null };
  } catch (error) {
    return { response: null, error: requestError(error) };
  }
}

function operatorPriority(segments, operatorId) {
  if (!operatorId) return 0;
  const matches = segments.filter(({ template }) => template.operatorID === operatorId).length;
  if (matches === segments.length) return 2;
  return matches > 0 ? 1 : 0;
}

function selectRepresentativeTrips(candidates) {
  const representatives = new Map();
  for (const candidate of candidates) {
    const signature = [...new Set(candidate.scheduled.map(({ template }) => scheduledMode(template)))].sort().join(',');
    if (!representatives.has(signature)) representatives.set(signature, candidate);
  }
  return [...representatives.values()].slice(0, 4);
}

function scheduledMode(template) {
  const identifier = String(template.modeInfo?.identifier || template.modeIdentifier || '').toLowerCase();
  const icon = String(template.modeInfo?.localIcon || '').toLowerCase();
  const value = `${identifier} ${icon}`;
  if (value.includes('bus') || value.includes('coach')) return 'bus';
  if (value.includes('tram') || value.includes('streetcar')) return 'tram';
  if (value.includes('subway') || value.includes('metro')) return 'subway';
  if (value.includes('train') || value.includes('rail')) return 'rail';
  if (value.includes('ferry') || value.includes('boat')) return 'ferry';
  return identifier || icon || 'unknown';
}

function requestError(error) {
  return {
    message: error.message,
    status: error.response?.status,
    data: error.response?.data
  };
}

function scheduledSegments(trip, templates) {
  return (trip.segments || []).flatMap((reference) => {
    const template = templates.get(reference.segmentTemplateHashCode);
    return template?.type === 'scheduled' && reference.serviceTripID
      ? [{ reference, template }]
      : [];
  });
}

function buildGeometryDiagnostics(serviceSamples) {
  const segments = serviceSamples.services.map((sample, index) => ({
    index,
    tripId: sample.tripId,
    description: sample.description,
    query: sample.query,
    routing: sample.routingGeometry,
    service: sample.serviceGeometry || { available: false, error: sample.error || null },
    routeInfo: analyzeRouteInfoGeometry(sample.routeInfo?.data, sample.routeInfoError),
    latest: analyzeLatestGeometry(sample.latest?.data, sample.query, sample.latestError)
  }));
  return {
    generatedAt: new Date().toISOString(),
    tripId: serviceSamples.tripId,
    tripIds: serviceSamples.tripIds,
    trips: serviceSamples.trips,
    summary: {
      scheduledSegments: segments.length,
      segmentsWithRoutingGeometry: segments.filter((segment) => segment.routing.pointCount > 1).length,
      segmentsWithServiceGeometry: segments.filter((segment) => segment.service.pointCount > 1).length,
      segmentsClaimingDetailedRouteInfoGeometry: segments
        .filter((segment) => segment.routeInfo.claimsDetailedShape).length,
      segmentsWithUsableDetailedRouteInfoGeometry: segments
        .filter((segment) => segment.routeInfo.hasUsefulDetailedShape).length,
      segmentsWithIntermediateStops: segments.filter((segment) => segment.service.stopCount > 2).length,
      segmentsWithRealtimeVehicle: segments.filter((segment) => segment.latest.vehicleAvailable).length
    },
    segments
  };
}

function analyzeRouteInfoGeometry(payload, routeInfoError) {
  if (!payload) {
    return {
      available: false,
      claimsDetailedShape: false,
      hasUsefulDetailedShape: false,
      error: routeInfoError || null
    };
  }
  const directions = (Array.isArray(payload.directions) ? payload.directions : []).map((direction) => {
    const points = decodePolyline(direction.encodedShape);
    const stats = geometryStats(points.length ? [points] : [], direction.stops || [], {
      id: direction.id,
      name: direction.name,
      shapeIsDetailed: direction.shapeIsDetailed === true,
      source: points.length ? 'route-info-encoded-shape' : 'none'
    });
    return stats;
  });
  return {
    available: true,
    routeId: payload.id,
    operator: payload.operatorID || payload.operatorId,
    directionCount: directions.length,
    claimsDetailedShape: directions.some((direction) => direction.shapeIsDetailed && direction.pointCount > 1),
    hasUsefulDetailedShape: directions.some((direction) => direction.shapeIsDetailed
      && direction.intermediatePointCount > 0),
    directions
  };
}

function analyzeRoutingGeometry(template) {
  const shapes = relevantShapes(template.shapes);
  const shapePaths = shapes.map(shapePoints).filter((points) => points.length > 0);
  const streetPaths = (template.streets || [])
    .map((street) => decodePolyline(street?.encodedWaypoints))
    .filter((points) => points.length > 0);
  const paths = shapePaths.length > 0 ? shapePaths : streetPaths;
  return geometryStats(paths, shapes.flatMap((shape) => shape.stops || []), {
    source: shapePaths.length > 0 ? 'segment-template-shapes' : streetPaths.length > 0 ? 'segment-template-streets' : 'none',
    shapeCount: shapes.length,
    streetCount: Array.isArray(template.streets) ? template.streets.length : 0
  });
}

function analyzeServiceGeometry(payload, query) {
  try {
    const normalized = normalizeServiceResponse(payload, query);
    const shapes = relevantShapes(payload.shapes);
    const paths = shapes.map(shapePoints).filter((points) => points.length > 0);
    const stops = normalized.stops || [];
    const stats = geometryStats(paths.length > 0 ? paths : [normalized.geometry || []], stops, {
      available: true,
      source: paths.length > 0 ? 'service-shapes' : normalized.geometry?.length ? 'normalized-service-geometry' : 'none',
      shapeCount: shapes.length,
      travelledShapeCount: shapes.filter((shape) => shape?.travelled !== false).length,
      normalizedPointCount: normalized.geometry?.length || 0
    });
    return {
      ...stats,
      serviceTripId: normalized.serviceTripId,
      realTime: normalized.realTime === true,
      alertCount: normalized.alerts?.length || 0
    };
  } catch (error) {
    return { available: false, error: { message: error.message } };
  }
}

function analyzeLatestGeometry(payload, query, latestError) {
  if (!payload) return { available: false, vehicleAvailable: false, error: latestError || null };
  try {
    const normalized = normalizeLatestResponse(payload, query);
    return {
      available: true,
      realTime: normalized.realTime === true,
      vehicleAvailable: Boolean(normalized.vehicle),
      vehicle: normalized.vehicle || null,
      stopPredictionCount: normalized.stops?.length || 0,
      updatedAt: normalized.updatedAt
    };
  } catch (error) {
    return { available: false, vehicleAvailable: false, error: { message: error.message } };
  }
}

function geometryStats(paths, stops, extra = {}) {
  const validPaths = paths.map((path) => path.filter(validPoint)).filter((path) => path.length > 0);
  const points = validPaths.flat();
  const validStops = stops.map(normalizePoint).filter(Boolean);
  const stopDistances = validStops
    .map((stop) => distanceToPathsInMeters(stop, validPaths))
    .filter(Number.isFinite);
  const lengthMeters = validPaths.reduce((total, path) => total + pathLengthMeters(path), 0);
  const directDistanceMeters = points.length > 1 ? distanceInMeters(points[0], points.at(-1)) : 0;
  const intermediatePointCount = validStops.length > 0
    ? uniquePoints(points).filter((point) => Math.min(...validStops.map((stop) => distanceInMeters(point, stop))) > 15).length
    : null;
  return {
    ...extra,
    pathCount: validPaths.length,
    pointCount: points.length,
    uniquePointCount: uniquePoints(points).length,
    stopCount: validStops.length,
    uniqueStopCount: uniquePoints(validStops).length,
    intermediatePointCount,
    lengthMeters: Math.round(lengthMeters),
    directDistanceMeters: Math.round(directDistanceMeters),
    lengthToDirectRatio: directDistanceMeters > 0
      ? Number((lengthMeters / directDistanceMeters).toFixed(3))
      : null,
    maximumStopDistanceMeters: stopDistances.length
      ? Number(Math.max(...stopDistances).toFixed(1))
      : null,
    averageStopDistanceMeters: stopDistances.length
      ? Number((stopDistances.reduce((sum, distance) => sum + distance, 0) / stopDistances.length).toFixed(1))
      : null
  };
}

function uniquePoints(points) {
  return [...new Map(points.map((point) => [
    `${point.latitude.toFixed(5)},${point.longitude.toFixed(5)}`,
    point
  ])).values()];
}

function relevantShapes(value) {
  const shapes = Array.isArray(value) ? value : [];
  const travelled = shapes.filter((shape) => shape?.travelled !== false);
  return travelled.length > 0 ? travelled : shapes;
}

function shapePoints(shape) {
  const waypoints = (shape?.waypoints || []).map(normalizePoint).filter(Boolean);
  return waypoints.length > 0 ? waypoints : decodePolyline(shape?.encodedWaypoints);
}

function normalizePoint(value) {
  const latitude = Number(value?.latitude ?? value?.lat);
  const longitude = Number(value?.longitude ?? value?.lng);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

function validPoint(value) {
  return Number.isFinite(value?.latitude) && Number.isFinite(value?.longitude);
}

function pathLengthMeters(points) {
  let result = 0;
  for (let index = 1; index < points.length; index += 1) {
    result += distanceInMeters(points[index - 1], points[index]);
  }
  return result;
}

function distanceToPathsInMeters(point, paths) {
  let shortest = Number.POSITIVE_INFINITY;
  for (const path of paths) {
    if (path.length === 1) shortest = Math.min(shortest, distanceInMeters(point, path[0]));
    for (let index = 1; index < path.length; index += 1) {
      shortest = Math.min(shortest, distanceToSegmentInMeters(point, path[index - 1], path[index]));
    }
  }
  return shortest;
}

function distanceToSegmentInMeters(point, start, end) {
  const latitude = point.latitude * Math.PI / 180;
  const longitudeScale = 111_320 * Math.cos(latitude);
  const latitudeScale = 110_540;
  const startX = (start.longitude - point.longitude) * longitudeScale;
  const startY = (start.latitude - point.latitude) * latitudeScale;
  const endX = (end.longitude - point.longitude) * longitudeScale;
  const endY = (end.latitude - point.latitude) * latitudeScale;
  const deltaX = endX - startX;
  const deltaY = endY - startY;
  const squaredLength = deltaX * deltaX + deltaY * deltaY;
  const progress = squaredLength > 0
    ? Math.max(0, Math.min(1, -(startX * deltaX + startY * deltaY) / squaredLength))
    : 0;
  return Math.hypot(startX + deltaX * progress, startY + deltaY * progress);
}

function distanceInMeters(left, right) {
  const earthRadius = 6_371_000;
  const toRadians = (value) => value * Math.PI / 180;
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const leftLatitude = toRadians(left.latitude);
  const rightLatitude = toRadians(right.latitude);
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(leftLatitude) * Math.cos(rightLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function decodePolyline(encoded) {
  if (typeof encoded !== 'string' || !encoded) return [];
  const points = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  while (index < encoded.length) {
    const latitudeResult = decodePolylineValue(encoded, index);
    if (!latitudeResult) break;
    index = latitudeResult.index;
    latitude += latitudeResult.value;
    const longitudeResult = decodePolylineValue(encoded, index);
    if (!longitudeResult) break;
    index = longitudeResult.index;
    longitude += longitudeResult.value;
    points.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
  }
  return points;
}

function decodePolylineValue(encoded, startIndex) {
  let index = startIndex;
  let result = 0;
  let shift = 0;
  let byte;
  do {
    if (index >= encoded.length) return null;
    byte = encoded.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);
  return { index, value: result & 1 ? ~(result >> 1) : result >> 1 };
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Could not fetch raw TripGo route: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { buildGeometryDiagnostics, fetchServiceSamples, selectRepresentativeTrips };
