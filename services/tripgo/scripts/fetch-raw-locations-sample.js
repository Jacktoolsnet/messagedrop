#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
const { createTripGoClient } = require('../clients/tripgo-client');

const CELLS_PER_DEGREE = 75;

function finiteNumber(name, fallback) {
  const value = process.env[name] ?? fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${name} must be a finite number`);
  return parsed;
}

function nonNegativeInteger(name, fallback) {
  const parsed = finiteNumber(name, fallback);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

function localCellIDs(latitude, longitude, radius) {
  const centerLatitudeCell = Math.floor(latitude * CELLS_PER_DEGREE);
  const centerLongitudeCell = Math.floor(longitude * CELLS_PER_DEGREE);
  const cells = [];
  for (let latitudeOffset = -radius; latitudeOffset <= radius; latitudeOffset += 1) {
    for (let longitudeOffset = -radius; longitudeOffset <= radius; longitudeOffset += 1) {
      cells.push(`${centerLatitudeCell + latitudeOffset}#${centerLongitudeCell + longitudeOffset}`);
    }
  }
  return cells;
}

async function main() {
  const outputPath = process.argv[2];
  const requestOutputPath = process.argv[3];
  if (!outputPath) throw new Error('Output path is required');

  const latitude = finiteNumber('TRIPGO_LOCATIONS_LAT', '52.14');
  const longitude = finiteNumber('TRIPGO_LOCATIONS_LNG', '10.54');
  const radius = nonNegativeInteger('TRIPGO_LOCATIONS_CELL_RADIUS', '1');
  const query = {
    region: process.env.TRIPGO_LOCATIONS_REGION || 'DE_NI_Hanover',
    levels: [1, 2],
    cellIDs: localCellIDs(latitude, longitude, radius),
    locale: process.env.TRIPGO_LOCATIONS_LOCALE || 'de',
    includeChildren: true,
    includeRoutes: true
  };

  const client = createTripGoClient();
  const response = await client.locations(query);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(response.data, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`Raw TripGo locations written to ${outputPath}\n`);

  if (requestOutputPath) {
    const diagnostics = {
      center: { latitude, longitude },
      cellRadius: radius,
      request: query,
      responseStatus: response.status,
      groupCount: Array.isArray(response.data?.groups) ? response.data.groups.length : 0,
      stopCount: Array.isArray(response.data?.groups)
        ? response.data.groups.reduce((count, group) => count + (group.stops?.length || 0), 0)
        : 0
    };
    await fs.writeFile(requestOutputPath, `${JSON.stringify(diagnostics, null, 2)}\n`, { mode: 0o600 });
    process.stdout.write(`TripGo locations request written to ${requestOutputPath}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`Could not fetch raw TripGo locations: ${error.message}\n`);
  if (error.response?.data) {
    process.stderr.write(`${JSON.stringify(error.response.data, null, 2)}\n`);
  }
  process.exitCode = 1;
});
