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
  const latestOutputPath = process.argv[4];
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

    if (latestOutputPath) {
      const latestSamples = {
        tripId: serviceSamples.tripId,
        services: serviceSamples.services.map(({ description, query, latest, latestError }) => ({
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

async function fetchServiceSamples(client, routeResponse) {
  const templates = new Map((routeResponse.segmentTemplates || [])
    .map((template) => [template.hashCode, template]));
  const trips = (routeResponse.groups || []).flatMap((group) => group.trips || []);
  const preferredOperator = process.env.TRIPGO_SAMPLE_OPERATOR?.trim();
  const selectedTrip = trips
    .map((trip) => ({ trip, scheduled: scheduledSegments(trip, templates) }))
    .filter(({ scheduled }) => scheduled.length > 0)
    .sort((left, right) => operatorPriority(right.scheduled, preferredOperator)
      - operatorPriority(left.scheduled, preferredOperator)
      || left.scheduled.length - right.scheduled.length
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
    const sample = { description, query };
    try {
      const response = await client.service(query);
      sample.status = response.status;
      sample.data = response.data;
    } catch (error) {
      sample.error = requestError(error);
    }
    try {
      const latestResponse = await client.latest(query);
      sample.latest = { status: latestResponse.status, data: latestResponse.data };
    } catch (error) {
      sample.latestError = requestError(error);
    }
    services.push(sample);
  }
  return { tripId: selectedTrip.trip.id, services };
}

function operatorPriority(segments, operatorId) {
  if (!operatorId) return 0;
  const matches = segments.filter(({ template }) => template.operatorID === operatorId).length;
  if (matches === segments.length) return 2;
  return matches > 0 ? 1 : 0;
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

main().catch((error) => {
  process.stderr.write(`Could not fetch raw TripGo route: ${error.message}\n`);
  process.exitCode = 1;
});
