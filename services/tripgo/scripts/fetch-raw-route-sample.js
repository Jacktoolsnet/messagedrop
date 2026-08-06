#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
const { createTripGoClient } = require('../clients/tripgo-client');

function coordinate(name) {
  const value = process.env[name];
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a finite number`);
  return parsed;
}

async function main() {
  const outputPath = process.argv[2];
  const serviceOutputPath = process.argv[3];
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
    time: null,
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
  }
}

async function fetchServiceSamples(client, routeResponse) {
  const templates = new Map((routeResponse.segmentTemplates || [])
    .map((template) => [template.hashCode, template]));
  const trips = (routeResponse.groups || []).flatMap((group) => group.trips || []);
  const selectedTrip = trips
    .map((trip) => ({ trip, scheduled: scheduledSegments(trip, templates) }))
    .filter(({ scheduled }) => scheduled.length > 0)
    .sort((left, right) => right.scheduled.length - left.scheduled.length
      || Number(left.trip.weightedScore ?? Number.MAX_SAFE_INTEGER)
        - Number(right.trip.weightedScore ?? Number.MAX_SAFE_INTEGER))[0];

  if (!selectedTrip) return { tripId: null, services: [] };

  const services = [];
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
    try {
      const response = await client.service(query);
      services.push({ description, query, status: response.status, data: response.data });
    } catch (error) {
      services.push({
        description,
        query,
        error: {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data
        }
      });
    }
  }
  return { tripId: selectedTrip.trip.id, services };
}

function scheduledSegments(trip, templates) {
  return (trip.segments || []).flatMap((reference) => {
    const template = templates.get(reference.segmentTemplateHashCode);
    return template?.type === 'scheduled' && reference.serviceTripID
      ? [{ reference, template }]
      : [];
  });
}

main().catch((error) => {
  process.stderr.write(`Could not fetch raw TripGo route: ${error.message}\n`);
  process.exitCode = 1;
});
